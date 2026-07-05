import { BadRequestException, Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { LeadStatus, SuggestedReplyStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { runCostUsd } from './llm-pricing';

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

  /**
   * Metricas de la plataforma agentica: costo por agente/modelo (tokens -> USD),
   * efectividad comercial (conversion, ticket, bruta/neta), SLA y calidad de respuestas.
   * Todo sale de datos reales (AgentRun, Lead, Message, SuggestedReply, AuditEvent).
   */
  @Get('metrics')
  async metrics() {
    const copPerUsd = Number(process.env.COP_PER_USD ?? 4100);

    const [runs, leads, replyGroups, editedSent, slaRows] = await Promise.all([
      this.prisma.agentRun.findMany({
        select: {
          agentName: true,
          modelProvider: true,
          modelName: true,
          inputTokens: true,
          outputTokens: true,
          latencyMs: true,
          confidenceScore: true,
          humanReviewRequired: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      this.prisma.lead.findMany({
        select: { status: true, budgetAmount: true, budgetCurrency: true, score: true },
      }),
      this.prisma.suggestedReply.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.auditEvent.count({
        where: { eventType: 'reply.approved_and_sent', payload: { path: ['edited'], equals: true } },
      }),
      this.prisma.$queryRaw<Array<{ avg_seconds: number | null; measured: bigint }>>`
        SELECT AVG(EXTRACT(EPOCH FROM (o.first_out - i.first_in))) AS avg_seconds,
               COUNT(*) AS measured
        FROM (SELECT "conversationId", MIN("createdAt") AS first_in
              FROM "Message" WHERE direction = 'INBOUND' GROUP BY 1) i
        JOIN (SELECT "conversationId", MIN("createdAt") AS first_out
              FROM "Message" WHERE direction = 'OUTBOUND' GROUP BY 1) o
        USING ("conversationId")`,
    ]);

    // --- Costos y desempeño por agente y por modelo ---
    type Agg = {
      runs: number; inTok: number; outTok: number; costUsd: number;
      latencySum: number; confSum: number; confN: number; humanReview: number;
    };
    const emptyAgg = (): Agg => ({ runs: 0, inTok: 0, outTok: 0, costUsd: 0, latencySum: 0, confSum: 0, confN: 0, humanReview: 0 });
    const byAgent = new Map<string, Agg & { models: Set<string> }>();
    const byModel = new Map<string, Agg & { provider: string }>();
    const byDay = new Map<string, { runs: number; costUsd: number }>();

    for (const r of runs) {
      const cost = runCostUsd(r.modelName, r.inputTokens ?? 0, r.outputTokens ?? 0);
      const add = (a: Agg) => {
        a.runs++; a.inTok += r.inputTokens ?? 0; a.outTok += r.outputTokens ?? 0;
        a.costUsd += cost; a.latencySum += r.latencyMs;
        if (r.confidenceScore != null) { a.confSum += r.confidenceScore; a.confN++; }
        if (r.humanReviewRequired) a.humanReview++;
      };
      const ag = byAgent.get(r.agentName) ?? { ...emptyAgg(), models: new Set<string>() };
      add(ag); ag.models.add(r.modelName); byAgent.set(r.agentName, ag);
      const mk = `${r.modelProvider}/${r.modelName}`;
      const mg = byModel.get(mk) ?? { ...emptyAgg(), provider: r.modelProvider };
      add(mg); byModel.set(mk, mg);
      const day = r.createdAt.toISOString().slice(0, 10);
      const d = byDay.get(day) ?? { runs: 0, costUsd: 0 };
      d.runs++; d.costUsd += cost; byDay.set(day, d);
    }

    const finishAgg = (a: Agg) => ({
      runs: a.runs,
      inputTokens: a.inTok,
      outputTokens: a.outTok,
      costUsd: Number(a.costUsd.toFixed(4)),
      avgLatencyMs: a.runs ? Math.round(a.latencySum / a.runs) : null,
      avgConfidence: a.confN ? Number((a.confSum / a.confN).toFixed(3)) : null,
      humanReviewPct: a.runs ? Number(((a.humanReview / a.runs) * 100).toFixed(1)) : null,
    });

    // --- Negocio: pipeline, conversion, ticket, bruta/neta ---
    const sumBudget = (rows: typeof leads) => {
      const acc: Record<string, number> = {};
      for (const l of rows) {
        if (l.budgetAmount == null) continue;
        const cur = l.budgetCurrency ?? 'COP';
        acc[cur] = (acc[cur] ?? 0) + Number(l.budgetAmount);
      }
      return acc;
    };
    const won = leads.filter((l) => l.status === LeadStatus.WON);
    const openStatuses: LeadStatus[] = [
      LeadStatus.NEW, LeadStatus.QUALIFIED, LeadStatus.IN_PROGRESS, LeadStatus.ESCALATED,
    ];
    const open = leads.filter((l) => openStatuses.includes(l.status));
    const grossWon = sumBudget(won);
    const wonWithBudget = won.filter((l) => l.budgetAmount != null);
    const totalCostUsd = [...byModel.values()].reduce((s, m) => s + m.costUsd, 0);
    const netCopEstimate = (grossWon['COP'] ?? 0) - totalCostUsd * copPerUsd;

    // --- Calidad de respuestas (eficiencia del agente medida por humanos) ---
    const rc: Record<string, number> = {};
    for (const g of replyGroups) rc[g.status] = g._count._all;
    const sent = rc['SENT'] ?? 0;
    const rejected = rc['REJECTED'] ?? 0;

    const days: Array<{ date: string; runs: number; costUsd: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const v = byDay.get(d) ?? { runs: 0, costUsd: 0 };
      days.push({ date: d, runs: v.runs, costUsd: Number(v.costUsd.toFixed(4)) });
    }

    return {
      business: {
        totalLeads: leads.length,
        won: won.length,
        lost: leads.filter((l) => l.status === LeadStatus.LOST).length,
        escalated: leads.filter((l) => l.status === LeadStatus.ESCALATED).length,
        conversionPct: leads.length ? Number(((won.length / leads.length) * 100).toFixed(1)) : 0,
        pipelineByCurrency: sumBudget(open),
        grossWonByCurrency: grossWon,
        avgTicketByCurrency: Object.fromEntries(
          Object.entries(grossWon).map(([c, v]) => [
            c,
            Math.round(v / Math.max(1, wonWithBudget.filter((l) => (l.budgetCurrency ?? 'COP') === c).length)),
          ]),
        ),
        netCopEstimate: Math.round(netCopEstimate),
        copPerUsd,
        avgScore: (() => {
          const s = leads.filter((l) => l.score != null);
          return s.length ? Number((s.reduce((a, l) => a + (l.score ?? 0), 0) / s.length).toFixed(2)) : null;
        })(),
      },
      ai: {
        totalRuns: runs.length,
        totalInputTokens: [...byModel.values()].reduce((s, m) => s + m.inTok, 0),
        totalOutputTokens: [...byModel.values()].reduce((s, m) => s + m.outTok, 0),
        totalCostUsd: Number(totalCostUsd.toFixed(4)),
        days,
      },
      sla: {
        avgFirstResponseSeconds: slaRows[0]?.avg_seconds != null ? Math.round(Number(slaRows[0].avg_seconds)) : null,
        conversationsMeasured: Number(slaRows[0]?.measured ?? 0),
      },
      replies: {
        pending: rc['PENDING_APPROVAL'] ?? 0,
        sent,
        rejected,
        editedSent,
        approvalRatePct: sent + rejected ? Number(((sent / (sent + rejected)) * 100).toFixed(1)) : null,
        editRatePct: sent ? Number(((editedSent / sent) * 100).toFixed(1)) : null,
      },
      agents: [...byAgent.entries()].map(([name, a]) => ({
        agentName: name,
        models: [...a.models],
        ...finishAgg(a),
      })),
      models: [...byModel.entries()].map(([key, m]) => ({
        provider: m.provider,
        modelName: key.split('/').slice(1).join('/'),
        ...finishAgg(m),
      })),
    };
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
