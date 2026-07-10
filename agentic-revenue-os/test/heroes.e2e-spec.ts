/**
 * E2E de Heroes + arbol de maestrias.
 *  1. Catalogo publico de heroes con su arbol.
 *  2. Asignar heroe a un agente (solo TENANT_ADMIN).
 *  3. Desbloquear skill gasta XP; exige nodo padre; no dos veces.
 *  4. Aislamiento entre tenants.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

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

describe('Heroes + Skill Tree (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });

  it('catalogo de heroes trae el arbol de habilidades', async () => {
    const { token } = await registerTenant(app, 'cat');
    const res = await request(app.getHttpServer()).get('/heroes').set({ Authorization: `Bearer ${token}` }).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const hunter = res.body.find((h: { slug: string }) => h.slug === 'hunter');
    expect(hunter).toBeDefined();
    expect(hunter.skills.length).toBe(5); // P,Q,W,E,R
  });

  it('asignar heroe + desbloquear skills con XP (prerequisito y no-duplicado)', async () => {
    const { token, tenantId } = await registerTenant(app, 'tree');
    const { auth, agentId } = await activateAgent(app, token);

    // Asignar heroe Hunter
    const heroes = await request(app.getHttpServer()).get('/heroes').set(auth).expect(200);
    const hunterId = heroes.body.find((h: { slug: string }) => h.slug === 'hunter').id;
    await request(app.getHttpServer()).post(`/heroes/agents/${agentId}/assign`).set(auth).send({ heroId: hunterId }).expect(201);

    // Arbol del agente: 0 desbloqueadas, XP 0
    let tree = (await request(app.getHttpServer()).get(`/heroes/agents/${agentId}/skill-tree`).set(auth).expect(200)).body;
    expect(tree.hero.slug).toBe('hunter');
    expect(tree.xp).toBe(0);
    const passive = tree.nodes.find((n: { abilitySlot: string }) => n.abilitySlot === 'PASSIVE');
    const q = tree.nodes.find((n: { abilitySlot: string }) => n.abilitySlot === 'Q');

    // Sin XP no puede desbloquear Q (cuesta 100)
    await request(app.getHttpServer()).post(`/heroes/agents/${agentId}/skills/${q.id}/unlock`).set(auth).expect(400);

    // La pasiva cuesta 0 -> se desbloquea
    await request(app.getHttpServer()).post(`/heroes/agents/${agentId}/skills/${passive.id}/unlock`).set(auth).expect(201);

    // No se puede desbloquear dos veces
    await request(app.getHttpServer()).post(`/heroes/agents/${agentId}/skills/${passive.id}/unlock`).set(auth).expect(409);

    // Damos XP al perfil (como si hubiera entrenado) y desbloqueamos Q
    await prisma.agentProfile.upsert({
      where: { tenantId_agentId: { tenantId, agentId } },
      create: { tenantId, agentId, alias: 'Hunter test', xp: 150 },
      update: { xp: 150 },
    });
    tree = (await request(app.getHttpServer()).post(`/heroes/agents/${agentId}/skills/${q.id}/unlock`).set(auth).expect(201)).body;
    expect(tree.xp).toBe(50); // 150 - 100
    const qNode = tree.nodes.find((n: { id: string }) => n.id === q.id);
    expect(qNode.unlocked).toBe(true);

    // W (parent Q) ahora es prerequisito-ok pero cuesta 150 y solo hay 50 XP -> 400
    const w = tree.nodes.find((n: { abilitySlot: string }) => n.abilitySlot === 'W');
    await request(app.getHttpServer()).post(`/heroes/agents/${agentId}/skills/${w.id}/unlock`).set(auth).expect(400);

    // E requiere W (no desbloqueado) -> prerequisito faltante (400)
    const e = tree.nodes.find((n: { abilitySlot: string }) => n.abilitySlot === 'E');
    await request(app.getHttpServer()).post(`/heroes/agents/${agentId}/skills/${e.id}/unlock`).set(auth).expect(400);
  });

  it('aislamiento: un tenant no asigna heroe ni ve el arbol del agente de otro', async () => {
    const a = await registerTenant(app, 'hisoA');
    const b = await registerTenant(app, 'hisoB');
    const { agentId } = await activateAgent(app, a.token);
    const authB = { Authorization: `Bearer ${b.token}` };
    const heroes = await request(app.getHttpServer()).get('/heroes').set(authB).expect(200);
    const hunterId = heroes.body[0].id;
    await request(app.getHttpServer()).post(`/heroes/agents/${agentId}/assign`).set(authB).send({ heroId: hunterId }).expect(404);
    await request(app.getHttpServer()).get(`/heroes/agents/${agentId}/skill-tree`).set(authB).expect(404);
  });
});
