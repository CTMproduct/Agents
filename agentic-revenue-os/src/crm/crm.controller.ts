import { BadRequestException, Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { LeadStatus, SuggestedReplyStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** Endpoints de lectura para el equipo + cambios de estado del pipeline (sin IA adentro). */
@Controller('crm')
export class CrmController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('leads')
  leads(@Query('status') status?: string) {
    return this.prisma.lead.findMany({
      where: status ? { status: status as never } : undefined,
      include: { contact: true, tasks: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  /** Cambio de etapa desde el tablero (drag & drop). Todo cambio queda auditado. */
  @Patch('leads/:id/status')
  async updateLeadStatus(
    @Param('id') id: string,
    @Body() body: { status: string; updatedBy?: string },
  ) {
    if (!body?.status || !Object.values(LeadStatus).includes(body.status as LeadStatus)) {
      throw new BadRequestException(`status invalido: ${body?.status}`);
    }
    const lead = await this.prisma.lead.update({
      where: { id },
      data: { status: body.status as LeadStatus },
    });
    await this.audit.log({
      eventType: 'lead.status_changed',
      actor: body.updatedBy ? `user:${body.updatedBy}` : 'user:anonimo',
      entity: 'Lead',
      entityId: id,
      payload: { status: body.status },
      traceId: randomUUID(),
    });
    return lead;
  }

  @Get('conversations')
  conversations() {
    return this.prisma.conversation.findMany({
      include: {
        contact: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  @Get('conversations/:id')
  conversation(@Param('id') id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: 'asc' } },
        suggestedReplies: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  @Get('agent-runs')
  agentRuns() {
    return this.prisma.agentRun.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /** Resumen para el panel de control. */
  @Get('stats')
  async stats() {
    const [byStatus, agentAgg, conversations, messages, pendingApprovals, contacts] =
      await Promise.all([
        this.prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.agentRun.aggregate({
          _count: { _all: true },
          _avg: { confidenceScore: true, latencyMs: true },
        }),
        this.prisma.conversation.count(),
        this.prisma.message.count(),
        this.prisma.suggestedReply.count({
          where: { status: SuggestedReplyStatus.PENDING_APPROVAL },
        }),
        this.prisma.contact.count(),
      ]);

    const leadsByStatus: Record<string, number> = {};
    for (const s of Object.values(LeadStatus)) leadsByStatus[s] = 0;
    for (const row of byStatus) leadsByStatus[row.status] = row._count._all;

    return {
      leadsByStatus,
      totalLeads: byStatus.reduce((a, r) => a + r._count._all, 0),
      contacts,
      conversations,
      messages,
      pendingApprovals,
      agentRuns: agentAgg._count._all,
      avgConfidence: agentAgg._avg.confidenceScore,
      avgLatencyMs: agentAgg._avg.latencyMs,
    };
  }
}
