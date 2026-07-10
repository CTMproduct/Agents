import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LlmProvider } from './llm.provider';
import { ToolRegistry, ToolContext } from './tools/tool-registry';

export interface AgentRunnerInput {
  conversationText: string;
  contactId: string;
  leadId?: string | null;
  traceId: string;
}

export interface AgentRunnerResult {
  agentRunId: string;
  text: string;
  toolCalls: number;
}

interface ExecuteAgenticParams {
  agentName: string;
  systemPrompt: string;
  toolKeys: string[];
  conversationText: string;
  ctx: ToolContext;
  tenantId?: string | null;
  /** LLM propio del agente; null = default de la plataforma. */
  modelName?: string | null;
  auditPayload: Record<string, unknown>;
}

/**
 * Ejecutor generico: cualquier agente (AgentDefinition interno de CTM o
 * TenantAgent de una empresa del marketplace) corre por el mismo motor.
 * No hay routing hardcodeado a un agente: el llamador pasa la config,
 * este servicio resuelve herramientas desde el ToolRegistry y audita la
 * corrida bajo el nombre propio del agente para que el dashboard de
 * costos la muestre como entidad independiente.
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmProvider,
    private readonly tools: ToolRegistry,
    private readonly audit: AuditService,
  ) {}

  /** Agente interno de CTM (ventas/soporte/cierre), definido en AgentDefinition. */
  async run(definitionKey: string, input: AgentRunnerInput): Promise<AgentRunnerResult | null> {
    const definition = await this.prisma.agentDefinition.findUnique({ where: { key: definitionKey } });
    if (!definition || !definition.active) {
      this.logger.warn(`AgentDefinition '${definitionKey}' no existe o esta inactiva`);
      return null;
    }
    return this.executeAgentic({
      agentName: definition.name,
      systemPrompt: definition.systemPrompt,
      toolKeys: definition.toolKeys,
      conversationText: input.conversationText,
      ctx: { contactId: input.contactId, leadId: input.leadId, traceId: input.traceId },
      modelName: definition.modelName,
      auditPayload: { definitionKey },
    });
  }

  /**
   * Agente de un tenant del marketplace (TenantAgent). Solo usa conectores
   * marketplacePublic. El system prompt final se compone del skill principal
   * + los skills .md adicionales activos (en orden). Si el agente tiene
   * documentos de knowledge, la herramienta agent_knowledge se habilita sola.
   */
  async runTenantAgent(
    tenantAgentId: string,
    tenantId: string,
    input: { conversationText: string; traceId: string },
  ): Promise<AgentRunnerResult | null> {
    const agent = await this.prisma.tenantAgent.findFirst({
      where: { id: tenantAgentId, tenantId },
      include: {
        skills: { where: { active: true }, orderBy: { position: 'asc' } },
        unlockedSkills: { include: { skillNode: true }, orderBy: { unlockedAt: 'asc' } },
        _count: { select: { knowledge: { where: { active: true } } } },
      },
    });
    if (!agent || !agent.active) {
      this.logger.warn(`TenantAgent '${tenantAgentId}' no existe, no es de este tenant, o esta inactivo`);
      return null;
    }

    const composedPrompt = [
      agent.skillMd,
      // Habilidades .md libres (Learning Loops) + habilidades del arbol de maestrias desbloqueadas.
      ...agent.skills.map((s) => `\n\n<!-- skill: ${s.name} -->\n${s.contentMd}`),
      ...agent.unlockedSkills.map((u) => `\n\n<!-- habilidad ${u.skillNode.code}: ${u.skillNode.name} -->\n${u.skillNode.skillMd}`),
    ].join('');

    const safeToolKeys = this.tools.filterMarketplacePublic(agent.toolKeys);
    if (agent._count.knowledge > 0 && !safeToolKeys.includes('agent_knowledge')) {
      safeToolKeys.push('agent_knowledge');
    }

    return this.executeAgentic({
      agentName: `[${tenantId.slice(0, 8)}] ${agent.name}`,
      systemPrompt: composedPrompt,
      toolKeys: safeToolKeys,
      conversationText: input.conversationText,
      ctx: { traceId: input.traceId, tenantAgentId },
      tenantId,
      modelName: agent.modelName,
      auditPayload: { tenantAgentId, skillCount: agent.skills.length, knowledgeDocs: agent._count.knowledge },
    });
  }

  private async executeAgentic(p: ExecuteAgenticParams): Promise<AgentRunnerResult> {
    const clientTools = this.tools.resolveClientTools(p.toolKeys);
    const serverTools = this.tools.resolveServerTools(p.toolKeys);

    const resp = await this.llm.runAgentic({
      system: p.systemPrompt,
      user: `Conversacion (el ultimo mensaje es el mas reciente):\n\n${p.conversationText}`,
      model: p.modelName,
      tools: clientTools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      serverTools: serverTools.map((t) => ({ anthropicType: t.anthropicType, anthropicName: t.anthropicName })),
      executeTool: async (name, toolInput) => {
        const tool = clientTools.find((t) => t.name === name);
        if (!tool) return { error: `Herramienta desconocida: ${name}` };
        try {
          return await tool.execute(toolInput, p.ctx);
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
    });

    const run = await this.prisma.agentRun.create({
      data: {
        agentName: p.agentName,
        modelProvider: this.llm.providerName,
        modelName: resp.modelName,
        inputSummary: p.conversationText.slice(0, 500),
        outputJson: { text: resp.text, toolCalls: resp.toolCalls } as unknown as Prisma.InputJsonValue,
        latencyMs: resp.latencyMs,
        inputTokens: resp.inputTokens,
        outputTokens: resp.outputTokens,
        confidenceScore: null,
        humanReviewRequired: true,
        traceId: p.ctx.traceId,
        tenantId: p.tenantId ?? null,
      },
    });

    await this.audit.log({
      eventType: 'agent.run.completed',
      actor: `agent:${p.agentName}`,
      entity: 'AgentRun',
      entityId: run.id,
      payload: { ...p.auditPayload, toolCalls: resp.toolCalls.map((c) => c.name) },
      traceId: p.ctx.traceId,
    });

    this.logger.log(`run=${run.id} agent=${p.agentName} tools=${resp.toolCalls.length}`);
    return { agentRunId: run.id, text: resp.text, toolCalls: resp.toolCalls.length };
  }
}
