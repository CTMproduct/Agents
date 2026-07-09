import { z } from 'zod';

/**
 * Contrato estructurado que ambos agentes deben devolver en una batalla
 * PACKAGE_ASSEMBLY. (Ajuste A de la guia: el ZIP lo importaba desde
 * ../agents/schemas/package-schema, que no existia; vive aqui, junto a la Arena.)
 * Regla de la casa: sin tarifas inventadas -- los precios se validan con humano.
 */
// Validacion tolerante: es una batalla de comparacion, no un gate comercial.
// Se exige lo minimo (titulo + resumen) y se coerce/normaliza el resto para que
// modelos reales -- incluso con agentes cuyo skill no es de turismo -- no tumben
// la batalla por un campo faltante. El humano igual revisa la salida cruda.
export const PackageProposalSchema = z.object({
  titulo: z.string().min(1).describe('Nombre comercial del paquete'),
  destino: z.string().default('').describe('Destino principal'),
  noches: z.coerce.number().int().min(0).max(120).catch(0),
  resumen: z.string().min(1).describe('Resumen vendedor del paquete, 2-4 frases, sin precios'),
  incluye: z.array(z.string()).default([]),
  noIncluye: z.array(z.string()).default([]),
  publicoIdeal: z.string().default('').describe('Para quien es ideal este paquete'),
  siguientePaso: z.string().default('').describe('Que debe validar el asesor humano antes de cotizar'),
});

export type PackageProposal = z.infer<typeof PackageProposalSchema>;

/**
 * JSON Schema explicito para el tool_use (mismo patron que src/agents/zod-to-json-schema.ts:
 * se mantiene a mano para evitar el choque de versiones de zod con zod-to-json-schema).
 */
export const PackageProposalJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Nombre comercial del paquete' },
    destino: { type: 'string' },
    noches: { type: 'integer', minimum: 1, maximum: 60 },
    resumen: { type: 'string', description: 'Resumen vendedor, 2-4 frases, sin precios' },
    incluye: { type: 'array', items: { type: 'string' }, minItems: 1 },
    noIncluye: { type: 'array', items: { type: 'string' } },
    publicoIdeal: { type: 'string', description: 'Para quien es ideal este paquete' },
    siguientePaso: { type: 'string', description: 'Que debe validar el asesor humano antes de cotizar' },
  },
  required: ['titulo', 'resumen'],
};
