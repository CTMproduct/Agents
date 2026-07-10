/**
 * E2E del Training Camp (LLM stubbeado): el "metodo facil de entrenar".
 *  1. practice crea una sesion PENDING con respuesta del agente y XP.
 *  2. coach convierte la correccion en memoria EPISODIC y sube XP del agente.
 *  3. No se puede corregir dos veces la misma sesion.
 *  4. rating fuera de 1..5 se rechaza.
 *  5. Aislamiento: un tenant no toca los agentes/memorias de otro.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { LlmProvider } from '../src/agents/llm.provider';
import { PrismaService } from '../src/prisma/prisma.service';

/** Stub: chat con respuesta canned; embed determinista (bag-of-words) para recall real. */
class LlmProviderStub {
  readonly providerName = 'stub';
  readonly availableProviders: Array<'anthropic' | 'openai'> = ['anthropic'];
  get embeddingsProvider() {
    return 'local';
  }
  async chat(req: { user: string }) {
    return { text: `Respuesta de práctica a: ${req.user}`, modelName: 'stub', provider: 'anthropic' as const, inputTokens: 10, outputTokens: 8, latencyMs: 3 };
  }
  async embed(text: string): Promise<number[]> {
    const v = new Array<number>(64).fill(0);
    for (const tok of text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2)) {
      let h = 2166136261;
      for (let i = 0; i < tok.length; i++) {
        h ^= tok.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      v[(h >>> 0) % 64] += 1;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  }
  async generateStructured() {
    return { json: {}, modelName: 'stub', inputTokens: 1, outputTokens: 1, latencyMs: 1 };
  }
  async runAgentic() {
    return { text: 'ok', modelName: 'stub', inputTokens: 1, outputTokens: 1, latencyMs: 1, toolCalls: [] };
  }
}

async function registerTenant(app: INestApplication, prefix: string) {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email: `${prefix}-${randomUUID()}@x.com`, password: 'clave-segura-123', tenantName: `${prefix} ${randomUUID().slice(0, 6)}` })
    .expect(201);
  return { token: res.body.token as string, tenantId: res.body.tenant.id as string };
}

async function activateAgent(app: INestApplication, token: string) {
  const auth = { Authorization: `Bearer ${token}` };
  const a = await request(app.getHttpServer()).post('/marketplace/templates/sdr/activate').set(auth).expect(201);
  return { auth, agentId: a.body.id as string };
}

describe('Training Camp (e2e)', () => {
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

  it('practice -> coach: crea sesion, memoria episodica y sube XP del agente', async () => {
    const { token, tenantId } = await registerTenant(app, 'train');
    const { auth, agentId } = await activateAgent(app, token);

    // 1. Practica
    const practice = await request(app.getHttpServer())
      .post(`/training/${agentId}/practice`)
      .set(auth)
      .send({ prompt: 'Un cliente pide descuento por reservar un grupo de 12 personas.' })
      .expect(201);
    expect(practice.body.status).toBe('PENDING');
    expect(practice.body.response).toContain('Respuesta de práctica');
    expect(practice.body.xpEarned).toBe(5);

    // 2. Historial
    const sessions = await request(app.getHttpServer()).get(`/training/${agentId}/sessions`).set(auth).expect(200);
    expect(sessions.body).toHaveLength(1);

    // 3. Coaching (rating alto => +20 XP)
    const coached = await request(app.getHttpServer())
      .post(`/training/sessions/${practice.body.id}/coach`)
      .set(auth)
      .send({ coachFeedback: 'Ofrece 10% para grupos de 10+ y valida cupos con el asesor antes de confirmar.', rating: 5 })
      .expect(201);
    expect(coached.body.status).toBe('REVIEWED');
    expect(coached.body.memoryId).toBeTruthy();

    // 4. Memoria episodica creada con importancia alta
    const memories = await request(app.getHttpServer()).get(`/training/${agentId}/memories`).set(auth).expect(200);
    expect(memories.body).toHaveLength(1);
    expect(memories.body[0].type).toBe('EPISODIC');
    expect(memories.body[0].importance).toBeCloseTo(0.9);

    // 5. XP del agente subio (5 no aplica al perfil; el coaching suma 20)
    const profile = await prisma.agentProfile.findUnique({ where: { tenantId_agentId: { tenantId, agentId } } });
    expect(profile?.xp).toBe(20);
  });

  it('no permite corregir dos veces la misma sesion', async () => {
    const { token } = await registerTenant(app, 'twice');
    const { auth, agentId } = await activateAgent(app, token);
    const p = await request(app.getHttpServer()).post(`/training/${agentId}/practice`).set(auth).send({ prompt: 'tarea de prueba para doble coaching' }).expect(201);
    await request(app.getHttpServer()).post(`/training/sessions/${p.body.id}/coach`).set(auth).send({ coachFeedback: 'buen trabajo', rating: 4 }).expect(201);
    await request(app.getHttpServer()).post(`/training/sessions/${p.body.id}/coach`).set(auth).send({ coachFeedback: 'otra vez', rating: 4 }).expect(409);
  });

  it('rechaza rating fuera de 1..5', async () => {
    const { token } = await registerTenant(app, 'rating');
    const { auth, agentId } = await activateAgent(app, token);
    const p = await request(app.getHttpServer()).post(`/training/${agentId}/practice`).set(auth).send({ prompt: 'tarea para rating invalido' }).expect(201);
    await request(app.getHttpServer()).post(`/training/sessions/${p.body.id}/coach`).set(auth).send({ coachFeedback: 'x', rating: 9 }).expect(400);
  });

  it('aislamiento: un tenant no practica ni corrige el agente de otro', async () => {
    const a = await registerTenant(app, 'isoA');
    const b = await registerTenant(app, 'isoB');
    const { auth: authA, agentId } = await activateAgent(app, a.token);
    const p = await request(app.getHttpServer()).post(`/training/${agentId}/practice`).set(authA).send({ prompt: 'batalla privada de A' }).expect(201);

    const authB = { Authorization: `Bearer ${b.token}` };
    // B no puede practicar el agente de A
    await request(app.getHttpServer()).post(`/training/${agentId}/practice`).set(authB).send({ prompt: 'intruso' }).expect(404);
    // B no puede corregir la sesion de A
    await request(app.getHttpServer()).post(`/training/sessions/${p.body.id}/coach`).set(authB).send({ coachFeedback: 'intruso', rating: 3 }).expect(404);
    // B no ve las memorias de A (lista vacia bajo su propio tenant)
    const mem = await request(app.getHttpServer()).get(`/training/${agentId}/memories`).set(authB).expect(200);
    expect(mem.body).toHaveLength(0);
  });
});
