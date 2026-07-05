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

/**
 * Ejecutor generico: cualquier AgentDefinition (ventas, soporte, cierre, el que
 * se agregue despues) corre por aqui. No hay routing hardcodeado a un agente:
 * el llamador pasa la key, este servicio resuelve prompt + herramientas desde
 * la base de datos y el ToolRegistry, y audita la corrida bajo su propio nombre
 * para que el dashboard de costos la muestre como agente independiente.
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

  async run(definitionKey: string, input: AgentRunnerInput): Promise<AgentRunnerResult | null> {
    const definition = await this.prisma.agentDefinition.findUnique({ where: { key: definitionKey } });
    if (!definition || !definition.active) {
      this.logger.warn(`AgentDefinition '${definitionKey}' no existe o esta inactiva`);
      return null;
    }

    const clientTools = this.tools.resolveClientTools(definition.toolKeys);
    const serverTools = this.tools.resolveServerTools(definition.toolKeys);
    const ctx: ToolContext = { contactId: input.contactId, leadId: input.leadId, traceId: input.traceId };

    const resp = await this.llm.runAgentic({
      system: definition.systemPrompt,
      user: `Conversacion (el ultimo mensaje es el mas reciente):\n\n${input.conversationText}`,
      tools: clientTools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      serverTools: serverTools.map((t) => ({ anthropicType: t.anthropicType, anthropicName: t.anthropicName })),
      executeTool: async (name, toolInput) => {
        const tool = clientTools.find((t) => t.name === name);
        if (!tool) return { error: `Herramienta desconocida: ${name}` };
        try {
          return await tool.execute(toolInput, ctx);
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
    });

    const run = await this.prisma.agentRun.create({
      data: {
        agentName: definition.name,
        modelProvider: this.llm.providerName,
        modelName: resp.modelName,
        inputSummary: input.conversationText.slice(0, 500),
        outputJson: { text: resp.text, toolCalls: resp.toolCalls } as unknown as Prisma.InputJsonValue,
        latencyMs: resp.latencyMs,
        inputTokens: resp.inputTokens,
        outputTokens: resp.outputTokens,
        confidenceScore: null,
        humanReviewRequired: true,
        traceId: input.traceId,
      },
    });

    await this.audit.log({
      eventType: 'agent.run.completed',
      actor: `agent:${definition.name}`,
      entity: 'AgentRun',
      entityId: run.id,
      payload: { definitionKey, toolCalls: resp.toolCalls.map((c) => c.name) },
      traceId: input.traceId,
    });

    this.logger.log(`run=${run.id} agent=${definition.name} tools=${resp.toolCalls.length}`);
    return { agentRunId: run.id, text: resp.text, toolCalls: resp.toolCalls.length };
  }
}
