import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ArenaService } from './arena.service';
import { StartBattleSchema, ResolveBattleSchema } from './arena.dto';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

/**
 * Arena Agentica: iniciar batallas entre dos agentes del tenant, revisarlas y
 * declarar ganador. Adaptado al stack de auth de esta plataforma
 * (AuthGuard + @Roles + @CurrentUser en vez de JwtAuthGuard/RolesGuard del ZIP).
 */
@Controller('arena')
@UseGuards(AuthGuard)
export class ArenaController {
  constructor(private readonly arenaService: ArenaService) {}

  private tenantOf(user: JwtPayload): string {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    return user.tenantId;
  }

  @Post('start')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_REVIEWER)
  async startBattle(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const parsed = StartBattleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.arenaService.startBattle({
      tenantId: this.tenantOf(user),
      createdByUserId: user.sub,
      ...parsed.data,
    });
  }

  /** Lista de batallas del tenant (para la vista de Arena). */
  @Get('battles')
  async listBattles(@CurrentUser() user: JwtPayload) {
    return this.arenaService.listBattles(this.tenantOf(user));
  }

  /** Ranking ELO de los agentes del tenant. */
  @Get('leaderboard')
  async leaderboard(@CurrentUser() user: JwtPayload) {
    return this.arenaService.getLeaderboard(this.tenantOf(user));
  }

  @Get(':battleId')
  async getBattle(@Param('battleId') battleId: string, @CurrentUser() user: JwtPayload) {
    return this.arenaService.getBattleOrThrow(this.tenantOf(user), battleId);
  }

  @Post(':battleId/resolve')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_REVIEWER)
  async resolveBattle(
    @Param('battleId') battleId: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
  ) {
    const parsed = ResolveBattleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.arenaService.declareWinner({
      tenantId: this.tenantOf(user),
      battleId,
      winningParticipantId: parsed.data.winningParticipantId,
      decidedBy: user.email,
    });
  }
}
