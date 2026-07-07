import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { LlmProvider } from '../agents/llm.provider';
import { MODEL_CATALOG } from '../crm/llm-pricing';

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
    private readonly llm: LlmProvider,
  ) {}

  /** Devuelve el TenantAgent solo si pertenece al tenant del usuario; si no, 400. */
  private async ownAgent(id: string, user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    const agent = await this.prisma.tenantAgent.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!agent) throw new BadRequestException('Agente no encontrado en tu empresa');
    return agent;
  }

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

  /**
   * Agent Studio guiado: el usuario responde preguntas simples y la plataforma
   * genera el skillMd profesional. El usuario nunca tiene que escribir un prompt.
   * maxTokens acotado para optimizar costo.
   */
  @Post('generate-skill')
  @UseGuards(AuthGuard)
  async generateSkill(
    @CurrentUser() user: JwtPayload,
    @Body() body: { answers: Record<string, string> },
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    const a = body?.answers ?? {};
    if (!a.queHace?.trim()) throw new BadRequestException('Describe al menos qué hace el agente (queHace)');

    const resp = await this.llm.generateStructured({
      system:
        'Eres un experto en diseno de agentes de IA comerciales. A partir de las respuestas del usuario, ' +
        'genera un skill en markdown, en espanol, corto y accionable (max 25 lineas), con secciones: ' +
        '# Rol, # Instrucciones, # Nunca hagas, # Cuando escalar a humano. ' +
        'Incluye SIEMPRE la regla de no inventar precios ni prometer nada sin validacion humana.',
      user: [
        `Que hace el agente: ${a.queHace}`,
        a.tono ? `Tono: ${a.tono}` : '',
        a.puedeProometer || a.puedePrometer ? `Puede prometer: ${a.puedePrometer ?? a.puedeProometer}` : '',
        a.noPuedePrometer ? `NO puede prometer: ${a.noPuedePrometer}` : '',
        a.cuandoEscalar ? `Cuando escalar a humano: ${a.cuandoEscalar}` : '',
        a.reglas ? `Reglas de la empresa: ${a.reglas}` : '',
      ].filter(Boolean).join('\n'),
      toolName: 'registrar_skill',
      toolDescription: 'Registra el skill generado.',
      inputSchema: {
        type: 'object',
        properties: { skillMd: { type: 'string', description: 'Skill completo en markdown' } },
        required: ['skillMd'],
      },
      maxTokens: 900,
    });
    const skillMd = (resp.json as { skillMd?: string })?.skillMd;
    if (!skillMd) throw new BadRequestException('No se pudo generar el skill, intenta de nuevo');
    return { skillMd };
  }

  /** LLMs a los que un agente puede conectarse (solo proveedores con key configurada). */
  @Get('models')
  listModels() {
    const available = this.llm.availableProviders;
    return MODEL_CATALOG.filter((m) => available.includes(m.provider)).map((m) => ({
      ...m,
      priceLabel: `$${m.inPerM}/M in · $${m.outPerM}/M out`,
    }));
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
      include: {
        template: { select: { name: true, key: true } },
        skills: { orderBy: { position: 'asc' } },
        knowledge: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Editar nombre, skill principal, conectores, LLM y estado de un agente propio. */
  @Patch('my-agents/:id')
  @UseGuards(AuthGuard)
  async updateAgent(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { name?: string; skillMd?: string; toolKeys?: string[]; modelName?: string | null; active?: boolean },
  ) {
    const agent = await this.ownAgent(id, user);

    // Versionado de prompts: si cambia el skillMd, la version anterior queda guardada.
    if (body.skillMd !== undefined && body.skillMd !== agent.skillMd) {
      const count = await this.prisma.tenantAgentPromptVersion.count({ where: { tenantAgentId: agent.id } });
      await this.prisma.tenantAgentPromptVersion.create({
        data: { tenantAgentId: agent.id, version: count + 1, skillMd: agent.skillMd, changedBy: user.email },
      });
    }

    let modelName: string | null | undefined = undefined;
    if (body.modelName !== undefined) {
      if (body.modelName === null || body.modelName === '') {
        modelName = null; // volver al modelo por defecto de la plataforma
      } else {
        const available = this.llm.availableProviders;
        const valid = MODEL_CATALOG.some((m) => m.model === body.modelName && available.includes(m.provider));
        if (!valid) throw new BadRequestException(`Modelo no disponible: ${body.modelName}`);
        modelName = body.modelName;
      }
    }

    return this.prisma.tenantAgent.update({
      where: { id: agent.id },
      data: {
        name: body.name ?? undefined,
        skillMd: body.skillMd ?? undefined,
        toolKeys: body.toolKeys ? this.tools.filterMarketplacePublic(body.toolKeys) : undefined,
        modelName,
        active: body.active ?? undefined,
      },
    });
  }

  // ---------- Skills (.md) adicionales del agente ----------

  @Post('my-agents/:id/skills')
  @UseGuards(AuthGuard)
  async addSkill(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; contentMd: string },
  ) {
    const agent = await this.ownAgent(id, user);
    if (!body?.name || !body?.contentMd) throw new BadRequestException('name y contentMd son obligatorios');
    const last = await this.prisma.tenantAgentSkill.findFirst({
      where: { tenantAgentId: agent.id },
      orderBy: { position: 'desc' },
    });
    return this.prisma.tenantAgentSkill.create({
      data: { tenantAgentId: agent.id, name: body.name, contentMd: body.contentMd, position: (last?.position ?? -1) + 1 },
    });
  }

  @Patch('my-agents/:id/skills/:skillId')
  @UseGuards(AuthGuard)
  async updateSkill(
    @Param('id') id: string,
    @Param('skillId') skillId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { name?: string; contentMd?: string; active?: boolean; position?: number },
  ) {
    const agent = await this.ownAgent(id, user);
    const skill = await this.prisma.tenantAgentSkill.findFirst({ where: { id: skillId, tenantAgentId: agent.id } });
    if (!skill) throw new BadRequestException('Skill no encontrado en este agente');
    return this.prisma.tenantAgentSkill.update({
      where: { id: skill.id },
      data: {
        name: body.name ?? undefined,
        contentMd: body.contentMd ?? undefined,
        active: body.active ?? undefined,
        position: body.position ?? undefined,
      },
    });
  }

  @Delete('my-agents/:id/skills/:skillId')
  @UseGuards(AuthGuard)
  async deleteSkill(@Param('id') id: string, @Param('skillId') skillId: string, @CurrentUser() user: JwtPayload) {
    const agent = await this.ownAgent(id, user);
    const skill = await this.prisma.tenantAgentSkill.findFirst({ where: { id: skillId, tenantAgentId: agent.id } });
    if (!skill) throw new BadRequestException('Skill no encontrado en este agente');
    await this.prisma.tenantAgentSkill.delete({ where: { id: skill.id } });
    return { ok: true };
  }

  // ---------- Knowledge base del agente ----------

  @Post('my-agents/:id/knowledge')
  @UseGuards(AuthGuard)
  async addKnowledge(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { title: string; content: string },
  ) {
    const agent = await this.ownAgent(id, user);
    if (!body?.title || !body?.content) throw new BadRequestException('title y content son obligatorios');
    return this.prisma.tenantAgentKnowledge.create({
      data: { tenantAgentId: agent.id, title: body.title, content: body.content },
    });
  }

  @Patch('my-agents/:id/knowledge/:docId')
  @UseGuards(AuthGuard)
  async updateKnowledge(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { title?: string; content?: string; active?: boolean },
  ) {
    const agent = await this.ownAgent(id, user);
    const doc = await this.prisma.tenantAgentKnowledge.findFirst({ where: { id: docId, tenantAgentId: agent.id } });
    if (!doc) throw new BadRequestException('Documento no encontrado en este agente');
    return this.prisma.tenantAgentKnowledge.update({
      where: { id: doc.id },
      data: { title: body.title ?? undefined, content: body.content ?? undefined, active: body.active ?? undefined },
    });
  }

  @Delete('my-agents/:id/knowledge/:docId')
  @UseGuards(AuthGuard)
  async deleteKnowledge(@Param('id') id: string, @Param('docId') docId: string, @CurrentUser() user: JwtPayload) {
    const agent = await this.ownAgent(id, user);
    const doc = await this.prisma.tenantAgentKnowledge.findFirst({ where: { id: docId, tenantAgentId: agent.id } });
    if (!doc) throw new BadRequestException('Documento no encontrado en este agente');
    await this.prisma.tenantAgentKnowledge.delete({ where: { id: doc.id } });
    return { ok: true };
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
