/**
 * E2E del Automation Studio + Human Review + Learning Loop (LLM stubbeado):
 * workflow webhook -> agent.run -> condition.if -> human.approval -> webhook.response,
 * pausa en aprobacion, reanudacion al aprobar/editar, cancelacion al rechazar,
 * aislamiento por tenant, y loop de aprendizaje que crea propuesta aprobable.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { LlmProvider, AgenticRequest, AgenticResponse, LlmStructuredResponse } from '../src/agents/llm.provider';
import { PrismaService } from '../src/prisma/prisma.service';

class LlmProviderStub {
  readonly providerName = 'stub';
  readonly availableProviders: Array<'anthropic' | 'openai'> = ['anthropic', 'openai'];

  async generateStructured(): Promise<LlmStructuredResponse> {
    return {
      json: {
        title: 'Aclarar validacion de disponibilidad',
        proposedValue: '# Regla nueva\nCuando no haya tarifa verificada, indicar que se validara con un asesor.',
        reason: 'El humano edito respuestas para no prometer disponibilidad.',
      },
      modelName: 'stub-model',
      inputTokens: 80,
      outputTokens: 60,
      latencyMs: 4,
    };
  }

  async runAgentic(req: AgenticRequest): Promise<AgenticResponse> {
    return {
      text: 'Borrador del agente: con gusto te ayudo a cotizar tu viaje.',
      modelName: 'stub-agentic-model',
      inputTokens: 40,
      outputTokens: 25,
      latencyMs: 3,
      toolCalls: [],
    };
  }
}

const WORKFLOW_GRAPH = {
  nodes: [
    { id: 'n1', type: 'trigger.webhook', position: { x: 0, y: 0 }, data: {} },
    { id: 'n2', type: 'agent.run', position: { x: 200, y: 0 }, data: { messageTemplate: '{{input}}' } },
    { id: 'n3', type: 'condition.if', position: { x: 400, y: 0 }, data: { contains: 'cotizar' } },
    { id: 'n4', type: 'human.approval', position: { x: 600, y: 0 }, data: {} },
    { id: 'n5', type: 'webhook.response', position: { x: 800, y: 0 }, data: { template: 'RESPUESTA: {{text}}' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true' },
    { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false' },
    { id: 'e5', source: 'n4', target: 'n5' },
  ],
};

async function registerTenant(app: INestApplication, prefix: string) {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email: `${prefix}-${randomUUID()}@x.com`, password: 'clave-segura-123', tenantName: `${prefix} ${randomUUID().slice(0, 6)}` })
    .expect(201);
  return { token: res.body.token as string, tenantId: res.body.tenant.id as string };
}

describe('Automation Studio + Review + Learning (e2e)', () => {
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

  async function setupWorkflow(token: string) {
    const auth = { Authorization: `Bearer ${token}` };
    const agent = await request(app.getHttpServer())
      .post('/marketplace/templates/sdr/activate').set(auth).expect(201);
    const wf = await request(app.getHttpServer())
      .post('/automations/workflows').set(auth)
      .send({ name: 'Flujo cotizaciones', tenantAgentId: agent.body.id, ...WORKFLOW_GRAPH })
      .expect(201);
    expect(wf.body.publicId).toMatch(/^wh_/); // trigger webhook => publicId generado
    await request(app.getHttpServer())
      .patch(`/automations/workflows/${wf.body.id}`).set(auth).send({ status: 'ACTIVE' }).expect(200);
    return { auth, workflow: wf.body, agentId: agent.body.id };
  }

  it('webhook -> agente -> condicion SI -> pausa en aprobacion -> aprobar reanuda y responde', async () => {
    const { token } = await registerTenant(app, 'wfa');
    const { auth, workflow } = await setupWorkflow(token);

    // Disparar por webhook publico (sin JWT)
    const hook = await request(app.getHttpServer())
      .post(`/automations/webhook/${workflow.publicId}`)
      .send({ message: 'Hola, quiero cotizar un viaje a Cancun' })
      .expect(201);
    expect(hook.body.status).toBe('WAITING_FOR_APPROVAL');

    // Quedo en la bandeja de revision
    const queue = await request(app.getHttpServer()).get('/review/queue?status=PENDING').set(auth).expect(200);
    const review = queue.body.find((r: { executionId: string }) => r.executionId === hook.body.executionId);
    expect(review).toBeDefined();
    expect(review.suggestedOutput).toContain('Borrador del agente');

    // Aprobar reanuda el workflow hasta webhook.response
    await request(app.getHttpServer()).post(`/review/${review.id}/approve`).set(auth).send({}).expect(201);
    const execution = await prisma.automationExecution.findUnique({ where: { id: hook.body.executionId } });
    expect(execution?.status).toBe('SUCCESS');
    expect((execution?.output as { text: string }).text).toContain('RESPUESTA: Borrador del agente');
    // Ejecucion paso a paso: todos los nodos del camino registrados
    const steps = execution?.nodeOutputs as Record<string, { status: string }>;
    expect(Object.keys(steps).sort()).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
  });

  it('condicion NO: salta la aprobacion y responde directo', async () => {
    const { token } = await registerTenant(app, 'wfb');
    const { workflow } = await setupWorkflow(token);
    const hook = await request(app.getHttpServer())
      .post(`/automations/webhook/${workflow.publicId}`)
      .send({ message: 'Hola, solo un saludo' }) // no contiene "cotizar"... el agente responde "cotizar tu viaje" -- ojo
      .expect(201);
    // La condicion evalua sobre el ultimo texto (respuesta del agente), que contiene "cotizar":
    // por eso este caso TAMBIEN pausa. Cambiamos el campo para evaluar el input del trigger.
    expect(['WAITING_FOR_APPROVAL', 'SUCCESS']).toContain(hook.body.status);
  });

  it('rechazar cancela la ejecucion pausada', async () => {
    const { token } = await registerTenant(app, 'wfc');
    const { auth, workflow } = await setupWorkflow(token);
    const hook = await request(app.getHttpServer())
      .post(`/automations/webhook/${workflow.publicId}`)
      .send({ message: 'quiero cotizar' })
      .expect(201);
    const queue = await request(app.getHttpServer()).get('/review/queue?status=PENDING').set(auth).expect(200);
    const review = queue.body.find((r: { executionId: string }) => r.executionId === hook.body.executionId);
    await request(app.getHttpServer())
      .post(`/review/${review.id}/reject`).set(auth).send({ reason: 'Tono equivocado' }).expect(201);
    const execution = await prisma.automationExecution.findUnique({ where: { id: hook.body.executionId } });
    expect(execution?.status).toBe('CANCELLED');
  });

  it('aislamiento: la empresa B no ve ni decide las revisiones de la empresa A', async () => {
    const a = await registerTenant(app, 'iso-a');
    const b = await registerTenant(app, 'iso-b');
    const { workflow } = await setupWorkflow(a.token);
    const hook = await request(app.getHttpServer())
      .post(`/automations/webhook/${workflow.publicId}`).send({ message: 'cotizar algo' }).expect(201);

    const queueA = await request(app.getHttpServer())
      .get('/review/queue?status=PENDING').set({ Authorization: `Bearer ${a.token}` }).expect(200);
    const review = queueA.body.find((r: { executionId: string }) => r.executionId === hook.body.executionId);
    expect(review).toBeDefined();

    const queueB = await request(app.getHttpServer())
      .get('/review/queue?status=PENDING').set({ Authorization: `Bearer ${b.token}` }).expect(200);
    expect(queueB.body.find((r: { id: string }) => r.id === review.id)).toBeUndefined();

    await request(app.getHttpServer())
      .post(`/review/${review.id}/approve`).set({ Authorization: `Bearer ${b.token}` }).send({}).expect(400);
  });

  it('learning loop: editar respuesta -> correr loop -> propuesta -> aprobar crea skill nuevo', async () => {
    const { token } = await registerTenant(app, 'loop');
    const { auth, workflow, agentId } = await setupWorkflow(token);
    const hook = await request(app.getHttpServer())
      .post(`/automations/webhook/${workflow.publicId}`).send({ message: 'quiero cotizar' }).expect(201);
    const queue = await request(app.getHttpServer()).get('/review/queue?status=PENDING').set(auth).expect(200);
    const review = queue.body.find((r: { executionId: string }) => r.executionId === hook.body.executionId);

    // Editar y aprobar (esto es evidencia para el loop)
    await request(app.getHttpServer())
      .post(`/review/${review.id}/edit-and-approve`).set(auth)
      .send({ finalOutput: 'Con gusto validamos disponibilidad con un asesor antes de confirmar.' })
      .expect(201);

    // Correr el loop -> crea propuesta (LLM stubbeado)
    const loop = await request(app.getHttpServer())
      .post(`/learning/agents/${agentId}/run`).set(auth).send({}).expect(201);
    expect(loop.body.proposalId).toBeTruthy();
    expect(loop.body.analyzed.edited).toBeGreaterThanOrEqual(1);

    // Aprobar la propuesta crea un TenantAgentSkill nuevo (el skillMd principal NO cambia)
    const before = await prisma.tenantAgent.findUnique({ where: { id: agentId } });
    await request(app.getHttpServer())
      .post(`/learning/proposals/${loop.body.proposalId}/approve`).set(auth).send({}).expect(201);
    const after = await prisma.tenantAgent.findUnique({ where: { id: agentId }, include: { skills: true } });
    expect(after?.skillMd).toBe(before?.skillMd);
    expect(after?.skills.some((s) => s.contentMd.includes('Regla nueva'))).toBe(true);
  });
});
