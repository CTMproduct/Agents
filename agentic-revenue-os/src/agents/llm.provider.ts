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

export interface AgenticToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Herramienta ejecutada por el proveedor (ej. web_search de Anthropic), no por nuestro codigo. */
export interface AgenticServerToolSpec {
  anthropicType: string;
  anthropicName: string;
}

export interface AgenticRequest {
  system: string;
  user: string;
  tools: AgenticToolSpec[];
  serverTools?: AgenticServerToolSpec[];
  executeTool: (name: string, input: Record<string, unknown>) => Promise<unknown>;
  maxIterations?: number;
  maxTokens?: number;
}

export interface AgenticToolCallTrace {
  name: string;
  input: unknown;
  output: unknown;
}

export interface AgenticResponse {
  text: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  toolCalls: AgenticToolCallTrace[];
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

  /**
   * Bucle agentico con herramientas (cliente + servidor). Usado por agentes
   * especializados (ventas/soporte/cierre) que necesitan consultar conectores
   * antes de responder. Acotado por maxIterations para controlar costo/latencia.
   */
  async runAgentic(req: AgenticRequest): Promise<AgenticResponse> {
    if (this.providerName === 'anthropic') return this.runAgenticAnthropic(req);
    return this.runAgenticOpenAi(req);
  }

  private async runAgenticAnthropic(req: AgenticRequest): Promise<AgenticResponse> {
    if (!this.anthropic) {
      this.anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') });
    }
    const model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
    const maxIterations = req.maxIterations ?? 4;
    const toolCalls: AgenticToolCallTrace[] = [];
    const tools: Anthropic.Tool[] = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));
    const serverTools = (req.serverTools ?? []).map((t) => ({
      type: t.anthropicType,
      name: t.anthropicName,
    })) as unknown as Anthropic.Tool[];

    let messages: Anthropic.MessageParam[] = [{ role: 'user', content: req.user }];
    let inputTokens = 0;
    let outputTokens = 0;
    const started = Date.now();

    for (let i = 0; i < maxIterations; i++) {
      const resp = await this.anthropic.messages.create({
        model,
        max_tokens: req.maxTokens ?? 1500,
        system: req.system,
        messages,
        tools: [...tools, ...serverTools],
      });
      inputTokens += resp.usage.input_tokens;
      outputTokens += resp.usage.output_tokens;

      // 'pause_turn' (continuacion de herramientas de servidor) no esta tipado en
      // esta version del SDK; se compara como string por si la API ya lo emite.
      if ((resp.stop_reason as string) === 'pause_turn') {
        messages = [...messages, { role: 'assistant', content: resp.content }];
        continue;
      }

      const clientToolUses = resp.content.filter(
        (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && req.tools.some((t) => t.name === c.name),
      );
      const textBlocks = resp.content.filter((c): c is Anthropic.TextBlock => c.type === 'text');
      const text = textBlocks.map((b) => b.text).join('\n').trim();

      if (clientToolUses.length === 0 || resp.stop_reason !== 'tool_use') {
        return { text, modelName: model, inputTokens, outputTokens, latencyMs: Date.now() - started, toolCalls };
      }

      messages = [...messages, { role: 'assistant', content: resp.content }];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const call of clientToolUses) {
        const input = call.input as Record<string, unknown>;
        const output = await req.executeTool(call.name, input);
        toolCalls.push({ name: call.name, input, output });
        toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(output) });
      }
      messages = [...messages, { role: 'user', content: toolResults }];
    }
    return {
      text: '',
      modelName: model,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - started,
      toolCalls,
    };
  }

  private async runAgenticOpenAi(req: AgenticRequest): Promise<AgenticResponse> {
    if (!this.openai) {
      const apiKey = this.config.get<string>('OPENAI_API_KEY');
      if (!apiKey) throw new Error('Falta ANTHROPIC_API_KEY u OPENAI_API_KEY en .env');
      this.openai = new OpenAI({ apiKey });
    }
    const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    const maxIterations = req.maxIterations ?? 4;
    const toolCalls: AgenticToolCallTrace[] = [];
    const tools: OpenAI.Chat.ChatCompletionTool[] = req.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));

    let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ];
    let inputTokens = 0;
    let outputTokens = 0;
    const started = Date.now();

    for (let i = 0; i < maxIterations; i++) {
      const resp = await this.openai.chat.completions.create({ model, max_tokens: req.maxTokens ?? 1500, messages, tools });
      inputTokens += resp.usage?.prompt_tokens ?? 0;
      outputTokens += resp.usage?.completion_tokens ?? 0;
      const msg = resp.choices[0]?.message;
      const calls = msg?.tool_calls?.filter((c) => c.type === 'function') ?? [];

      if (!calls.length) {
        return {
          text: msg?.content ?? '',
          modelName: model,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - started,
          toolCalls,
        };
      }

      messages = [...messages, msg as OpenAI.Chat.ChatCompletionMessageParam];
      for (const call of calls) {
        const input = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const output = await req.executeTool(call.function.name, input);
        toolCalls.push({ name: call.function.name, input, output });
        messages = [...messages, { role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) }];
      }
    }
    return { text: '', modelName: model, inputTokens, outputTokens, latencyMs: Date.now() - started, toolCalls };
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
