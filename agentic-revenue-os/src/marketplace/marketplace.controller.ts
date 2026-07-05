import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { AgentRunnerService } from '../agents/agent-runner.service';
import { ToolRegistry } from '../agents/tools/tool-registry';

/**
 * Marketplace de agentes: catalogo publico + agentes activados por cada tenant.
 * Cada empresa (tenant) solo ve y edita SUS PROPIOS TenantAgent -- se filtra
 * siempre por tenantId del usuario autenticado, nunca por un id suelto.
 */
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRunner: AgentRunnerService,
    private readonly tools: ToolRegistry,
  ) {}

  /** Catalogo publico: no requiere login, para que se pueda navegar antes de registrarse. */
  @Get('templates')
  async templates() {
    const templates = await this.prisma.agentTemplate.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      include: { reviews: { select: { rating: true } } },
    });
    return templates.map((t) => {
      const ratingCount = t.reviews.length;
      const avgRating = ratingCount ? t.reviews.reduce((s, r) => s + r.rating, 0) / ratingCount : null;
      const { reviews, ...rest } = t;
      return { ...rest, ratingAvg: avgRating ? Number(avgRating.toFixed(1)) : null, ratingCount };
    });
  }

  @Get('templates/:key/reviews')
  async reviews(@Param('key') key: string) {
    const template = await this.prisma.agentTemplate.findUnique({ where: { key } });
    if (!template) throw new BadRequestException('Plantilla no encontrada');
    return this.prisma.agentReview.findMany({
      where: { templateId: template.id },
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Conectores que un tenant puede habilitar en sus propios agentes. */
  @Get('tools')
  listPublicTools() {
    return this.tools.listMarketplacePublic();
  }

  /** "Probar Gratis": crea una copia editable de la plantilla para el tenant del usuario. */
  @Post('templates/:key/activate')
  @UseGuards(AuthGuard)
  async activate(@Param('key') key: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    const template = await this.prisma.agentTemplate.findUnique({ where: { key } });
    if (!template || !template.active) throw new BadRequestException('Plantilla no disponible');

    return this.prisma.tenantAgent.create({
      data: {
        tenantId: user.tenantId,
        templateId: template.id,
        name: template.name,
        skillMd: template.defaultSkillMd,
        toolKeys: this.tools.filterMarketplacePublic(template.defaultToolKeys),
      },
    });
  }

  /** "Crea el Tuyo": agente 100% personalizado, sin plantilla. */
  @Post('my-agents')
  @UseGuards(AuthGuard)
  async createCustom(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; skillMd: string; toolKeys?: string[] },
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    if (!body?.name || !body?.skillMd) throw new BadRequestException('name y skillMd son obligatorios');
    return this.prisma.tenantAgent.create({
      data: {
        tenantId: user.tenantId,
        name: body.name,
        skillMd: body.skillMd,
        toolKeys: this.tools.filterMarketplacePublic(body.toolKeys ?? []),
      },
    });
  }

  @Get('my-agents')
  @UseGuards(AuthGuard)
  async myAgents(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) return [];
    return this.prisma.tenantAgent.findMany({
      where: { tenantId: user.tenantId },
      include: { template: { select: { name: true, key: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Editar el skill.md y/o los conectores de un agente propio. Muy facil de configurar. */
  @Patch('my-agents/:id')
  @UseGuards(AuthGuard)
  async updateAgent(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { name?: string; skillMd?: string; toolKeys?: string[]; active?: boolean },
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    const agent = await this.prisma.tenantAgent.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!agent) throw new BadRequestException('Agente no encontrado en tu empresa');

    return this.prisma.tenantAgent.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        skillMd: body.skillMd ?? undefined,
        toolKeys: body.toolKeys ? this.tools.filterMarketplacePublic(body.toolKeys) : undefined,
        active: body.active ?? undefined,
      },
    });
  }

  /** Prueba rapida del agente contra un texto de ejemplo (sin webhook real). */
  @Post('my-agents/:id/run')
  @UseGuards(AuthGuard)
  async runAgent(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { conversationText: string },
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    if (!body?.conversationText) throw new BadRequestException('conversationText es obligatorio');
    const result = await this.agentRunner.runTenantAgent(id, user.tenantId, {
      conversationText: body.conversationText,
      traceId: randomUUID(),
    });
    if (!result) throw new BadRequestException('El agente no existe, no es tuyo, o esta inactivo');
    return result;
  }

  /** Calificar una plantilla del catalogo (una calificacion por tenant y plantilla). */
  @Post('templates/:key/review')
  @UseGuards(AuthGuard)
  async review(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { rating: number; comment?: string },
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    if (!body?.rating || body.rating < 1 || body.rating > 5) {
      throw new BadRequestException('rating debe ser 1..5');
    }
    const template = await this.prisma.agentTemplate.findUnique({ where: { key } });
    if (!template) throw new BadRequestException('Plantilla no encontrada');

    return this.prisma.agentReview.upsert({
      where: { tenantId_templateId: { tenantId: user.tenantId, templateId: template.id } },
      update: { rating: body.rating, comment: body.comment ?? null },
      create: { tenantId: user.tenantId, templateId: template.id, rating: body.rating, comment: body.comment ?? null },
    });
  }
}
