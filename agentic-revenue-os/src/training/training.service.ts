import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmProvider } from '../agents/llm.provider';
import { SkillTreeService } from '../heroes/skill-tree.service';
import { MemoryService } from './memory.service';

/**
 * "Practice Tool": el metodo facil de entrenar agentes. Un humano chatea con el
 * agente en un sandbox; si se equivoca, lo corrige, y esa correccion se vuelve
 * memoria permanente. Sin editar .md complejos, sin fine-tuning.
 */
@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmProvider,
    private readonly memory: MemoryService,
    private readonly skillTree: SkillTreeService,
  ) {}

  private async ownAgentOrThrow(tenantId: string, tenantAgentId: string) {
    const agent = await this.prisma.tenantAgent.findFirst({ where: { id: tenantAgentId, tenantId } });
    if (!agent) throw new NotFoundException('Agente no encontrado en tu empresa');
    return agent;
  }

  /**
   * Corre al agente en modo practica: usa su skill principal + sus memorias
   * relevantes, pero nada de esto afecta produccion. Guarda la sesion PENDING
   * para que el humano la califique.
   */
  async practice(tenantId: string, tenantAgentId: string, prompt: string) {
    const agent = await this.ownAgentOrThrow(tenantId, tenantAgentId);
    const [memories, skillPrompt] = await Promise.all([
      this.memory.recall(tenantAgentId, prompt),
      this.skillTree.buildSkillPrompt(tenantAgentId),
    ]);

    const system = [
      agent.skillMd,
      skillPrompt, // habilidades desbloqueadas del arbol (vacio si ninguna)
      memories.length
        ? `# MEMORIAS PREVIAS (lecciones aprendidas de correcciones humanas)\n${memories.map((m) => `- ${m.content}`).join('\n')}`
        : '',
      'Estás en MODO PRÁCTICA (sandbox). Responde como lo harías con un cliente real de CTM.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const res = await this.llm.chat({ system, user: prompt, model: agent.modelName });

    return this.prisma.trainingSession.create({
      data: {
        tenantId,
        tenantAgentId,
        prompt,
        response: res.text,
        status: 'PENDING',
        xpEarned: 5, // el agente gana algo de XP solo por practicar
      },
    });
  }

  /**
   * Cierra el ciclo de aprendizaje: el humano da feedback + rating, se genera la
   * memoria episodica, y el agente gana XP por aprender. Idempotente por sesion.
   */
  async submitCoaching(tenantId: string, sessionId: string, coachFeedback: string, rating: number) {
    const session = await this.prisma.trainingSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException('Sesión de entrenamiento no encontrada');
    if (session.status === 'REVIEWED') throw new ConflictException('Esta sesión ya fue revisada');
    if (rating < 1 || rating > 5) throw new BadRequestException('rating debe ser 1..5');

    const memory = await this.memory.learnFromCoaching(tenantId, session.tenantAgentId, {
      prompt: session.prompt,
      response: session.response,
      coachFeedback,
    });

    // XP al perfil del agente (se crea el perfil si aun no existe: puede no haber
    // peleado en la Arena todavia). AgentProfile esta keyed por (tenantId, agentId).
    const gain = rating >= 4 ? 20 : 10;
    const agent = await this.prisma.tenantAgent.findUnique({ where: { id: session.tenantAgentId } });
    await this.prisma.agentProfile.upsert({
      where: { tenantId_agentId: { tenantId, agentId: session.tenantAgentId } },
      create: { tenantId, agentId: session.tenantAgentId, alias: agent?.name ?? 'Agente', xp: gain },
      update: { xp: { increment: gain } },
    });

    return this.prisma.trainingSession.update({
      where: { id: session.id },
      data: {
        coachFeedback,
        rating,
        status: 'REVIEWED',
        xpEarned: session.xpEarned + gain,
        memoryId: memory.id,
      },
    });
  }
}
