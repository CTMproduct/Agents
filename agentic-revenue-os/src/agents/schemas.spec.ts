import { applyHardGates, IntakeOutput, IntakeOutputSchema } from './schemas';
import { zodToJsonSchema } from './zod-to-json-schema';

const base: IntakeOutput = {
  intent: 'QUOTE_REQUEST',
  customerType: 'AGENCY',
  destination: 'Punta Cana',
  travelDateFrom: '2026-09-10',
  travelDateTo: '2026-09-15',
  paxAdults: 2,
  paxChildren: 0,
  budgetAmount: null,
  budgetCurrency: null,
  score: 0.9,
  scoreReason: 'fechas y pax definidos',
  suggestedReply: 'Con gusto un asesor te enviara la cotizacion con tarifas vigentes.',
  confidence: 0.92,
  escalateToHuman: false,
  escalationReason: null,
};

describe('IntakeOutputSchema', () => {
  it('acepta un output valido', () => {
    expect(IntakeOutputSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza score fuera de rango', () => {
    expect(IntakeOutputSchema.safeParse({ ...base, score: 1.5 }).success).toBe(false);
  });

  it('el JSON Schema declara los mismos campos requeridos que Zod', () => {
    const js = zodToJsonSchema() as { required: string[] };
    const zodKeys = Object.keys(IntakeOutputSchema.shape).sort();
    expect([...js.required].sort()).toEqual(zodKeys);
  });
});

describe('applyHardGates (gates en codigo, no en prompt)', () => {
  it('Fase 1 = L0: SIEMPRE requiere revision humana', () => {
    const r = applyHardGates(base, 0.75);
    expect(r.humanReviewRequired).toBe(true);
  });

  it('marca gate si confidence < umbral', () => {
    const r = applyHardGates({ ...base, confidence: 0.5 }, 0.75);
    expect(r.gateReasons.some((g) => g.includes('confidence'))).toBe(true);
  });

  it('bloquea respuestas sugeridas que contienen tarifas', () => {
    const r = applyHardGates(
      { ...base, suggestedReply: 'El plan cuesta USD 1.250 por persona' },
      0.75,
    );
    expect(r.output.escalateToHuman).toBe(true);
    expect(r.gateReasons.some((g) => g.includes('tarifa'))).toBe(true);
  });

  it('COMPLAINT siempre escala', () => {
    const r = applyHardGates({ ...base, intent: 'COMPLAINT' }, 0.75);
    expect(r.gateReasons.some((g) => g.includes('COMPLAINT'))).toBe(true);
  });
});
