import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
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
 * Un solo proveedor activo, detras de una interfaz delgada.
 * Se elige por la key configurada: ANTHROPIC_API_KEY manda; si no hay,
 * se usa OPENAI_API_KEY (la key que CTM ya tiene en produccion).
 * La abstraccion multi-LLM simultanea se gana con el segundo caso de uso real.
 */
@Injectable()
export class LlmProvider {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  get providerName(): string {
    return this.config.get<string>('ANTHROPIC_API_KEY') ? 'anthropic' : 'openai';
  }

  async generateStructured(req: LlmStructuredRequest): Promise<LlmStructuredResponse> {
    if (this.providerName === 'anthropic') return this.viaAnthropic(req);
    return this.viaOpenAi(req);
  }

  /** Salida estructurada forzando tool_use con el schema como contrato. */
  private async viaAnthropic(req: LlmStructuredRequest): Promise<LlmStructuredResponse> {
    if (!this.anthropic) {
      this.anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') });
    }
    const model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
    const started = Date.now();
    const resp = await this.anthropic.messages.create({
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

  /** Mismo contrato via function calling de OpenAI. */
  private async viaOpenAi(req: LlmStructuredRequest): Promise<LlmStructuredResponse> {
    if (!this.openai) {
      const apiKey = this.config.get<string>('OPENAI_API_KEY');
      if (!apiKey) throw new Error('Falta ANTHROPIC_API_KEY u OPENAI_API_KEY en .env');
      this.openai = new OpenAI({ apiKey });
    }
    const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    const started = Date.now();
    const resp = await this.openai.chat.completions.create({
      model,
      max_tokens: req.maxTokens ?? 1500,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: req.toolName,
            description: req.toolDescription,
            parameters: req.inputSchema,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: req.toolName } },
    });
    const latencyMs = Date.now() - started;
    const call = resp.choices[0]?.message?.tool_calls?.[0];
    if (!call || call.type !== 'function') {
      throw new Error('El modelo no devolvio tool_call estructurado');
    }
    return {
      json: JSON.parse(call.function.arguments),
      modelName: model,
      inputTokens: resp.usage?.prompt_tokens ?? 0,
      outputTokens: resp.usage?.completion_tokens ?? 0,
      latencyMs,
    };
  }
}
