import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmProvider } from '../agents/llm.provider';

export interface RecalledMemory {
  id: string;
  type: string;
  content: string;
  importance: number;
  similarity: number;
}

/**
 * Memoria cognitiva del agente. El aprendizaje NO reentrena pesos: guarda las
 * correcciones humanas como memoria EPISODIC de alta importancia (embedding) y
 * las recupera por similitud semantica cuando aparece una situacion parecida.
 *
 * El recall hace cosine EN LA APP sobre Float[] (no pgvector): a la escala de
 * "correcciones por agente" es identico en resultado y corre igual en local y
 * en produccion. pgvector se gana como indice cuando un agente pase de ~10k memorias.
 */
@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmProvider,
  ) {}

  /**
   * Convierte una correccion del coach en un recuerdo permanente. Las lecciones
   * humanas entran con importancia 0.9 (maxima prioridad de recall).
   */
  async learnFromCoaching(
    tenantId: string,
    tenantAgentId: string,
    session: { prompt: string; response: string; coachFeedback: string },
  ) {
    const summary = [
      `SITUACIÓN: ${session.prompt}`,
      `EL AGENTE DIJO: ${session.response}`,
      `CORRECCIÓN DEL COACH: ${session.coachFeedback}`,
      'LECCIÓN: Aplica la corrección del coach en situaciones similares.',
    ].join('\n');

    const embedding = await this.llm.embed(summary);
    return this.prisma.agentMemory.create({
      data: {
        tenantId,
        tenantAgentId,
        type: 'EPISODIC',
        content: summary,
        embedding,
        importance: 0.9,
      },
    });
  }

  /**
   * Recupera los recuerdos mas relevantes a la consulta actual (no todo el
   * historial). Trae una ventana de candidatos recientes y rankea por cosine +
   * importancia; marca los recuperados como accedidos (lastAccessedAt).
   */
  async recall(tenantAgentId: string, query: string, limit = 3): Promise<RecalledMemory[]> {
    const queryEmbedding = await this.llm.embed(query);
    const candidates = await this.prisma.agentMemory.findMany({
      where: { tenantAgentId, type: { in: ['EPISODIC', 'DECLARATIVE'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const scored = candidates
      .map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        importance: m.importance,
        similarity: cosine(queryEmbedding, m.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity || b.importance - a.importance)
      .slice(0, limit);

    if (scored.length > 0) {
      await this.prisma.agentMemory.updateMany({
        where: { id: { in: scored.map((s) => s.id) } },
        data: { lastAccessedAt: new Date() },
      });
    }
    return scored;
  }
}

/** Cosine seguro: 0 si algun vector esta vacio o difieren en dimension. */
export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
