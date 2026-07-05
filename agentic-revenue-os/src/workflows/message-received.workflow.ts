import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CustomerType, LeadIntent, MessageDirection, SuggestedReplyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../crm/crm.service';
import { IntakeAgentService } from '../agents/intake-agent.service';
import { AgentRunnerService } from '../agents/agent-runner.service';
import { containsMoneyFigures } from '../agents/schemas';
import { NormalizedChannelEvent } from '../channels/types';

/**
 * Que agente especializado atiende cada intencion. Es la unica pieza de
 * "routing" del sistema: una tabla de datos, no logica de agente. Agregar un
 * agente nuevo (ej. "retention") es una fila en AgentDefinition + una entrada
 * aqui -- nunca tocar el prompt o el comportamiento de otro agente.
 */
const INTENT_AGENT_ROUTE: Partial<Record<LeadIntent, string>> = {
  QUOTE_REQUEST: 'sales',
  READY_TO_BOOK: 'closing',
  COMPLAINT: 'support',
  POST_SALE: 'support',
};

/**
 * Pipeline Fase 1+ (Autonomia L0):
 * mensaje -> contacto -> conversacion -> IntakeAgent (clasifica + extrae)
 *   -> agente especializado opcional (ventas/soporte/cierre, por intent)
 *   -> lead + tarea -> respuesta sugerida PENDIENTE DE APROBACION HUMANA -> auditoria.
 * Nada se envia al cliente sin aprobacion. El gate anti-cifras aplica a
 * cualquier agente que toque la respuesta sugerida, no solo al intake.
 */
@Injectable()
export class MessageReceivedWorkflow {
  private readonly logger = new Logger(MessageReceivedWorkflow.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crm: CrmService,
    private readonly intake: IntakeAgentService,
    private readonly specialized: AgentRunnerService,
    private readonly audit: AuditService,
  ) {}

  @OnEvent('message.received', { async: true })
  async handle({ event, traceId }: { event: NormalizedChannelEvent; traceId: string }) {
    try {
      // 1. Identidad y persistencia
      const contact = await this.crm.resolveContact(event, traceId);
      const conversation = await this.crm.resolveConversation(contact.id, event.channel, traceId);
      const message = await this.crm.saveInboundMessage(conversation.id, event);
      await this.audit.log({
        eventType: 'message.received',
        actor: 'system',
        entity: 'Message',
        entityId: message.id,
        traceId,
      });

      // 2. Contexto conversacional
      const history = await this.crm.getRecentMessages(conversation.id);
      const conversationText = history
        .map((m) => `${m.direction === MessageDirection.INBOUND ? 'CLIENTE' : 'CTM'}: ${m.body}`)
        .join('\n');

      // 3. Agente de intake (una sola llamada, output validado)
      const result = await this.intake.run({ conversationText, traceId });
      const o = result.output;

      // 4. Lead + score
      const lead = await this.crm.upsertLead(
        contact.id,
        {
          intent: o.intent as LeadIntent,
          customerType: o.customerType as CustomerType,
          destination: o.destination,
          travelDateFrom: o.travelDateFrom ? new Date(o.travelDateFrom) : null,
          travelDateTo: o.travelDateTo ? new Date(o.travelDateTo) : null,
          paxAdults: o.paxAdults,
          paxChildren: o.paxChildren,
          budgetAmount: o.budgetAmount,
          budgetCurrency: o.budgetCurrency,
          score: o.score,
          scoreReason: o.scoreReason,
          escalate: result.gateReasons.length > 0,
        },
        traceId,
      );

      // 5. Agente especializado segun intencion (ventas/soporte/cierre). Es
      // aditivo: si no hay ruta o el agente falla, el flujo sigue con el
      // borrador del intake -- nunca bloquea el pipeline base.
      let replyBody = o.suggestedReply;
      let specializedGateReasons: string[] = [];
      const routeKey = INTENT_AGENT_ROUTE[o.intent as LeadIntent];
      if (routeKey) {
        try {
          const specializedResult = await this.specialized.run(routeKey, {
            conversationText,
            contactId: contact.id,
            leadId: lead.id,
            traceId,
          });
          if (specializedResult?.text) {
            if (containsMoneyFigures(specializedResult.text)) {
              specializedGateReasons.push(`agente '${routeKey}' incluyo cifras: reemplazado por borrador seguro`);
            } else {
              replyBody = specializedResult.text;
            }
          }
        } catch (e) {
          this.logger.warn(`Agente especializado '${routeKey}' fallo, sigue con borrador de intake: ${(e as Error).message}`);
        }
      }
      const allGateReasons = [...result.gateReasons, ...specializedGateReasons];

      // 6. Tarea para el asesor
      const taskTitle =
        allGateReasons.length > 0
          ? `ESCALADO: revisar lead (${o.intent})`
          : `Aprobar respuesta sugerida (score ${(o.score * 100).toFixed(0)}%)`;
      await this.crm.createTask(
        lead.id,
        taskTitle,
        `Motivos: ${allGateReasons.join('; ') || 'flujo normal L0'}. Trace: ${traceId}`,
        traceId,
      );

      // 7. Respuesta sugerida: SIEMPRE pendiente en Fase 1
      await this.prisma.suggestedReply.create({
        data: {
          conversationId: conversation.id,
          body: replyBody,
          status: SuggestedReplyStatus.PENDING_APPROVAL,
          agentRunId: result.agentRunId,
        },
      });

      this.logger.log(`Pipeline OK trace=${traceId} lead=${lead.id} route=${routeKey ?? 'ninguna'}`);
    } catch (e) {
      this.logger.error(`Pipeline fallo trace=${traceId}: ${(e as Error).message}`);
      await this.audit.log({
        eventType: 'workflow.message_received.failed',
        actor: 'system',
        payload: { error: (e as Error).message },
        traceId,
      });
    }
  }
}
