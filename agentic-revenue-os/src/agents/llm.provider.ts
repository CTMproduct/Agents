import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmStructuredRequest {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  maxTokens?: number;
}

export interface LlmStructuredResponse {
  json: unknown;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Un solo proveedor (Anthropic), detras de una interfaz delgada.
 * La abstraccion multi-LLM se gana con el segundo caso de uso real, no antes.
 */
@Injectable()
export class LlmProvider {
  readonly providerName = 'anthropic';
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
      if (!apiKey) throw new Error('Falta ANTHROPIC_API_KEY en .env');
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  /** Salida estructurada forzando tool_use con el schema como contrato. */
  async generateStructured(req: LlmStructuredRequest): Promise<LlmStructuredResponse> {
    const model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
    const started = Date.now();
    const resp = await this.getClient().messages.create({
      model,
      max_tokens: req.maxTokens ?? 1500,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
      tools: [
        {
          name: req.toolName,
          description: req.toolDescription,
          input_schema: req.inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: req.toolName },
    });
    const latencyMs = Date.now() - started;
    const toolUse = resp.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('El modelo no devolvio tool_use estructurado');
    }
    return {
      json: toolUse.input,
      modelName: model,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      latencyMs,
    };
  }
}
