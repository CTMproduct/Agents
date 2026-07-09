import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ArenaBattleStatus, ArenaTaskType } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LlmProvider } from '../agents/llm.provider';
import { runCostUsd } from '../crm/llm-pricing';
import { PackageProposalSchema, PackageProposalJsonSchema } from './package-schema';
import { AgentRunResult, ArenaAgentConfig, EloUpdate } from './arena.types';

const DEFAULT_AVATAR_URL = 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb';

/**
 * Arena Agentica: dos agentes del tenant compiten con la misma tarea, un humano
 * elige al ganador (human-in-the-loop, coherente con la L0 de la plataforma) y
 * el ranking ELO/XP/nivel se actualiza en transaccion.
 * Adaptaciones vs el ZIP original (seccion 11 de la guia):
 *  - Ejecuta via LlmProvider (modelo propio por agente, Anthropic u OpenAI,
 *    stubbeable en tests) en vez de un cliente Anthropic aparte.
 *  - Costo con la tabla real de precios (runCostUsd), no env generico.
 *  - TenantAgent no tiene alias/avatarUrl: alias = name, avatar = default.
 *  - promptHash con SHA-256 real.
 */
@Injectable()
export class ArenaService {
  private readonly logger = new Logger(ArenaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmProvider,
    private readonly audit: AuditService,
  ) {}

  async startBattle(input: {
    tenantId: string;
    createdByUserId?: string;
    agentAId: string;
    agentBId: string;
    context: string;
    taskType: ArenaTaskType;
  }) {
    const [agentA, agentB] = await Promise.all([
      this.getTenantAgentOrThrow(input.tenantId, input.agentAId),
      this.getTenantAgentOrThrow(input.tenantId, input.agentBId),
    ]);

    this.assertRunnableAgent(agentA);
    this.assertRunnableAgent(agentB);

    const [profileA, profileB] = await Promise.all([
      this.upsertAgentProfile(input.tenantId, agentA),
      this.upsertAgentProfile(input.tenantId, agentB),
    ]);

    const [resultA, resultB] = await Promise.all([
      this.runAgentForBattle(agentA, input.context),
      this.runAgentForBattle(agentB, input.context),
    ]);

    const bothFailed = !resultA.ok && !resultB.ok;

    const battle = await this.prisma.battle.create({
      data: {
        tenantId: input.tenantId,
        createdByUserId: input.createdByUserId,
        taskType: input.taskType,
        status: bothFailed ? ArenaBattleStatus.FAILED : ArenaBattleStatus.PENDING,
        promptHash: this.createContextHash(input.context),
        participants: {
          create: [
            this.buildParticipantCreate(profileA.id, agentA, resultA),
            this.buildParticipantCreate(profileB.id, agentB, resultB),
          ],
        },
      },
      include: this.battleInclude(),
    });

    await this.audit.log({
      eventType: 'arena.battle_started',
      actor: input.createdByUserId ? `user:${input.createdByUserId}` : 'system',
      entity: 'Battle',
      entityId: battle.id,
      payload: { taskType: input.taskType, bothFailed },
    });

    this.logger.log(`battle=${battle.id} status=${battle.status} agentes=${agentA.id} vs ${agentB.id}`);
    return battle;
  }

