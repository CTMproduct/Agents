/**
 * Precios por millon de tokens (USD). Fuente: tarifas publicadas de cada proveedor.
 * Se usa el primer prefijo que coincida con el modelName del AgentRun.
 * claude-sonnet-5 tiene precio intro $2/$10 hasta 2026-08-31; aqui se usa lista.
 */
const PRICES: Array<{ prefix: string; inPerM: number; outPerM: number }> = [
  { prefix: 'claude-fable-5', inPerM: 10, outPerM: 50 },
  { prefix: 'claude-opus-4', inPerM: 5, outPerM: 25 },
  { prefix: 'claude-sonnet-5', inPerM: 3, outPerM: 15 },
  { prefix: 'claude-sonnet-4', inPerM: 3, outPerM: 15 },
  { prefix: 'claude-haiku-4', inPerM: 1, outPerM: 5 },
  { prefix: 'gpt-4o-mini', inPerM: 0.15, outPerM: 0.6 },
  { prefix: 'gpt-4o', inPerM: 2.5, outPerM: 10 },
  { prefix: 'gpt-4.1-mini', inPerM: 0.4, outPerM: 1.6 },
  { prefix: 'gpt-4.1', inPerM: 2, outPerM: 8 },
  { prefix: 'stub', inPerM: 0, outPerM: 0 },
];

export function runCostUsd(modelName: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES.find((x) => modelName.startsWith(x.prefix));
  if (!p) return 0;
  return (inputTokens * p.inPerM + outputTokens * p.outPerM) / 1_000_000;
}

/**
 * Catalogo de LLMs que un agente puede tener asignado. Es la lista blanca
 * que valida el backend: un agente solo puede conectarse a uno de estos.
 * La disponibilidad real depende de que la key del proveedor este configurada.
 */
export interface CatalogModel {
  model: string;
  provider: 'anthropic' | 'openai';
  label: string;
  inPerM: number;
  outPerM: number;
  tier: 'rapido' | 'balanceado' | 'maximo';
}

export const MODEL_CATALOG: CatalogModel[] = [
  { model: 'claude-haiku-4-5', provider: 'anthropic', label: 'Claude Haiku 4.5 — rápido y económico', inPerM: 1, outPerM: 5, tier: 'rapido' },
  { model: 'claude-sonnet-5', provider: 'anthropic', label: 'Claude Sonnet 5 — balanceado (recomendado)', inPerM: 3, outPerM: 15, tier: 'balanceado' },
  { model: 'claude-opus-4-8', provider: 'anthropic', label: 'Claude Opus 4.8 — máxima capacidad', inPerM: 5, outPerM: 25, tier: 'maximo' },
  { model: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o mini — rápido y económico', inPerM: 0.15, outPerM: 0.6, tier: 'rapido' },
  { model: 'gpt-4o', provider: 'openai', label: 'GPT-4o — balanceado', inPerM: 2.5, outPerM: 10, tier: 'balanceado' },
];
