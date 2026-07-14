import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Rank {
  tier: string;
  division: number;
}

/**
 * Traduce el ELO numerico (aburrido) a un tier emocional estilo LoL. Un usuario
 * pelea por llegar a "Oro" o "Diamante", no por subir 50 puntos de ELO.
 * Funcion pura y exportada: la Arena la usa al recalcular ELO (sin acoplar modulos).
 *
 * Sub-tiers (IRON..DIAMOND): 6 bandas de 200 ELO desde 1000 (cubren 1000..2199),
 * con 4 divisiones (IV..I). Apex (MASTER/GRANDMASTER/CHALLENGER): sin division.
 * Los umbrales apex arrancan en 2200 para que DIAMOND (2000..2199) sea alcanzable.
 */
export function eloToTier(elo: number): Rank {
  if (elo >= 2800) return { tier: 'CHALLENGER', division: 1 };
  if (elo >= 2600) return { tier: 'GRANDMASTER', division: 1 };
  if (elo >= 2200) return { tier: 'MASTER', division: 1 };
  const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
  const adjusted = Math.max(0, elo - 1000);
  const index = Math.min(5, Math.floor(adjusted / 200));
  const within = adjusted % 200;
  const division = Math.min(4, Math.max(1, 4 - Math.floor(within / 50)));
  return { tier: tiers[index], division };
}

const num = (v: unknown): number => Number(v ?? 0);

@Injectable()
export class RankedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ROI verificado: el agente propone, un HUMANO verifica el trato ganado. Solo
   * esto sube al dashboard de C-Level (el LLM nunca inventa revenue).
   */
  async attributeRevenue(tenantId: string, tenantAgentId: string, amountUsd: number, verifiedBy: string, source = 'deal_won') {
    if (!(amountUsd > 0)) throw new BadRequestException('amountUsd debe ser mayor a 0');
    const agent = await this.prisma.tenantAgent.findFirst({ where: { id: tenantAgentId, tenantId } });
    if (!agent) throw new NotFoundException('Agente no encontrado en tu empresa');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [attribution] = await this.prisma.$transaction([
      this.prisma.revenueAttribution.create({ data: { tenantId, tenantAgentId, amountUsd, source, verifiedBy } }),
      this.prisma.agentProfile.upsert({
        where: { tenantId_agentId: { tenantId, agentId: tenantAgentId } },
        create: { tenantId, agentId: tenantAgentId, alias: agent.name, revenueGenerated: amountUsd },
        update: { revenueGenerated: { increment: amountUsd } },
      }),
      this.prisma.agentDailyMetric.upsert({
        where: { tenantAgentId_date: { tenantAgentId, date: today } },
        create: { tenantId, tenantAgentId, date: today, revenueAttributed: amountUsd },
        update: { revenueAttributed: { increment: amountUsd } },
      }),
    ]);

    return { ok: true, attributionId: attribution.id, amountUsd, tenantAgentId };
  }

  /**
   * Dashboard de impacto: consolida el costo de inferencia (burn rate) contra el
   * revenue verificado (ROI), la tasa de alucinacion y el churn neto. Ventana en dias.
   */
  async impactMetrics(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const agg = await this.prisma.agentDailyMetric.aggregate({
      where: { tenantId, date: { gte: since } },
      _sum: {
        costUsd: true,
        revenueAttributed: true,
        runs: true,
        conversations: true,
        hallucinations: true,
        escalations: true,
        churnPrevented: true,
        churnCaused: true,
      },
    });

    const costUsd = num(agg._sum.costUsd);
    const revenueAttributed = num(agg._sum.revenueAttributed);
    const conversations = num(agg._sum.conversations);
    const runs = num(agg._sum.runs);
    const hallucinations = num(agg._sum.hallucinations);
    const escalations = num(agg._sum.escalations);
    const churnPrevented = num(agg._sum.churnPrevented);
    const churnCaused = num(agg._sum.churnCaused);
    const base = conversations || runs; // denominador de tasas

    return {
      windowDays: days,
      revenueAttributed,
      costUsd,
      burnRate: costUsd, // gasto de inferencia en la ventana
      roi: costUsd > 0 ? revenueAttributed / costUsd : 0,
      conversations: base,
      hallucinations,
      hallucinationRate: base > 0 ? hallucinations / base : 0,
      escalations,
      autonomyRate: base > 0 ? 1 - escalations / base : 0,
      churnPrevented,
      churnCaused,
      churnNet: churnPrevented - churnCaused,
    };
  }
}
