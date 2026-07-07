import { BadRequestException, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProposalStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { LearningLoopService } from './learning-loop.service';

/** Learning loops por agente: correr analisis, listar y decidir propuestas. */
@Controller('learning')
@UseGuards(AuthGuard)
export class LearningController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loop: LearningLoopService,
  ) {}

  private tenantOf(user: JwtPayload): string {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    return user.tenantId;
  }

  /** Corre el loop de aprendizaje para un agente (analiza decisiones humanas recientes). */
  @Roles(UserRole.TENANT_ADMIN)
  @Post('agents/:agentId/run')
  async runLoop(@Param('agentId') agentId: string, @CurrentUser() user: JwtPayload) {
    try {
      return await this.loop.run(agentId, this.tenantOf(user));
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Get('proposals')
  proposals(@CurrentUser() user: JwtPayload) {
    return this.prisma.agentSkillProposal.findMany({
      where: { tenantId: this.tenantOf(user) },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Post('proposals/:id/approve')
  async approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      return await this.loop.approve(id, this.tenantOf(user), user.email);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Post('proposals/:id/reject')
  async reject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      return await this.loop.reject(id, this.tenantOf(user), user.email);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
}
