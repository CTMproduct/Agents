/**
 * E2E del pipeline completo con el LLM stubbeado (no requiere ANTHROPIC_API_KEY):
 * webhook -> contacto/conversacion/mensaje -> IntakeAgent (fixture) -> lead + tarea
 * -> SuggestedReply PENDING_APPROVAL -> aprobar -> mensaje OUTBOUND + estado SENT.
 * Prueba el contrato Zod, los gates duros y el human-in-the-loop de punta a punta.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { LlmProvider, LlmStructuredResponse } from '../src/agents/llm.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { IntakeOutput } from '../src/agents/schemas';

const FIXTURE_OUTPUT: IntakeOutput = {
  intent: 'QUOTE_REQUEST',
  customerType: 'AGENCY',
  destination: 'Punta Cana',
  travelDateFrom: '2026-09-10',
  travelDateTo: '2026-09-15',
  paxAdults: 2,
  paxChildren: 0,
  budgetAmount: null,
  budgetCurrency: null,
  score: 0.82,
  scoreReason: 'Agencia con destino, fechas y pax definidos',
  suggestedReply:
    'Hola Ana, gracias por escribirnos. Con gusto preparamos la cotizacion de Punta Cana para 2 adultos del 10 al 15 de septiembre. Un asesor te la comparte muy pronto.',
  confidence: 0.9,
  escalateToHuman: false,
  escalationReason: null,
};

class LlmProviderStub {
  readonly providerName = 'stub';
  nextOutput: IntakeOutput = FIXTURE_OUTPUT;

  async generateStructured(): Promise<LlmStructuredResponse> {
    return {
      json: this.nextOutput,
      modelName: 'stub-model',
      inputTokens: 100,
      outputTokens: 200,
      latencyMs: 5,
    };
  }
}

async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 10000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error('Timeout esperando condicion');
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe('Pipeline completo con LLM stub (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stub = new LlmProviderStub();

  beforeAll(async () => {
    process.env.WEBHOOK_SHARED_SECRET = 'test-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LlmProvider)
      .useValue(stub)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('flujo normal: lead calificado, tarea y respuesta pendiente; aprobar la envia', async () => {
    const sessionId = `e2e-${randomUUID()}`;
    stub.nextOutput = FIXTURE_OUTPUT;

    await request(app.getHttpServer())
      .post('/webhooks/webchat')
      .set('x-webhook-secret', 'test-secret')
      .send({
        sessionId,
        name: 'Ana',
        message:
          'Hola, somos una agencia de Cali. Necesitamos Punta Cana para 2 adultos del 10 al 15 de septiembre',
      })
      .expect(200);

    // El workflow corre async: esperar a que exista la SuggestedReply de esta conversacion
    const identity = await waitFor(() =>
      prisma.channelIdentity.findUnique({
        where: { channel_externalId: { channel: 'WEBCHAT', externalId: sessionId } },
        include: { contact: { include: { leads: { include: { tasks: true } } } } },
      }),
    );
    const conversation = await waitFor(() =>
      prisma.conversation.findFirst({ where: { contactId: identity.contactId } }),
    );
    const reply = await waitFor(() =>
      prisma.suggestedReply.findFirst({ where: { conversationId: conversation.id } }),
    );

    // Lead con los campos extraidos y estado QUALIFIED (sin gates disparados)
    const lead = await waitFor(() =>
      prisma.lead.findFirst({ where: { contactId: identity.contactId } }),
    );
    expect(lead.intent).toBe('QUOTE_REQUEST');
    expect(lead.status).toBe('QUALIFIED');
    expect(lead.destination).toBe('Punta Cana');
    expect(lead.paxAdults).toBe(2);
    expect(lead.score).toBeCloseTo(0.82);

    // El contacto quedo tipificado como AGENCY
    const contact = await prisma.contact.findUnique({ where: { id: identity.contactId } });
    expect(contact?.customerType).toBe('AGENCY');

    // Tarea creada para el asesor
    const task = await prisma.task.findFirst({ where: { leadId: lead.id } });
    expect(task?.title).toContain('Aprobar respuesta sugerida');

    // Respuesta sugerida en PENDING_APPROVAL (Autonomia L0: nada se envia solo)
    expect(reply.status).toBe('PENDING_APPROVAL');
    const outboundBefore = await prisma.message.count({
      where: { conversationId: conversation.id, direction: 'OUTBOUND' },
    });
    expect(outboundBefore).toBe(0);

    // AgentRun auditado con humanReviewRequired = true
    const run = await prisma.agentRun.findUnique({ where: { id: reply.agentRunId ?? '' } });
    expect(run?.humanReviewRequired).toBe(true);
    expect(run?.modelProvider).toBe('stub');

    // Aprobar: recien aqui se "envia" y queda el mensaje OUTBOUND
    const res = await request(app.getHttpServer())
      .post(`/approvals/${reply.id}/approve`)
      .send({ approvedBy: 'mabel', editedBody: 'Hola Ana, ya estamos preparando tu cotizacion.' })
      .expect(201);
    expect(res.body.status).toBe('SENT');
    expect(res.body.approvedBy).toBe('mabel');

    const outbound = await prisma.message.findFirst({
      where: { conversationId: conversation.id, direction: 'OUTBOUND' },
    });
    expect(outbound?.body).toBe('Hola Ana, ya estamos preparando tu cotizacion.');

    // No se puede aprobar dos veces
    await request(app.getHttpServer())
      .post(`/approvals/${reply.id}/approve`)
      .send({ approvedBy: 'mabel' })
      .expect(400);
  });

  it('gate duro: respuesta con cifras escala el lead aunque el agente no lo pida', async () => {
    const sessionId = `e2e-${randomUUID()}`;
    stub.nextOutput = {
      ...FIXTURE_OUTPUT,
      suggestedReply: 'El paquete a Punta Cana cuesta USD 1.500 por persona.',
      escalateToHuman: false,
    };

    await request(app.getHttpServer())
      .post('/webhooks/webchat')
      .set('x-webhook-secret', 'test-secret')
      .send({ sessionId, name: 'Luis', message: 'Cuanto vale Punta Cana?' })
      .expect(200);

    const identity = await waitFor(() =>
      prisma.channelIdentity.findUnique({
        where: { channel_externalId: { channel: 'WEBCHAT', externalId: sessionId } },
      }),
    );
    const lead = await waitFor(() =>
      prisma.lead.findFirst({ where: { contactId: identity.contactId } }),
    );

    // El gate anti-cifras vive en codigo: el lead queda ESCALATED y la tarea lo refleja
    expect(lead.status).toBe('ESCALATED');
    const task = await waitFor(() =>
      prisma.task.findFirst({ where: { leadId: lead.id, title: { contains: 'ESCALADO' } } }),
    );
    expect(task.description).toContain('cifras');
  });
});
