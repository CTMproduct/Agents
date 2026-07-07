/**
 * E2E de seguridad enterprise (Fase 7) + metricas diarias (Fase 8):
 * - Vault de secretos cifrado (write-only: nunca devuelve el valor).
 * - RBAC granular (TENANT_VIEWER no puede configurar; solo TENANT_ADMIN al vault).
 * - Webhook con HMAC-SHA256 y con secreto compartido.
 * - Versionado de workflows (WorkflowVersion) al cambiar el grafo.
 * - AgentDailyMetric persistido al consultar /metrics/decision.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHmac, randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { LlmProvider, AgenticRequest, AgenticResponse, LlmStructuredResponse } from '../src/agents/llm.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { SecretsService } from '../src/security/secrets.service';

class LlmProviderStub {
  readonly providerName = 'stub';
  readonly availableProviders: Array<'anthropic' | 'openai'> = ['anthropic', 'openai'];
  async generateStructured(): Promise<LlmStructuredResponse> {
    return { json: { skillMd: '# Rol\nStub' }, modelName: 'stub-model', inputTokens: 10, outputTokens: 10, latencyMs: 1 };
  }
  async runAgentic(_req: AgenticRequest): Promise<AgenticResponse> {
    return { text: 'Borrador del agente para cotizar.', modelName: 'stub-agentic-model', inputTokens: 20, outputTokens: 10, latencyMs: 2, toolCalls: [] };
  }
}

const WEBHOOK_GRAPH = {
  nodes: [
    { id: 'n1', type: 'trigger.webhook', position: { x: 0, y: 0 }, data: {} },
    { id: 'n2', type: 'agent.run', position: { x: 200, y: 0 }, data: { messageTemplate: '{{input}}' } },
    { id: 'n3', type: 'webhook.response', position: { x: 400, y: 0 }, data: { template: 'OK: {{text}}' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
  ],
};

async function registerTenant(app: INestApplication, prefix: string) {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email: `${prefix}-${randomUUID()}@x.com`, password: 'clave-segura-123', tenantName: `${prefix} ${randomUUID().slice(0, 6)}` })
    .expect(201);
  return { token: res.body.token as string, tenantId: res.body.tenant.id as string, email: res.body.user.email as string };
}

describe('Enterprise security + daily metrics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-para-e2e-12345';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LlmProvider)
      .useValue(new LlmProviderStub())
      .compile();
    // rawBody habilitado como en main.ts, para verificar firmas HMAC sobre el cuerpo crudo.
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('vault: guarda un secreto cifrado y NUNCA devuelve el valor; se descifra igual', async () => {
    const { token } = await registerTenant(app, 'vault');
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app.getHttpServer())
      .post('/security/secrets').set(auth)
      .send({ name: 'WHATSAPP_TOKEN', value: 'super-secreto-123' })
      .expect(201);
    expect(created.body.value).toBeUndefined();
    expect(created.body.name).toBe('WHATSAPP_TOKEN');

    const list = await request(app.getHttpServer()).get('/security/secrets').set(auth).expect(200);
    const secret = list.body.find((s: { name: string }) => s.name === 'WHATSAPP_TOKEN');
    expect(secret).toBeDefined();
    expect(secret.value).toBeUndefined();
    expect(secret.encryptedValue).toBeUndefined();

    // En la DB el valor esta cifrado (no es texto plano) y se puede descifrar.
    const row = await prisma.secretCredential.findUnique({ where: { id: created.body.id } });
    expect(row!.encryptedValue).not.toContain('super-secreto-123');
    const secrets = app.get(SecretsService);
    expect(secrets.decrypt(row!.encryptedValue)).toBe('super-secreto-123');
  });

  it('RBAC: un TENANT_VIEWER no puede tocar el vault ni configurar agentes', async () => {
    const admin = await registerTenant(app, 'rbac');
    const auth = { Authorization: `Bearer ${admin.token}` };
    // El admin crea un usuario VIEWER en su empresa.
    await request(app.getHttpServer())
      .post('/security/users').set(auth)
      .send({ email: `viewer-${randomUUID()}@x.com`, password: 'clave-viewer-123', role: 'TENANT_VIEWER' })
      .expect(201);
    const viewerEmail = (await prisma.user.findFirst({ where: { tenantId: admin.tenantId, role: 'TENANT_VIEWER' } }))!.email;
    const viewerLogin = await request(app.getHttpServer())
      .post('/auth/login').send({ email: viewerEmail, password: 'clave-viewer-123' }).expect(201);
    const vauth = { Authorization: `Bearer ${viewerLogin.body.token}` };

    // Viewer: rechazado en vault y en activar agentes (401 del guard de roles).
    await request(app.getHttpServer()).get('/security/secrets').set(vauth).expect(401);
    await request(app.getHttpServer()).post('/marketplace/templates/sdr/activate').set(vauth).expect(401);
  });

  it('webhook HMAC: acepta firma valida y secreto compartido, rechaza firma invalida', async () => {
    const { token } = await registerTenant(app, 'hmac');
    const auth = { Authorization: `Bearer ${token}` };
    const agent = await request(app.getHttpServer()).post('/marketplace/templates/sdr/activate').set(auth).expect(201);
    const wf = await request(app.getHttpServer())
      .post('/automations/workflows').set(auth)
      .send({ name: 'WF HMAC', tenantAgentId: agent.body.id, ...WEBHOOK_GRAPH }).expect(201);
    const secret = 'mi-secreto-webhook';
    await request(app.getHttpServer())
      .patch(`/automations/workflows/${wf.body.id}`).set(auth)
      .send({ webhookSecret: secret, status: 'ACTIVE' }).expect(200);

    const url = `/automations/webhook/${wf.body.publicId}`;
    const payload = { message: 'hola quiero cotizar' };
    const raw = JSON.stringify(payload);

    // Sin credenciales -> 401
    await request(app.getHttpServer()).post(url).send(payload).expect(401);
    // Firma HMAC valida sobre el cuerpo crudo -> 201
    const sig = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
    await request(app.getHttpServer()).post(url).set('content-type', 'application/json').set('x-webhook-signature', sig).send(raw).expect(201);
    // Secreto compartido simple -> 201
    await request(app.getHttpServer()).post(url).set('x-webhook-secret', secret).send(payload).expect(201);
    // Firma invalida -> 401
    await request(app.getHttpServer()).post(url).set('x-webhook-signature', 'sha256=deadbeef').send(payload).expect(401);
  });

  it('versionado de workflows: cambiar el grafo guarda la version anterior', async () => {
    const { token } = await registerTenant(app, 'wfver');
    const auth = { Authorization: `Bearer ${token}` };
    const wf = await request(app.getHttpServer())
      .post('/automations/workflows').set(auth).send({ name: 'Versionable', ...WEBHOOK_GRAPH }).expect(201);
    expect(wf.body.version).toBe(1);

    // Cambiar nodos -> version 2, y version 1 guardada en historial.
    const newGraph = { ...WEBHOOK_GRAPH, nodes: [...WEBHOOK_GRAPH.nodes, { id: 'n4', type: 'human.approval', position: { x: 600, y: 0 }, data: {} }], edges: [...WEBHOOK_GRAPH.edges, { id: 'e3', source: 'n3', target: 'n4' }] };
    const updated = await request(app.getHttpServer())
      .patch(`/automations/workflows/${wf.body.id}`).set(auth).send({ nodes: newGraph.nodes, edges: newGraph.edges }).expect(200);
    expect(updated.body.version).toBe(2);

    const versions = await request(app.getHttpServer()).get(`/automations/workflows/${wf.body.id}/versions`).set(auth).expect(200);
    expect(versions.body).toHaveLength(1);
    expect(versions.body[0].version).toBe(1);
  });

  it('AgentDailyMetric: /metrics/decision persiste el snapshot del dia', async () => {
    const { token, tenantId } = await registerTenant(app, 'daily');
    const auth = { Authorization: `Bearer ${token}` };
    const agent = await request(app.getHttpServer()).post('/marketplace/templates/sdr/activate').set(auth).expect(201);
    await request(app.getHttpServer())
      .post(`/marketplace/my-agents/${agent.body.id}/run`).set(auth)
      .send({ conversationText: 'hola' }).expect(201);

    await request(app.getHttpServer()).get('/metrics/decision').set(auth).expect(200);
    const rows = await prisma.agentDailyMetric.findMany({ where: { tenantId } });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const daily = await request(app.getHttpServer()).get(`/metrics/daily/${agent.body.id}`).set(auth).expect(200);
    expect(Array.isArray(daily.body)).toBe(true);
    expect(daily.body[daily.body.length - 1].runs).toBeGreaterThanOrEqual(1);
  });
});
