import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Arbol de maestrias estilo LoL. El agente solo usa el .md de las habilidades que
 * DESBLOQUEO (gastando XP). Esto ahorra tokens (menos prompt) y lo mantiene
 * enfocado en lo que sabe hacer. Desbloquear exige tener el nodo padre.
 */
@Injectable()
export class SkillTreeService {
  constructor(private readonly prisma: PrismaService) {}

  /** System prompt de las habilidades desbloqueadas (solo esas). '' si ninguna. */
  async buildSkillPrompt(tenantAgentId: string): Promise<string> {
    const unlocked = await this.prisma.agentSkill.findMany({
      where: { tenantAgentId },
      include: { skillNode: true },
      orderBy: { unlockedAt: 'asc' },
    });
    if (unlocked.length === 0) return '';
    const sections = unlocked.map((s) => `## Habilidad ${s.skillNode.code} — ${s.skillNode.name}\n${s.skillNode.skillMd}`);
    return `# HABILIDADES ACTIVAS\n${sections.join('\n\n')}`;
  }

  /** Arbol del heroe del agente + nodos desbloqueados + XP disponible. */
  async treeForAgent(tenantId: string, tenantAgentId: string) {
    const agent = await this.prisma.tenantAgent.findFirst({
      where: { id: tenantAgentId, tenantId },
      include: { hero: { include: { hero: { include: { skills: { orderBy: { xpCost: 'asc' } } } } } } },
    });
    if (!agent) throw new NotFoundException('Agente no encontrado en tu empresa');

    const profile = await this.prisma.agentProfile.findUnique({ where: { tenantId_agentId: { tenantId, agentId: tenantAgentId } } });
    const unlocked = await this.prisma.agentSkill.findMany({ where: { tenantAgentId } });
    const unlockedIds = new Set(unlocked.map((u) => u.skillNodeId));
    const hero = agent.hero?.hero ?? null;

    const nodes = (hero?.skills ?? []).map((n) => ({
      id: n.id,
      code: n.code,
      name: n.name,
      abilitySlot: n.abilitySlot,
      skillMd: n.skillMd,
      xpCost: n.xpCost,
      parentId: n.parentId,
      unlocked: unlockedIds.has(n.id),
    }));

    return {
      hero: hero ? { id: hero.id, slug: hero.slug, name: hero.name, role: hero.role, splashUrl: hero.splashUrl, model3dUrl: hero.model3dUrl } : null,
      xp: profile?.xp ?? 0,
      nodes,
    };
  }

  /** Desbloquea un nodo gastando XP del perfil del agente (transaccional). */
  async unlockSkill(tenantId: string, tenantAgentId: string, skillNodeId: string) {
    const agent = await this.prisma.tenantAgent.findFirst({ where: { id: tenantAgentId, tenantId }, include: { hero: true } });
    if (!agent) throw new NotFoundException('Agente no encontrado en tu empresa');
    if (!agent.hero) throw new BadRequestException('El agente no tiene un héroe asignado');

    const node = await this.prisma.skillNode.findFirst({ where: { id: skillNodeId, heroId: agent.hero.heroId } });
    if (!node) throw new BadRequestException('Esa habilidad no pertenece al héroe del agente');

    const already = await this.prisma.agentSkill.findUnique({ where: { tenantAgentId_skillNodeId: { tenantAgentId, skillNodeId } } });
    if (already) throw new ConflictException('Habilidad ya desbloqueada');

    // Prerrequisito: el nodo padre debe estar desbloqueado.
    if (node.parentId) {
      const parent = await this.prisma.agentSkill.findUnique({ where: { tenantAgentId_skillNodeId: { tenantAgentId, skillNodeId: node.parentId } } });
      if (!parent) throw new BadRequestException('Primero desbloquea la habilidad anterior del árbol');
    }

    const profile = await this.prisma.agentProfile.findUnique({ where: { tenantId_agentId: { tenantId, agentId: tenantAgentId } } });
    const xp = profile?.xp ?? 0;
    if (xp < node.xpCost) throw new BadRequestException(`XP insuficiente: necesitas ${node.xpCost}, tienes ${xp}`);

    // upsert (no update): un agente puede desbloquear la pasiva (costo 0) sin
    // tener perfil todavia (aun no ha entrenado ni peleado).
    await this.prisma.$transaction([
      this.prisma.agentProfile.upsert({
        where: { tenantId_agentId: { tenantId, agentId: tenantAgentId } },
        create: { tenantId, agentId: tenantAgentId, alias: agent.name, xp: 0 },
        update: { xp: { decrement: node.xpCost } },
      }),
      this.prisma.agentSkill.create({ data: { tenantId, tenantAgentId, skillNodeId } }),
    ]);
    return this.treeForAgent(tenantId, tenantAgentId);
  }
}
