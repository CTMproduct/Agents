import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { HeroesService } from './heroes.service';
import { SkillTreeService } from './skill-tree.service';

/**
 * Heroes y arbol de maestrias. El catalogo es publico (para la pantalla de
 * seleccion); asignar heroe y desbloquear skills es tenant-scoped y con RBAC.
 */
@Controller('heroes')
@UseGuards(AuthGuard)
export class HeroesController {
  constructor(
    private readonly heroes: HeroesService,
    private readonly skillTree: SkillTreeService,
  ) {}

  private tenantOf(user: JwtPayload): string {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    return user.tenantId;
  }

  /** GET /heroes — catalogo global de campeones. */
  @Get()
  catalog() {
    return this.heroes.catalog();
  }

  /** POST /heroes/agents/:agentId/assign { heroId } — elige campeon para el agente. */
  @Post('agents/:agentId/assign')
  @Roles(UserRole.TENANT_ADMIN)
  assign(@CurrentUser() user: JwtPayload, @Param('agentId') agentId: string, @Body() body: { heroId?: string }) {
    const tenantId = this.tenantOf(user);
    if (!body?.heroId) throw new BadRequestException('heroId es obligatorio');
    return this.heroes.assignHero(tenantId, agentId, body.heroId);
  }

  /** GET /heroes/agents/:agentId/skill-tree — arbol + nodos desbloqueados + XP. */
  @Get('agents/:agentId/skill-tree')
  tree(@CurrentUser() user: JwtPayload, @Param('agentId') agentId: string) {
    const tenantId = this.tenantOf(user);
    return this.skillTree.treeForAgent(tenantId, agentId);
  }

  /** POST /heroes/agents/:agentId/skills/:skillNodeId/unlock — gasta XP y desbloquea. */
  @Post('agents/:agentId/skills/:skillNodeId/unlock')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_MEMBER)
  unlock(@CurrentUser() user: JwtPayload, @Param('agentId') agentId: string, @Param('skillNodeId') skillNodeId: string) {
    const tenantId = this.tenantOf(user);
    return this.skillTree.unlockSkill(tenantId, agentId, skillNodeId);
  }
}
