import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, Roles } from '../auth/auth.guard';

/** Panel del administrador de la plataforma (tu cuenta): visibilidad de TODOS los tenants. */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tenants')
  async tenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, agents: true } } },
    });
    return tenants;
  }

  @Get('tenant-agents')
  tenantAgents() {
    return this.prisma.tenantAgent.findMany({
      include: { tenant: { select: { name: true, slug: true } }, template: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** Costo/uso agregado de los agentes del marketplace (tenantId no nulo), agrupado por tenant. */
  @Get('usage')
  async usage() {
    const runs = await this.prisma.agentRun.findMany({
      where: { tenantId: { not: null } },
      select: { tenantId: true, agentName: true, inputTokens: true, outputTokens: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });
    const nameOf = new Map(tenants.map((t) => [t.id, t.name]));

    const byTenant = new Map<string, { runs: number; inputTokens: number; outputTokens: number }>();
    for (const r of runs) {
      const key = r.tenantId as string;
      const agg = byTenant.get(key) ?? { runs: 0, inputTokens: 0, outputTokens: 0 };
      agg.runs++;
      agg.inputTokens += r.inputTokens ?? 0;
      agg.outputTokens += r.outputTokens ?? 0;
      byTenant.set(key, agg);
    }
    return [...byTenant.entries()].map(([tenantId, agg]) => ({
      tenantId,
      tenantName: nameOf.get(tenantId) ?? '(eliminado)',
      ...agg,
    }));
  }
}
