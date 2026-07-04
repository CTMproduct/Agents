import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { zodToJsonSchema } from './zod-to-json-schema';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LlmProvider } from './llm.provider';
import { INTAKE_SYSTEM_PROMPT } from './intake-agent.prompt';
import { applyHardGates, IntakeOutput, IntakeOutputSchema } from './schemas';

export interface IntakeAgentResult {
  output: IntakeOutput;
  humanReviewRequired: boolean;
  gateReasons: string[];
  agentRunId: string;
}

@Injectable()
export class IntakeAgentService {
  private readonly logger = new Logger(IntakeAgentService.name);
  readonly agentName = 'IntakeAgent';

  constructor(
    private readonly llm: LlmProvider,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async run(input: {
    conversationText: string;
    traceId: string;
  }): Promise<IntakeAgentResult> {
    const threshold = Number(this.config.get('CONFIDENCE_THRESHOLD') ?? 0.75);
    const system = INTAKE_SYSTEM_PROMPT.replace(
      '{{TODAY}}',
      new Date().toISOString().slice(0, 10),
    );

    const resp = await this.llm.generateStructured({
      system,
      user: `Conversacion (el ultimo mensaje es el mas reciente):\n\n${input.conversationText}`,
      toolName: 'registrar_analisis_intake',
      toolDescription:
        'Registra el analisis estructurado del lead turistico. Usar SIEMPRE esta herramienta.',
      inputSchema: zodToJsonSchema(),
    });

    // Validacion estricta: si el JSON no cumple el contrato, el run falla y escala.
    const parsed = IntakeOutputSchema.safeParse(resp.json);
    if (!parsed.success) {
      await this.audit.log({
        eventType: 'agent.run.invalid_output',
        actor: `agent:${this.agentName}`,
        payload: { errors: parsed.error.issues.slice(0, 5) } as unknown as Prisma.InputJsonValue,
        traceId: input.traceId,
      });
      throw new Error(`Output del agente no valida con el schema: ${parsed.error.message}`);
    }

    const gated = applyHardGates(parsed.data, threshold);

    const run = await this.prisma.agentRun.create({
      data: {
        agentName: this.agentName,
        modelProvider: this.llm.providerName,
        modelName: resp.modelName,
        inputSummary: input.conversationText.slice(0, 500),
        outputJson: gated.output as unknown as Prisma.InputJsonValue,
        latencyMs: resp.latencyMs,
        inputTokens: resp.inputTokens,
        outputTokens: resp.outputTokens,
        confidenceScore: gated.output.confidence,
        humanReviewRequired: gated.humanReviewRequired,
        traceId: input.traceId,
      },
    });

    await this.audit.log({
      eventType: 'agent.run.completed',
      actor: `agent:${this.agentName}`,
      entity: 'AgentRun',
      entityId: run.id,
      payload: {
        intent: gated.output.intent,
        confidence: gated.output.confidence,
        gateReasons: gated.gateReasons,
      },
      traceId: input.traceId,
    });

    this.logger.log(
      `run=${run.id} intent=${gated.output.intent} conf=${gated.output.confidence} gates=[${gated.gateReasons.join('; ')}]`,
    );

    return { ...gated, agentRunId: run.id };
  }
}