  async listBattles(tenantId: string) {
    return this.prisma.battle.findMany({
      where: { tenantId },
      include: this.battleInclude(),
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async getLeaderboard(tenantId: string) {
    return this.prisma.agentProfile.findMany({
      where: { tenantId },
      orderBy: [{ elo: 'desc' }, { xp: 'desc' }],
      take: 20,
    });
  }

  async getBattleOrThrow(tenantId: string, battleId: string) {
    const battle = await this.prisma.battle.findFirst({
      where: { id: battleId, tenantId },
      include: this.battleInclude(),
    });
    if (!battle) throw new NotFoundException('Batalla no encontrada para este tenant.');
    return battle;
  }

  async declareWinner(input: { tenantId: string; battleId: string; winningParticipantId: string; decidedBy?: string }) {
    const resolved = await this.prisma.$transaction(async (tx) => {
      const battle = await tx.battle.findFirst({
        where: { id: input.battleId, tenantId: input.tenantId },
        include: { participants: { include: { profile: true } } },
      });

      if (!battle) throw new NotFoundException('Batalla no encontrada para este tenant.');
      if (battle.status !== ArenaBattleStatus.PENDING) {
        throw new ConflictException(`La batalla ya está en estado ${battle.status}.`);
      }
      if (battle.participants.length < 2) {
        throw new ConflictException('La batalla debe tener al menos dos participantes.');
      }

      const winner = battle.participants.find((p) => p.id === input.winningParticipantId);
      if (!winner) throw new BadRequestException('El participante ganador no pertenece a esta batalla.');
      if (winner.errorMessage) throw new BadRequestException('No se puede declarar ganador a un agente que falló.');

      const eloUpdates = this.calculateEloUpdates(
        battle.participants.map((p) => ({
          profileId: p.profileId,
          oldElo: p.profile.elo,
          oldXp: p.profile.xp,
          isWinner: p.id === input.winningParticipantId,
        })),
      );

      await tx.battle.update({
        where: { id: battle.id },
        data: {
          status: ArenaBattleStatus.RESOLVED,
          winnerParticipantId: input.winningParticipantId,
          resolvedAt: new Date(),
        },
      });

      await Promise.all(
        battle.participants.map((p) =>
          tx.battleParticipant.update({
            where: { id: p.id },
            data: { approved: p.id === input.winningParticipantId },
          }),
        ),
      );

      await Promise.all(
        eloUpdates.map((update) =>
          tx.agentProfile.update({
            where: { id: update.profileId },
            data: {
              elo: update.newElo,
              xp: update.newXp,
              level: update.newLevel,
              wins: { increment: update.isWinner ? 1 : 0 },
              losses: { increment: update.isWinner ? 0 : 1 },
            },
          }),
        ),
      );

      return tx.battle.findUnique({ where: { id: battle.id }, include: this.battleInclude() });
    });

    await this.audit.log({
      eventType: 'arena.battle_resolved',
      actor: input.decidedBy ? `user:${input.decidedBy}` : 'system',
      entity: 'Battle',
      entityId: input.battleId,
      payload: { winningParticipantId: input.winningParticipantId },
    });
    return resolved;
  }

  private async getTenantAgentOrThrow(tenantId: string, agentId: string): Promise<ArenaAgentConfig> {
    // Ajuste B de la guia: campos reales de TenantAgent (sin alias/avatarUrl).
    const agent = await this.prisma.tenantAgent.findFirst({
      where: { id: agentId, tenantId, active: true },
      select: { id: true, tenantId: true, name: true, modelName: true, skillMd: true },
    });
    if (!agent) throw new NotFoundException(`Agente ${agentId} no encontrado (o inactivo) para este tenant.`);
    return agent;
  }

  private assertRunnableAgent(agent: ArenaAgentConfig) {
    // modelName null es valido en esta plataforma (usa el modelo por defecto);
    // lo unico obligatorio es un skill con contenido real.
    if (!agent.skillMd || agent.skillMd.trim().length < 20) {
      throw new BadRequestException(`El agente ${agent.id} no tiene skillMd válido (mínimo 20 caracteres).`);
    }
  }

  private async upsertAgentProfile(tenantId: string, agent: ArenaAgentConfig) {
    const alias = agent.name || `Agent ${agent.id.slice(0, 6)}`;
    return this.prisma.agentProfile.upsert({
      where: { tenantId_agentId: { tenantId, agentId: agent.id } },
      create: { tenantId, agentId: agent.id, alias, avatarUrl: DEFAULT_AVATAR_URL },
      update: { alias },
    });
  }

  private buildParticipantCreate(
    profileId: string,
    agent: ArenaAgentConfig,
    result: AgentRunResult,
  ): Prisma.BattleParticipantCreateWithoutBattleInput {
    return {
      profile: { connect: { id: profileId } },
      agentIdSnapshot: agent.id,
      aliasSnapshot: agent.name || `Agent ${agent.id.slice(0, 6)}`,
      modelSnapshot: result.modelUsed,
      outputData: result.ok ? (result.output as Prisma.InputJsonValue) : Prisma.JsonNull,
      errorMessage: result.ok ? null : result.errorMessage,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      tokenCost: new Prisma.Decimal(result.tokenCost.toFixed(6)),
      latencyMs: result.latencyMs,
    };
  }

  private async runAgentForBattle(agent: ArenaAgentConfig, userMessage: string): Promise<AgentRunResult> {
    const startTime = Date.now();
    try {
      const resp = await this.llm.generateStructured({
        system: agent.skillMd!,
        user: userMessage,
        model: agent.modelName,
        toolName: 'propose_package',
        toolDescription: 'Propón un paquete turístico estructurado y listo para revisión humana.',
        inputSchema: PackageProposalJsonSchema,
        maxTokens: 2048,
      });

      const parsed = PackageProposalSchema.safeParse(resp.json);
      if (!parsed.success) {
        return {
          ok: false,
          errorMessage: 'El modelo no devolvió una propuesta válida (schema).',
          inputTokens: resp.inputTokens,
          outputTokens: resp.outputTokens,
          tokenCost: runCostUsd(resp.modelName, resp.inputTokens, resp.outputTokens),
          latencyMs: Date.now() - startTime,
          modelUsed: resp.modelName,
        };
      }

      return {
        ok: true,
        output: parsed.data,
        inputTokens: resp.inputTokens,
        outputTokens: resp.outputTokens,
        tokenCost: runCostUsd(resp.modelName, resp.inputTokens, resp.outputTokens),
        latencyMs: resp.latencyMs,
        modelUsed: resp.modelName,
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage: error instanceof Error ? error.message : 'Error desconocido ejecutando agente.',
        inputTokens: 0,
        outputTokens: 0,
        tokenCost: 0,
        latencyMs: Date.now() - startTime,
        modelUsed: agent.modelName ?? '(default)',
      };
    }
  }

  private calculateEloUpdates(
    profiles: Array<{ profileId: string; oldElo: number; oldXp: number; isWinner: boolean }>,
  ): EloUpdate[] {
    const kFactor = 32;
    return profiles.map((profile) => {
      const opponents = profiles.filter((item) => item.profileId !== profile.profileId);
      const averageOpponentElo = opponents.reduce((sum, item) => sum + item.oldElo, 0) / opponents.length;
      const expectedScore = 1 / (1 + Math.pow(10, (averageOpponentElo - profile.oldElo) / 400));
      const actualScore = profile.isWinner ? 1 : 0;
      const newElo = Math.max(100, Math.round(profile.oldElo + kFactor * (actualScore - expectedScore)));
      const xpGain = profile.isWinner ? 50 : 10;
      const newXp = profile.oldXp + xpGain;
      return {
        profileId: profile.profileId,
        oldElo: profile.oldElo,
        newElo,
        isWinner: profile.isWinner,
        xpGain,
        newXp,
        newLevel: this.calculateLevel(newXp),
      };
    });
  }

  private calculateLevel(xp: number) {
    return Math.max(1, Math.floor(xp / 200) + 1);
  }

  private createContextHash(context: string) {
    return createHash('sha256').update(context).digest('hex').slice(0, 32);
  }

  private battleInclude() {
    return {
      participants: {
        include: { profile: true },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }
}
