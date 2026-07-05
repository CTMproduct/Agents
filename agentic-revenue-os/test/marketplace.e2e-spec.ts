/**
 * E2E del marketplace multi-tenant: catalogo publico, registro/login,
 * activar plantilla, editar skill.md y conectores, correr el agente
 * (LLM stubbeado), calificar, y aislamiento entre tenants + admin.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { LlmProvider, AgenticRequest, AgenticResponse, LlmStructuredResponse } from '../src/agents/llm.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

class LlmProviderStub {
  readonly providerName = 'stub';
  async generateStructured(): Promise<LlmStructuredResponse> {
    throw new Error('no usado en este e2e');
  }
  async runAgentic(req: AgenticRequest): Promise<AgenticResponse> {
    return {
      text: 'Hola, gracias por escribirnos. Un asesor te contactara pronto.',
      modelName: 'stub-agentic-model',
      inputTokens: 50,
      outputTokens: 30,
      latencyMs: 3,
      toolCalls: [],
    };
  }
}

describe('Marketplace multi-tenant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LlmProvider)
      .useValue(new LlmProviderStub())
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('catalogo publico: no requiere login y trae las 3 plantillas sembradas', async () => {
    const res = await request(app.getHttpServer()).get('/marketplace/templates').expect(200);
    const keys = res.body.map((t: { key: string }) => t.key).sort();
    expect(keys).toEqual(['collections', 'sales_followup', 'sdr']);
    expect(res.body[0]).toHaveProperty('ratingAvg');
    expect(res.body[0]).toHaveProperty('ratingCount');
  });

  it('registro crea tenant + TENANT_ADMIN y devuelve un JWT usable', async () => {
    const email = `dueno-${randomUUID()}@empresa-test.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'clave-segura-123', tenantName: `Empresa Test ${randomUUID().slice(0, 6)}` })
      .expect(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`)
      .expect(200);
    expect(me.body.email).toBe(email);
    expect(me.body.tenant).toBeDefined();
  });

  it('sin token: activar/editar/correr un agente es rechazado', async () => {
    await request(app.getHttpServer()).post('/marketplace/templates/sdr/activate').expect(401);
    await request(app.getHttpServer()).get('/marketplace/my-agents').expect(401);
  });

  it('flujo completo: activar plantilla, editar skill.md/conectores, correr, calificar', async () => {
    const email = `flujo-${randomUUID()}@empresa-test.com`;
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'clave-segura-123', tenantName: `Flujo ${randomUUID().slice(0, 6)}` })
      .expect(201);
    const token = register.body.token as string;
    const auth = { Authorization: `Bearer ${token}` };

    // Activar el SDR
    const activated = await request(app.getHttpServer())
      .post('/marketplace/templates/sdr/activate')
      .set(auth)
      .expect(201);
    expect(activated.body.tenantId).toBe(register.body.tenant.id);
    expect(activated.body.name).toBe('Calificador de Leads AI (SDR)');
    const agentId = activated.body.id;

    // Aparece en "mis agentes"
    const mine = await request(app.getHttpServer()).get('/marketplace/my-agents').set(auth).expect(200);
    expect(mine.body.find((a: { id: string }) => a.id === agentId)).toBeDefined();

    // Editar el skill.md y los conectores (solo se permiten los marketplacePublic)
    const edited = await request(app.getHttpServer())
      .patch(`/marketplace/my-agents/${agentId}`)
      .set(auth)
      .send({ skillMd: '# Rol\nEres el SDR de mi empresa, tono cercano.', toolKeys: ['web_search', 'crm_lookup'] })
      .expect(200);
    expect(edited.body.skillMd).toContain('tono cercano');
    // crm_lookup NO es marketplacePublic: se filtra silenciosamente, protegiendo el CRM interno de CTM.
    expect(edited.body.toolKeys).toEqual(['web_search']);

    // Correr el agente (LLM stubbeado) y ver que quede auditado con tenantId
    const runRes = await request(app.getHttpServer())
      .post(`/marketplace/my-agents/${agentId}/run`)
      .set(auth)
      .send({ conversationText: 'Hola, quiero informacion' })
      .expect(201);
    expect(runRes.body.text).toContain('asesor');

    const run = await prisma.agentRun.findUnique({ where: { id: runRes.body.agentRunId } });
    expect(run?.tenantId).toBe(register.body.tenant.id);

    // Calificar la plantilla
    await request(app.getHttpServer())
      .post('/marketplace/templates/sdr/review')
      .set(auth)
      .send({ rating: 5, comment: 'Excelente para calificar leads' })
      .expect(201);
    const catalog = await request(app.getHttpServer()).get('/marketplace/templates').expect(200);
    const sdr = catalog.body.find((t: { key: string }) => t.key === 'sdr');
    expect(sdr.ratingCount).toBeGreaterThanOrEqual(1);
    expect(sdr.ratingAvg).toBeGreaterThan(0);
  });

  it('aislamiento entre tenants: la empresa B no puede editar ni correr el agente de la empresa A', async () => {
    const regA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `a-${randomUUID()}@x.com`, password: 'clave-segura-123', tenantName: `A ${randomUUID().slice(0, 6)}` })
      .expect(201);
    const regB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `b-${randomUUID()}@x.com`, password: 'clave-segura-123', tenantName: `B ${randomUUID().slice(0, 6)}` })
      .expect(201);

    const activated = await request(app.getHttpServer())
      .post('/marketplace/templates/sdr/activate')
      .set('Authorization', `Bearer ${regA.body.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/marketplace/my-agents/${activated.body.id}`)
      .set('Authorization', `Bearer ${regB.body.token}`)
      .send({ name: 'Hackeado' })
      .expect(400); // no existe "en su empresa" -> BadRequestException

    const bAgents = await request(app.getHttpServer())
      .get('/marketplace/my-agents')
      .set('Authorization', `Bearer ${regB.body.token}`)
      .expect(200);
    expect(bAgents.body).toHaveLength(0);
  });

  it('admin de plataforma: ve todos los tenants; un tenant normal no puede', async () => {
    const adminEmail = `admin-${randomUUID()}@ctm.internal`;
    await prisma.user.create({
      data: { email: adminEmail, passwordHash: await bcrypt.hash('clave-admin-123', 10), role: UserRole.PLATFORM_ADMIN },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: 'clave-admin-123' })
      .expect(201);

    const tenants = await request(app.getHttpServer())
      .get('/admin/tenants')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);
    expect(Array.isArray(tenants.body)).toBe(true);
    expect(tenants.body.length).toBeGreaterThan(0);

    // Un tenant normal (no PLATFORM_ADMIN) recibe 401 en /admin/*
    const regularUser = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `reg-${randomUUID()}@x.com`, password: 'clave-segura-123', tenantName: `Reg ${randomUUID().slice(0, 6)}` })
      .expect(201);
    await request(app.getHttpServer())
      .get('/admin/tenants')
      .set('Authorization', `Bearer ${regularUser.body.token}`)
      .expect(401);
  });
});
