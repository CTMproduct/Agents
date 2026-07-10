import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Catalogo global de Heroes (curado por CTM) e instancias por empresa. Desacopla
 * la plantilla del heroe (global) de su asignacion a un agente concreto.
 */
@Injectable()
export class HeroesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catalogo publico de heroes activos + su arbol de habilidades. */
  async catalog() {
    return this.prisma.heroTemplate.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        skills: {
          orderBy: { xpCost: 'asc' },
          select: { id: true, code: true, name: true, abilitySlot: true, xpCost: true, parentId: true },
        },
      },
    });
  }

  /** Asigna (o cambia) el heroe de un agente del tenant. */
  async assignHero(tenantId: string, tenantAgentId: string, heroId: string) {
    const agent = await this.prisma.tenantAgent.findFirst({ where: { id: tenantAgentId, tenantId } });
    if (!agent) throw new NotFoundException('Agente no encontrado en tu empresa');
    const hero = await this.prisma.heroTemplate.findFirst({ where: { id: heroId, active: true } });
    if (!hero) throw new BadRequestException('Héroe no disponible');

    return this.prisma.tenantAgentHero.upsert({
      where: { tenantAgentId },
      create: { tenantId, tenantAgentId, heroId },
      update: { heroId },
      include: { hero: true },
    });
  }
}
