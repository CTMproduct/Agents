import { z } from 'zod';

/**
 * Contrato del IntakeAgent (Fase 1: un solo agente, un solo pipeline).
 * Regla: todo lo que un agente produce sale en JSON validado. Nada de texto libre al CRM.
 */
export const IntakeOutputSchema = z.object({
  intent: z.enum([
    'INFORMATION',
    'QUOTE_REQUEST',
    'READY_TO_BOOK',
    'POST_SALE',
    'COMPLAINT',
    'UNKNOWN',
  ]),
  customerType: z.enum([
    'DIRECT_CLIENT',
    'AGENCY',
    'FREELANCER',
    'CORPORATE',
    'GROUP',
    'UNKNOWN',
  ]),
  destination: z.string().nullable(),
  travelDateFrom: z.string().nullable().describe('ISO 8601 o null'),
  travelDateTo: z.string().nullable(),
  paxAdults: z.number().int().min(0).nullable(),
  paxChildren: z.number().int().min(0).nullable(),
  budgetAmount: z.number().min(0).nullable(),
  budgetCurrency: z.string().length(3).nullable(),
  score: z.number().min(0).max(1).describe('Probabilidad de conversion 0..1'),
  scoreReason: z.string(),
  suggestedReply: z.string().describe('Respuesta sugerida en espanol, tono CTM, sin precios'),
  confidence: z.number().min(0).max(1),
  escalateToHuman: z.boolean(),
  escalationReason: z.string().nullable(),
});

export type IntakeOutput = z.infer<typeof IntakeOutputSchema>;

/**
 * Gates duros EN CODIGO (no en el prompt). El prompt puede fallar; el codigo no negocia.
 * Devuelve el output ajustado + si requiere humano.
 */
export function applyHardGates(
  output: IntakeOutput,
  confidenceThreshold: number,
): { output: IntakeOutput; humanReviewRequired: boolean; gateReasons: string[] } {
  const reasons: string[] = [];

  if (output.confidence < confidenceThreshold) {
    reasons.push(`confidence ${output.confidence} < ${confidenceThreshold}`);
  }
  if (['COMPLAINT', 'POST_SALE', 'READY_TO_BOOK'].includes(output.intent)) {
    reasons.push(`intent ${output.intent} siempre escala a humano`);
  }
  // El agente jamas puede poner cifras/tarifas en la respuesta sugerida.
  const moneyPattern = /(\$|USD|EUR|COP)\s?\d|(\d{1,3}([.,]\d{3})+)/i;
  if (moneyPattern.test(output.suggestedReply)) {
    reasons.push('la respuesta sugerida contiene cifras que parecen tarifa');
    output = { ...output, escalateToHuman: true };
  }
  if (output.escalateToHuman) {
    reasons.push(output.escalationReason ?? 'el propio agente pidio escalar');
  }

  // Fase 1 = Autonomia L0: SIEMPRE requiere humano. Los gates de arriba ademas
  // marcan el lead como ESCALATED para priorizacion.
  return { output, humanReviewRequired: true, gateReasons: reasons };
}
