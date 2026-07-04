/**
 * JSON Schema explicito del contrato IntakeOutput para tool_use de Anthropic.
 * Se mantiene a mano y en sincronia con schemas.ts (el test de contrato lo verifica).
 */
export function zodToJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['INFORMATION', 'QUOTE_REQUEST', 'READY_TO_BOOK', 'POST_SALE', 'COMPLAINT', 'UNKNOWN'],
      },
      customerType: {
        type: 'string',
        enum: ['DIRECT_CLIENT', 'AGENCY', 'FREELANCER', 'CORPORATE', 'GROUP', 'UNKNOWN'],
      },
      destination: { type: ['string', 'null'] },
      travelDateFrom: { type: ['string', 'null'], description: 'ISO 8601 (YYYY-MM-DD) o null' },
      travelDateTo: { type: ['string', 'null'] },
      paxAdults: { type: ['integer', 'null'], minimum: 0 },
      paxChildren: { type: ['integer', 'null'], minimum: 0 },
      budgetAmount: { type: ['number', 'null'], minimum: 0 },
      budgetCurrency: { type: ['string', 'null'], description: 'ISO 4217, ej. COP, USD' },
      score: { type: 'number', minimum: 0, maximum: 1 },
      scoreReason: { type: 'string' },
      suggestedReply: { type: 'string', description: 'Respuesta en espanol, sin precios ni disponibilidad' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      escalateToHuman: { type: 'boolean' },
      escalationReason: { type: ['string', 'null'] },
    },
    required: [
      'intent', 'customerType', 'destination', 'travelDateFrom', 'travelDateTo',
      'paxAdults', 'paxChildren', 'budgetAmount', 'budgetCurrency',
      'score', 'scoreReason', 'suggestedReply', 'confidence',
      'escalateToHuman', 'escalationReason',
    ],
  };
}
