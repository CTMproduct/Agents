import { Injectable } from '@nestjs/common';
import { ChannelType, CustomerType, LeadIntent, LeadStatus, MessageDirection, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NormalizedChannelEvent } from '../channels/types';

/**
 * CRM Core: guarda la verdad. Sin IA adentro.
 */
@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Resuelve (o crea) el contacto a partir de la identidad de canal. */
  async resolveContact(event: NormalizedChannelEvent, traceId: string) {
    const existing = await this.prisma.channelIdentity.findUnique({
      where: { channel_externalId: { channel: event.channel, externalId: event.externalId } },
      include: { contact: true },
    });
    if (existing) return existing.contact;

    const contact = await this.prisma.contact.create({
      data: {
        fullName: event.displayName ?? null,
        channelIdentities: {
          create: { channel: event.channel, externalId: event.externalId },
        },
        // Consentimiento implicito por mensaje entrante (revisar segun politica de datos)
        consents: {
          create: { channel: event.channel, granted: true, source: 'inbound_message' },
        },
      },
    });
    await this.audit.log({
      eventType: 'contact.created',
      actor: 'system',
      entity: 'Contact',
      entityId: contact.id,
      traceId,
    });
    return contact;
  }

  /** Encuentra la conversacion abierta de ese contacto/canal o crea una nueva. */
  async resolveConversation(contactId: string, channel: ChannelType, traceId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { contactId, channel },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;
    const conv = await this.prisma.conversation.create({ data: { contactId, channel } });
    await this.audit.log({
      eventType: 'conversation.created',
      actor: 'system',
      entity: 'Conversation',
      entityId: conv.id,
      traceId,
    });
    return conv;
  }

  async saveInboundMessage(conversationId: string, event: NormalizedChannelEvent) {
    return this.prisma.message.create({
      data: {
        conversationId,
        direction: MessageDirection.INBOUND,
        channel: event.channel,
        body: event.body,
        externalId: event.externalMessageId ?? null,
        rawPayload: event.rawPayload as Prisma.InputJsonValue,
      },
    });
  }

  async getRecentMessages(conversationId: string, take = 20) {
    const msgs = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return msgs.reverse();
  }

  /** Crea o actualiza el lead abierto del contacto con los campos extraidos por el agente. */
  async upsertLead(
    contactId: string,
    data: {
      intent: LeadIntent;
      customerType: CustomerType;
      destination?: string | null;
      travelDateFrom?: Date | null;
      travelDateTo?: Date | null;
      paxAdults?: number | null;
      paxChildren?: number | null;
      budgetAmount?: number | null;
      budgetCurrency?: string | null;
      score?: number | null;
      scoreReason?: string | null;
      escalate: boolean;
    },
    traceId: string,
  ) {
    // Actualiza el customerType del contacto si el agente lo detecto
    if (data.customerType !== CustomerType.UNKNOWN) {
      await this.prisma.contact.update({
        where: { id: contactId },
        data: { customerType: data.customerType },
      });
    }

    const open = await this.prisma.lead.findFirst({
      where: { contactId, status: { in: [LeadStatus.NEW, LeadStatus.QUALIFIED, LeadStatus.IN_PROGRESS] } },
      orderBy: { updatedAt: 'desc' },
    });

    const fields = {
      intent: data.intent,
      destination: data.destination ?? undefined,
      travelDateFrom: data.travelDateFrom ?? undefined,
      travelDateTo: data.travelDateTo ?? undefined,
      paxAdults: data.paxAdults ?? undefined,
      paxChildren: data.paxChildren ?? undefined,
      budgetAmount: data.budgetAmount ?? undefined,
      budgetCurrency: data.budgetCurrency ?? undefined,
      score: data.score ?? undefined,
      scoreReason: data.scoreReason ?? undefined,
      status: data.escalate ? LeadStatus.ESCALATED : LeadStatus.QUALIFIED,
    };

    const lead = open
      ? await this.prisma.lead.update({ where: { id: open.id }, data: fields })
      : await this.prisma.lead.create({ data: { contactId, ...fields } });

    await this.audit.log({
      eventType: open ? 'lead.updated' : 'lead.created',
      actor: 'system',
      entity: 'Lead',
      entityId: lead.id,
      payload: { intent: data.intent, score: data.score, escalate: data.escalate },
      traceId,
    });
    return lead;
  }

  async createTask(leadId: string, title: string, description: string, traceId: string) {
    const task = await this.prisma.task.create({ data: { leadId, title, description } });
    await this.audit.log({
      eventType: 'task.created',
      actor: 'system',
      entity: 'Task',
      entityId: task.id,
      traceId,
    });
    return task;
  }
}
