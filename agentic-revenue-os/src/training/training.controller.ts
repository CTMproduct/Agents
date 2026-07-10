import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { TrainingService } from './training.service';

/**
 * Training Camp: sandbox de practica + coaching. Todo tenant-scoped: cada empresa
 * solo entrena y ve las memorias de SUS propios agentes.
 */
@Controller('training')
@UseGuards(AuthGuard)
export class TrainingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly training: TrainingService,
  ) {}

  private tenantOf(user: JwtPayload): string {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    return user.tenantId;
  }

  /** POST /training/:agentId/practice { prompt } — corre al agente en sandbox. */
  @Post(':agentId/practice')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_MEMBER)
  async practice(@CurrentUser() user: JwtPayload, @Param('agentId') agentId: string, @Body() body: { prompt?: string }) {
    const tenantId = this.tenantOf(user);
    if (!body?.prompt?.trim()) throw new BadRequestException('prompt es obligatorio');
    return this.training.practice(tenantId, agentId, body.prompt.trim());
  }

  /** GET /training/:agentId/sessions — historial de practica del agente. */
  @Get(':agentId/sessions')
  async sessions(@CurrentUser() user: JwtPayload, @Param('agentId') agentId: string) {
    if (!user.tenantId) return [];
    return this.prisma.trainingSession.findMany({
      where: { tenantId: user.tenantId, tenantAgentId: agentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** POST /training/sessions/:sessionId/coach { coachFeedback, rating } — corrige y enseña. */
  @Post('sessions/:sessionId/coach')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_MEMBER, UserRole.TENANT_REVIEWER)
  async coach(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
    @Body() body: { coachFeedback?: string; rating?: number },
  ) {
    const tenantId = this.tenantOf(user);
    if (!body?.coachFeedback?.trim()) throw new BadRequestException('coachFeedback es obligatorio');
    const rating = Number(body.rating ?? 3);
    return this.training.submitCoaching(tenantId, sessionId, body.coachFeedback.trim(), rating);
  }

  /** GET /training/:agentId/memories — memorias aprendidas por el agente. */
  @Get(':agentId/memories')
  async memories(@CurrentUser() user: JwtPayload, @Param('agentId') agentId: string) {
    if (!user.tenantId) return [];
    return this.prisma.agentMemory.findMany({
      where: { tenantId: user.tenantId, tenantAgentId: agentId },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      select: { id: true, type: true, content: true, importance: true, createdAt: true, lastAccessedAt: true },
    });
  }
}
