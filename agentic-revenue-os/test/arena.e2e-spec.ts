/**
 * E2E de la Arena Agentica v2 (LLM stubbeado). Cubre los 6 casos que la guia
 * pide antes de produccion:
 *  1. No permitir batalla entre el mismo agente.
 *  2. No permitir ver/resolver batalla de otro tenant.
 *  3. No permitir resolver una batalla dos veces.
 *  4. No permitir ganador si el agente fallo.
 *  5. ELO, XP y level se actualizan correctamente.
 *  6. El frontend recibe participant.profile.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { LlmProvider, LlmStructuredRequest, LlmStructuredResponse, AgenticRequest, AgenticResponse } from '../src/agents/llm.provider';
import { PrismaService } from '../src/prisma/prisma.service';

const GOOD_PACKAGE = {
  titulo: 'San Andrés Mágico', destino: 'San Andrés', noches: 4,
  resumen: 'Cuatro noches frente al mar en San Andrés.', incluye: ['Hotel', 'Traslados'],
  noIncluye: ['Tiquetes aéreos'], publicoIdeal: 'Parejas', siguientePaso: 'Validar disponibilidad con asesor.',
};

/** Stub configurable: puede devolver un paquete valido o lanzar (agente que falla). */
class LlmProviderStub {
  readonly providerName = 'stub';
  readonly availableProviders: Array<'anthropic' | 'openai'> = ['anthropic', 'openai'];
  failNextForModel: string | null = null;

  async generateStructured(req: LlmStructuredRequest): Promise<LlmStructuredResponse> {
    if (this.failNextForModel && req.model === this.failNextForModel) {
      throw new Error('Modelo caído (simulado)');
    }
    return { json: GOOD_PACKAGE, modelName: req.model ?? 'stub-model', inputTokens: 50, outputTokens: 30, latencyMs: 5 };
  }
  async runAgentic(_req: AgenticRequest): Promise<AgenticResponse> {
    return { text: 'ok', modelName: 'stub-model', inputTokens: 1, outputTokens: 1, latencyMs: 1, toolCalls: [] };
  }
}

async function registerTenant(app: INestApplication, prefix: string) {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email: `${prefix}-${randomUUID()}@x.com`, password: 'clave-segura-123', tenantName: `${prefix} ${randomUUID().slice(0, 6)}` })
    .expect(201);
  return { token: res.body.token as string, tenantId: res.body.tenant.id as string };
}

// Crea dos agentes (activados desde plantilla) para el tenant, con modelo asignado.
async function twoAgents(app: INestApplication, token: string, modelB = 'claude-sonnet-5') {
  const auth = { Authorization: `Bearer ${token}` };
  const a = await request(app.getHttpServer()).post('/marketplace/templates/sdr/activate').set(auth).expect(201);
  const b = await request(app.getHttpServer()).post('/marketplace/templates/collections/activate').set(auth).expect(201);
  await request(app.getHttpServer()).patch(`/marketplace/my-agents/${a.body.id}`).set(auth).send({ modelName: 'claude-haiku-4-5' }).expect(200);
  await request(app.getHttpServer()).patch(`/marketplace/my-agents/${b.body.id}`).set(auth).send({ modelName: modelB }).expect(200);
  return { auth, agentAId: a.body.id as string, agentBId: b.body.id as string };
}

