import { Controller, ForbiddenException, Get, Param, UseGuards } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { runCostUsd } from '../crm/llm-pricing';

function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Metricas de decision por tenant (Fase Metrics & Decision Intelligence):
 * no solo numeros -- cada agente recibe un Autonomy Readiness Score y una
 * recomendacion accionable (subir autonomia / mejorar prompt / revisar costo).
 * Se calcula al vuelo desde PendingReview + AgentRun (sin tablas duplicadas).
 */
@Controller('metrics')
@UseGuards(AuthGuard)
export class DecisionMetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('decision')
  async decision(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    const tenantId = user.tenantId;

    const [agents, reviews, runs] = await Promise.all([
      this.prisma.tenantAgent.findMany({ where: { tenantId }, select: { id: true, name: true, modelName: true } }),
      this.prisma.pendingReview.findMany({
        where: { tenantId },
        select: { tenantAgentId: true, status: true },
      }),
      this.prisma.agentRun.findMany({
        where: { tenantId },
        select: { agentName: true, modelName: true, inputTokens: true, outputTokens: true, latencyMs: true },
        take: 5000,
      }),
    ]);

    // Costo/latencia por agente: los runs de tenant llevan agentName "[tenantPrefix] Nombre".
    const runAgg = new Map<string, { runs: number; costUsd: number; latencySum: number }>();
    for (const r of runs) {
      const name = r.agentName.replace(/^\[[^\]]+\]\s*/, '');
      const agg = runAgg.get(name) ?? { runs: 0, costUsd: 0, latencySum: 0 };
      agg.runs++;
      agg.costUsd += runCostUsd(r.modelName, r.inputTokens ?? 0, r.outputTokens ?? 0);
      agg.latencySum += r.latencyMs;
      runAgg.set(name, agg);
    }

    const perAgent = agents.map((a) => {
      const mine = reviews.filter((r) => r.tenantAgentId === a.id);
      const approved = mine.filter((r) => r.status === ReviewStatus.APPROVED).length;
      const edited = mine.filter((r) => r.status === ReviewStatus.EDITED).length;
      const rejected = mine.filter((r) => r.status === ReviewStatus.REJECTED).length;
      const escalated = mine.filter((r) => r.status === ReviewStatus.ESCALATED).length;
      const pending = mine.filter((r) => r.status === ReviewStatus.PENDING).length;
      const reviewed = approved + edited + rejected;

      const approvalRate = reviewed ? (approved + edited) / reviewed : null;
      const editRate = reviewed ? edited / reviewed : null;
      const rejectionRate = reviewed ? rejected / reviewed : null;
      // Autonomy Readiness (0-100): aprueban mucho, editan poco, rechazan casi nada.
      const readiness =
        approvalRate == null
          ? null
          : Math.max(0, Math.round(100 * (approvalRate - (editRate ?? 0) * 0.5 - (rejectionRate ?? 0))));

      let recommendation: string;
      if (reviewed < 5) recommendation = 'Aún faltan decisiones humanas para evaluar: sigue operando en L0.';
      else if ((approvalRate ?? 0) >= 0.9 && (editRate ?? 1) <= 0.1)
        recommendation = 'Listo para considerar más autonomía (L1): alta aprobación y poca edición.';
      else if ((approvalRate ?? 0) < 0.7)
        recommendation = 'Mejorar el skill: la tasa de aprobación es baja. Corre el Learning Loop.';
      else if ((editRate ?? 0) > 0.3)
        recommendation = 'Los humanos editan mucho: revisa las propuestas del Learning Loop.';
      else recommendation = 'Desempeño estable: mantener en L0 y seguir midiendo.';

      const agg = runAgg.get(a.name);
      return {
        agentId: a.id,
        agentName: a.name,
        modelName: a.modelName,
        reviewed,
        pending,
        approved,
        edited,
        rejected,
        escalated,
        approvalRatePct: approvalRate != null ? Number((approvalRate * 100).toFixed(1)) : null,
        editRatePct: editRate != null ? Number((editRate * 100).toFixed(1)) : null,
        autonomyReadiness: readiness,
        runs: agg?.runs ?? 0,
        costUsd: agg ? Number(agg.costUsd.toFixed(4)) : 0,
        costPerRunUsd: agg?.runs ? Number((agg.costUsd / agg.runs).toFixed(4)) : null,
        avgLatencyMs: agg?.runs ? Math.round(agg.latencySum / agg.runs) : null,
        recommendation,
      };
    });

    // Snapshot del dia de hoy en AgentDailyMetric (base para tendencias / ROI).
    const date = todayUtc();
    await Promise.all(
      perAgent.map((a) =>
        this.prisma.agentDailyMetric.upsert({
          where: { tenantAgentId_date: { tenantAgentId: a.agentId, date } },
          update: {
            runs: a.runs,
            approvals: a.approved,
            rejections: a.rejected,
            edits: a.edited,
            escalations: a.escalated,
            costUsd: new Prisma.Decimal(a.costUsd),
            avgLatencyMs: a.avgLatencyMs ?? 0,
          },
          create: {
            tenantId,
            tenantAgentId: a.agentId,
            date,
            runs: a.runs,
            approvals: a.approved,
            rejections: a.rejected,
            edits: a.edited,
            escalations: a.escalated,
            costUsd: new Prisma.Decimal(a.costUsd),
            avgLatencyMs: a.avgLatencyMs ?? 0,
          },
        }),
      ),
    );

    return { agents: perAgent };
  }

  /** Tendencia diaria de un agente (ultimos 30 dias) desde AgentDailyMetric. */
  @Get('daily/:agentId')
  async daily(@Param('agentId') agentId: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    const agent = await this.prisma.tenantAgent.findFirst({
      where: { id: agentId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!agent) throw new ForbiddenException('Agente no encontrado en tu empresa');
    const rows = await this.prisma.agentDailyMetric.findMany({
      where: { tenantAgentId: agentId },
      orderBy: { date: 'desc' },
      take: 30,
    });
    return rows
      .reverse()
      .map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        runs: r.runs,
        approvals: r.approvals,
        edits: r.edits,
        rejections: r.rejections,
        costUsd: Number(r.costUsd),
        avgLatencyMs: r.avgLatencyMs,
      }));
  }
}
