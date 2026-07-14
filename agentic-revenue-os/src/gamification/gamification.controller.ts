import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { RankedService } from './ranked.service';

/**
 * Gamificacion y metricas de negocio. La atribucion de revenue es una accion
 * humana (verificacion); las metricas de impacto son de solo lectura.
 */
@Controller()
@UseGuards(AuthGuard)
export class GamificationController {
  constructor(private readonly ranked: RankedService) {}

  private tenantOf(user: JwtPayload): string {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    return user.tenantId;
  }

  /** POST /revenue/attribute { agentId, amountUsd, source? } — un humano verifica un trato ganado. */
  @Post('revenue/attribute')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_REVIEWER)
  attribute(@CurrentUser() user: JwtPayload, @Body() body: { agentId?: string; amountUsd?: number; source?: string }) {
    const tenantId = this.tenantOf(user);
    if (!body?.agentId) throw new BadRequestException('agentId es obligatorio');
    const amount = Number(body.amountUsd);
    if (!(amount > 0)) throw new BadRequestException('amountUsd debe ser un número mayor a 0');
    return this.ranked.attributeRevenue(tenantId, body.agentId, amount, user.sub, body.source);
  }

  /** GET /metrics/impact?days=30 — ROI, burn rate, alucinación y churn neto. */
  @Get('metrics/impact')
  impact(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    const tenantId = this.tenantOf(user);
    const d = Math.min(365, Math.max(1, Number(days) || 30));
    return this.ranked.impactMetrics(tenantId, d);
  }
}
