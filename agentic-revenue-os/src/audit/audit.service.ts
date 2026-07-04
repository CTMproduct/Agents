import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    eventType: string;
    actor: string;
    entity?: string;
    entityId?: string;
    payload?: Prisma.InputJsonValue;
    traceId?: string;
  }) {
    this.logger.log(`${input.eventType} actor=${input.actor} trace=${input.traceId ?? '-'}`);
    return this.prisma.auditEvent.create({ data: input });
  }
}
