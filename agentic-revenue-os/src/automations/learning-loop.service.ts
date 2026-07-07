import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProposalStatus, ReviewStatus } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LlmProvider } from '../agents/llm.provider';

const ProposalSchema = z.object({
  title: z.string(),
  proposedValue: z.string().describe('Contenido markdown del skill propuesto'),
  reason: z.string(),
});

export interface LoopRunResult {
  proposalId: string | null;
  analyzed: { edited: number; rejected: number; learningNotes: number };
  message: string;
}

/**
 * Learning loop (patron Hermes con control humano): analiza las decisiones
 * de la Review Console (respuestas editadas, rechazadas y notas de
 * aprendizaje) y genera una PROPUESTA de skill .md. Nunca modifica el
 * prompt del agente por si mismo: la propuesta queda PENDING hasta que un
 * humano la aprueba, y al aprobarla se agrega como TenantAgentSkill nuevo.
 */
@Injectable()
export class LearningLoopService {
  private readonly logger = new Logger(LearningLoopService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmProvider,
    private readonly audit: AuditService,
  ) {}

  async run(tenantAgentId: string, tenantId: string): Promise<LoopRunResult> {
    const agent = await this.prisma.tenantAgent.findFirst({ where: { id: tenantAgentId, tenantId } });
    if (!agent) throw new Error('Agente no encontrado en tu empresa');

    const reviews = await this.prisma.pendingReview.findMany({
      where: {
        tenantId,
        OR: [
          { status: ReviewStatus.EDITED },
          { status: ReviewStatus.REJECTED },
          { learningNote: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });

    const edited = reviews.filter((r) => r.status === ReviewStatus.EDITED);
    const rejected = reviews.filter((r) => r.status === ReviewStatus.REJECTED);
    const withNotes = reviews.filter((r) => r.learningNote);
    const analyzed = { edited: edited.length, rejected: rejected.length, learningNotes: withNotes.length };

    if (!reviews.length) {
      return { proposalId: null, analyzed, message: 'Sin decisiones humanas nuevas que analizar todavia.' };
    }

    const evidenceText = [
      ...edited.slice(0, 8).map(
        (r) => `EDITADA:\n- El agente propuso: ${r.suggestedOutput.slice(0, 300)}\n- El humano dejo: ${(r.finalOutput ?? '').slice(0, 300)}`,
      ),
      ...rejected.slice(0, 8).map(
        (r) => `RECHAZADA:\n- El agente propuso: ${r.suggestedOutput.slice(0, 300)}\n- Motivo: ${r.learningNote ?? 'sin motivo registrado'}`,
      ),
      ...withNotes.slice(0, 8).map((r) => `NOTA DE APRENDIZAJE: ${r.learningNote}`),
    ].join('\n\n');

    const resp = await this.llm.generateStructured({
      system:
        'Eres el motor de mejora continua de un agente de IA comercial. Analiza las correcciones ' +
        'humanas y produce UNA propuesta de skill en markdown que corrija los patrones detectados. ' +
        'La propuesta debe ser concreta, corta (max 15 lineas) y accionable. Escribe en espanol.',
      user: `Skill actual del agente:\n${agent.skillMd.slice(0, 1500)}\n\nDecisiones humanas recientes:\n\n${evidenceText}`,
      toolName: 'proponer_mejora_skill',
      toolDescription: 'Registra la propuesta de mejora del skill del agente.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          proposedValue: { type: 'string', description: 'Contenido markdown del skill propuesto' },
          reason: { type: 'string' },
        },
        required: ['title', 'proposedValue', 'reason'],
      },
    });

    const parsed = ProposalSchema.safeParse(resp.json);
    if (!parsed.success) {
      return { proposalId: null, analyzed, message: 'El analisis no produjo una propuesta valida.' };
    }

    const proposal = await this.prisma.agentSkillProposal.create({
      data: {
        tenantId,
        tenantAgentId,
        title: parsed.data.title,
        proposedValue: parsed.data.proposedValue,
        reason: parsed.data.reason,
        evidence: analyzed as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      eventType: 'learning.proposal_created',
      actor: 'system',
      entity: 'AgentSkillProposal',
      entityId: proposal.id,
      payload: analyzed,
    });

    this.logger.log(`Loop agente=${tenantAgentId}: propuesta ${proposal.id} (${analyzed.edited}E/${analyzed.rejected}R)`);
    return { proposalId: proposal.id, analyzed, message: 'Propuesta creada: revisala y apruebala para aplicarla.' };
  }

  /** Aprobar: agrega la propuesta como TenantAgentSkill nuevo (nunca toca el skillMd principal). */
  async approve(proposalId: string, tenantId: string, decidedBy: string) {
    const proposal = await this.prisma.agentSkillProposal.findFirst({
      where: { id: proposalId, tenantId, status: ProposalStatus.PENDING },
    });
    if (!proposal) throw new Error('Propuesta no encontrada o ya decidida');

    const last = await this.prisma.tenantAgentSkill.findFirst({
      where: { tenantAgentId: proposal.tenantAgentId },
      orderBy: { position: 'desc' },
    });
    const skill = await this.prisma.tenantAgentSkill.create({
      data: {
        tenantAgentId: proposal.tenantAgentId,
        name: `aprendizaje-${new Date().toISOString().slice(0, 10)}.md`,
        contentMd: `<!-- ${proposal.title} -->\n${proposal.proposedValue}`,
        position: (last?.position ?? -1) + 1,
      },
    });
    const updated = await this.prisma.agentSkillProposal.update({
      where: { id: proposal.id },
      data: { status: ProposalStatus.APPROVED, decidedBy },
    });
    await this.audit.log({
      eventType: 'learning.proposal_approved',
      actor: `user:${decidedBy}`,
      entity: 'AgentSkillProposal',
      entityId: proposal.id,
      payload: { skillId: skill.id },
    });
    return { proposal: updated, skillId: skill.id };
  }

  async reject(proposalId: string, tenantId: string, decidedBy: string) {
    const proposal = await this.prisma.agentSkillProposal.findFirst({
      where: { id: proposalId, tenantId, status: ProposalStatus.PENDING },
    });
    if (!proposal) throw new Error('Propuesta no encontrada o ya decidida');
    const updated = await this.prisma.agentSkillProposal.update({
      where: { id: proposal.id },
      data: { status: ProposalStatus.REJECTED, decidedBy },
    });
    await this.audit.log({
      eventType: 'learning.proposal_rejected',
      actor: `user:${decidedBy}`,
      entity: 'AgentSkillProposal',
      entityId: proposal.id,
    });
    return updated;
  }
}