describe('Agentic Arena v2 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stub = new LlmProviderStub();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LlmProvider).useValue(stub).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { stub.failNextForModel = null; });

  it('1. no permite batalla entre el mismo agente', async () => {
    const { token } = await registerTenant(app, 'same');
    const { auth, agentAId } = await twoAgents(app, token);
    await request(app.getHttpServer()).post('/arena/start').set(auth)
      .send({ agentAId, agentBId: agentAId, context: 'una tarea de prueba larga' }).expect(400);
  });

  it('5+6. batalla exitosa devuelve participant.profile y resolver actualiza ELO/XP/level', async () => {
    const { token } = await registerTenant(app, 'happy');
    const { auth, agentAId, agentBId } = await twoAgents(app, token);
    const battle = await request(app.getHttpServer()).post('/arena/start').set(auth)
      .send({ agentAId, agentBId, context: 'Cliente quiere 4 noches en San Andrés para 2 adultos.' }).expect(201);
    expect(battle.body.status).toBe('PENDING');
    expect(battle.body.participants).toHaveLength(2);
    // Caso 6: el frontend recibe participant.profile
    expect(battle.body.participants[0].profile).toBeDefined();
    expect(battle.body.participants[0].profile.elo).toBe(1000);

    const winnerId = battle.body.participants[0].id;
    const resolved = await request(app.getHttpServer()).post(`/arena/${battle.body.id}/resolve`).set(auth)
      .send({ winningParticipantId: winnerId }).expect(201);
    expect(resolved.body.status).toBe('RESOLVED');
    expect(resolved.body.winnerParticipantId).toBe(winnerId);

    // Caso 5: ganador sube ELO/XP/nivel; perdedor baja ELO pero gana algo de XP.
    const winnerProfileId = battle.body.participants[0].profileId;
    const loserProfileId = battle.body.participants[1].profileId;
    const winner = await prisma.agentProfile.findUnique({ where: { id: winnerProfileId } });
    const loser = await prisma.agentProfile.findUnique({ where: { id: loserProfileId } });
    expect(winner!.elo).toBeGreaterThan(1000);
    expect(winner!.xp).toBe(50);
    expect(winner!.wins).toBe(1);
    expect(loser!.elo).toBeLessThan(1000);
    expect(loser!.xp).toBe(10);
    expect(loser!.losses).toBe(1);
  });

  it('3. no permite resolver una batalla dos veces', async () => {
    const { token } = await registerTenant(app, 'twice');
    const { auth, agentAId, agentBId } = await twoAgents(app, token);
    const battle = await request(app.getHttpServer()).post('/arena/start').set(auth)
      .send({ agentAId, agentBId, context: 'tarea de prueba para resolver' }).expect(201);
    const winnerId = battle.body.participants[0].id;
    await request(app.getHttpServer()).post(`/arena/${battle.body.id}/resolve`).set(auth).send({ winningParticipantId: winnerId }).expect(201);
    await request(app.getHttpServer()).post(`/arena/${battle.body.id}/resolve`).set(auth).send({ winningParticipantId: winnerId }).expect(409);
  });

  it('4. no permite declarar ganador a un agente que falló', async () => {
    const { token } = await registerTenant(app, 'fail');
    // agente B corre en gpt-4o-mini; lo hacemos fallar
    const { auth, agentAId, agentBId } = await twoAgents(app, token, 'gpt-4o-mini');
    stub.failNextForModel = 'gpt-4o-mini';
    const battle = await request(app.getHttpServer()).post('/arena/start').set(auth)
      .send({ agentAId, agentBId, context: 'tarea donde el agente B falla' }).expect(201);
    // Sigue PENDING porque A respondió bien
    expect(battle.body.status).toBe('PENDING');
    const failed = battle.body.participants.find((p: any) => p.errorMessage);
    expect(failed).toBeDefined();
    await request(app.getHttpServer()).post(`/arena/${battle.body.id}/resolve`).set(auth)
      .send({ winningParticipantId: failed.id }).expect(400);
  });

  it('2. no permite ver ni resolver la batalla de otro tenant', async () => {
    const a = await registerTenant(app, 'isoA');
    const b = await registerTenant(app, 'isoB');
    const { auth: authA, agentAId, agentBId } = await twoAgents(app, a.token);
    const battle = await request(app.getHttpServer()).post('/arena/start').set(authA)
      .send({ agentAId, agentBId, context: 'batalla privada del tenant A' }).expect(201);
    const authB = { Authorization: `Bearer ${b.token}` };
    // B no puede ver ni resolver la batalla de A
    await request(app.getHttpServer()).get(`/arena/${battle.body.id}`).set(authB).expect(404);
    await request(app.getHttpServer()).post(`/arena/${battle.body.id}/resolve`).set(authB)
      .send({ winningParticipantId: battle.body.participants[0].id }).expect(404);
  });
});
