import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma, WorkflowStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { WorkflowEngineService, WorkflowNode, WorkflowEdge } from './workflow-engine.service';

const VALID_NODE_TYPES = new Set([
  'trigger.manual',
  'trigger.webhook',
  'agent.run',
  'condition.if',
  'human.approval',
  'webhook.response',
]);

/**
 * Automation Studio: workflows visuales por tenant. El webhook publico
 * (POST /automations/webhook/:publicId) permite conectar formularios,
 * WhatsApp, CRMs o cualquier API externa sin exponer credenciales.
 */
@Controller('automations')
export class AutomationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
  ) {}

  private tenantOf(user: JwtPayload): string {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    return user.tenantId;
  }

  private validateGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
    if (!Array.isArray(nodes) || !nodes.length) throw new BadRequestException('El workflow necesita al menos un nodo');
    const triggers = nodes.filter((n) => n.type.startsWith('trigger.'));
    if (triggers.length !== 1) throw new BadRequestException('El workflow debe tener exactamente un trigger');
    for (const n of nodes) {
      if (!VALID_NODE_TYPES.has(n.type)) throw new BadRequestException(`Tipo de nodo no soportado: ${n.type}`);
    }
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges ?? []) {
      if (!ids.has(e.source) || !ids.has(e.target)) throw new BadRequestException('Edge apunta a un nodo inexistente');
    }
  }

  @Get('workflows')
  @UseGuards(AuthGuard)
  list(@CurrentUser() user: JwtPayload) {
    return this.prisma.automationWorkflow.findMany({
      where: { tenantId: this.tenantOf(user) },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, name: true, description: true, status: true, triggerType: true,
        publicId: true, lastRunAt: true, version: true, tenantAgentId: true, updatedAt: true,
      },
    });
  }

  @Post('workflows')
  @UseGuards(AuthGuard)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; description?: string; tenantAgentId?: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  ) {
    const tenantId = this.tenantOf(user);
    if (!body?.name) throw new BadRequestException('name es obligatorio');
    this.validateGraph(body.nodes, body.edges ?? []);
    const triggerType = body.nodes.find((n) => n.type.startsWith('trigger.'))!.type.split('.')[1];
    if (body.tenantAgentId) {
      const agent = await this.prisma.tenantAgent.findFirst({ where: { id: body.tenantAgentId, tenantId } });
      if (!agent) throw new BadRequestException('El agente asignado no pertenece a tu empresa');
    }
    return this.prisma.automationWorkflow.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description ?? null,
        tenantAgentId: body.tenantAgentId ?? null,
        triggerType,
        nodes: body.nodes as unknown as Prisma.InputJsonValue,
        edges: (body.edges ?? []) as unknown as Prisma.InputJsonValue,
        publicId: triggerType === 'webhook' ? `wh_${randomUUID().replace(/-/g, '')}` : null,
      },
    });
  }

  @Get('workflows/:id')
  @UseGuards(AuthGuard)
  async get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const wf = await this.prisma.automationWorkflow.findFirst({ where: { id, tenantId: this.tenantOf(user) } });
    if (!wf) throw new BadRequestException('Workflow no encontrado');
    return wf;
  }

  @Patch('workflows/:id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { name?: string; description?: string; tenantAgentId?: string | null; nodes?: WorkflowNode[]; edges?: WorkflowEdge[]; status?: string },
  ) {
    const tenantId = this.tenantOf(user);
    const wf = await this.prisma.automationWorkflow.findFirst({ where: { id, tenantId } });
    if (!wf) throw new BadRequestException('Workflow no encontrado');

    let triggerType: string | undefined;
    let publicId: string | null | undefined;
    if (body.nodes) {
      this.validateGraph(body.nodes, body.edges ?? (wf.edges as unknown as WorkflowEdge[]));
      triggerType = body.nodes.find((n) => n.type.startsWith('trigger.'))!.type.split('.')[1];
      publicId = triggerType === 'webhook' ? (wf.publicId ?? `wh_${randomUUID().replace(/-/g, '')}`) : null;
    }
    if (body.status && !Object.values(WorkflowStatus).includes(body.status as WorkflowStatus)) {
      throw new BadRequestException(`status invalido: ${body.status}`);
    }
    return this.prisma.automationWorkflow.update({
      where: { id: wf.id },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        tenantAgentId: body.tenantAgentId === undefined ? undefined : body.tenantAgentId,
        nodes: body.nodes ? (body.nodes as unknown as Prisma.InputJsonValue) : undefined,
        edges: body.edges ? (body.edges as unknown as Prisma.InputJsonValue) : undefined,
        status: (body.status as WorkflowStatus) ?? undefined,
        triggerType,
        publicId,
        version: body.nodes ? { increment: 1 } : undefined,
      },
    });
  }

  @Delete('workflows/:id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const wf = await this.prisma.automationWorkflow.findFirst({ where: { id, tenantId: this.tenantOf(user) } });
    if (!wf) throw new BadRequestException('Workflow no encontrado');
    await this.prisma.automationWorkflow.delete({ where: { id: wf.id } });
    return { ok: true };
  }

  /** Ejecucion manual (boton "Probar"). */
  @Post('workflows/:id/execute')
  @UseGuards(AuthGuard)
  async execute(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { input?: Record<string, unknown> },
  ) {
    const tenantId = this.tenantOf(user);
    const { executionId } = await this.engine.execute(id, tenantId, body?.input ?? {});
    return this.prisma.automationExecution.findUnique({ where: { id: executionId } });
  }

  @Get('workflows/:id/executions')
  @UseGuards(AuthGuard)
  async executions(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const tenantId = this.tenantOf(user);
    const wf = await this.prisma.automationWorkflow.findFirst({ where: { id, tenantId } });
    if (!wf) throw new BadRequestException('Workflow no encontrado');
    return this.prisma.automationExecution.findMany({
      where: { workflowId: wf.id },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });
  }

  /**
   * Webhook publico: activa el workflow desde cualquier sistema externo.
   * Sin JWT (el publicId es no adivinable); solo workflows ACTIVE responden.
   * Si el flujo termina de forma sincrona con webhook.response, devuelve ese texto.
   */
  @Post('webhook/:publicId')
  async webhook(@Param('publicId') publicId: string, @Body() payload: Record<string, unknown>) {
    const wf = await this.prisma.automationWorkflow.findUnique({ where: { publicId } });
    if (!wf || wf.status !== WorkflowStatus.ACTIVE) throw new NotFoundException('Webhook no disponible');
    const { executionId } = await this.engine.execute(wf.id, wf.tenantId, payload ?? {});
    const execution = await this.prisma.automationExecution.findUnique({ where: { id: executionId } });
    return {
      executionId,
      status: execution?.status,
      response: (execution?.output as { text?: string } | null)?.text ?? null,
    };
  }
}
