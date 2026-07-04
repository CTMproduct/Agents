/**
 * E2E del webhook (requiere DB de docker-compose levantada y ANTHROPIC_API_KEY;
 * si no hay API key, el pipeline audita el fallo pero el webhook responde 200 igual:
 * el controller solo normaliza y emite el evento).
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('POST /webhooks/:channel (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.WEBHOOK_SHARED_SECRET = 'test-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza sin secret', () =>
    request(app.getHttpServer())
      .post('/webhooks/webchat')
      .send({ sessionId: 's1', message: 'hola' })
      .expect(401));

  it('rechaza canal desconocido', () =>
    request(app.getHttpServer())
      .post('/webhooks/telegram')
      .set('x-webhook-secret', 'test-secret')
      .send({})
      .expect(400));

  it('rechaza payload invalido de webchat', () =>
    request(app.getHttpServer())
      .post('/webhooks/webchat')
      .set('x-webhook-secret', 'test-secret')
      .send({ nada: true })
      .expect(400));

  it('acepta mensaje valido de webchat y devuelve traceId', async () => {
    const res = await request(app.getHttpServer())
      .post('/webhooks/webchat')
      .set('x-webhook-secret', 'test-secret')
      .send({ sessionId: 's1', name: 'Ana', message: 'Quiero info de San Andres' })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.traceId).toBeDefined();
  });
});
