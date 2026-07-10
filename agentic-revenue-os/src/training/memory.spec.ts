import { LlmProvider } from '../agents/llm.provider';
import { cosine } from './memory.service';

/**
 * Prueba la mecanica de la memoria semantica con el backend de embeddings 'local'
 * (default sin key). No mide calidad neural, sino que el recall RANKEA: frases
 * parecidas deben quedar mas cerca que frases de otro tema.
 */
describe('Memoria semantica — vectorizador local', () => {
  // ConfigService falso: sin EMBEDDINGS_PROVIDER => usa 'local'.
  const llm = new LlmProvider({ get: () => undefined } as never);

  it('cosine: identicos=1, ortogonales=0, dim distinta o vacio=0', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([], [1, 2])).toBe(0);
    expect(cosine([1, 2, 3], [1, 2])).toBe(0);
  });

  it('frases parecidas tienen mayor similitud que frases de otro tema', async () => {
    const a = await llm.embed('paquete a San Andrés 4 noches todo incluido para parejas');
    const b = await llm.embed('viaje a san andres noches todo incluido para parejas en oferta');
    const c = await llm.embed('reclamo de facturación por un cobro duplicado en la tarjeta');
    const simSimilar = cosine(a, b);
    const simDistinta = cosine(a, c);
    expect(simSimilar).toBeGreaterThan(simDistinta);
    expect(simSimilar).toBeGreaterThan(0.2);
  });
});
