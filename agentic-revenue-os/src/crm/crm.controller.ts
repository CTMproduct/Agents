import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Endpoints de lectura para el equipo (la UI llega despues; primero el motor). */
@Controller('crm')
export class CrmController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('leads')
  leads(@Query('status') status?: string) {
    return this.prisma.lead.findMany({
      where: status ? { status: status as never } : undefined,
      include: { contact: true, tasks: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  @Get('conversations/:id')
  conversation(@Param('id') id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: 'asc' } },
        suggestedReplies: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  @Get('agent-runs')
  agentRuns() {
    return this.prisma.agentRun.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
