import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';

// Frontend React (web/dist) servido bajo /app por la misma API: un solo servicio.
const webDist = join(__dirname, '..', '..', 'web', 'dist');
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { RootController } from './health/root.controller';
import { AuditModule } from './audit/audit.module';
import { ChannelsModule } from './channels/channels.module';
import { CrmModule } from './crm/crm.module';
import { AgentsModule } from './agents/agents.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { ApprovalModule } from './approval/approval.module';
import { AuthModule } from './auth/auth.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { AutomationsModule } from './automations/automations.module';
import { SecurityModule } from './security/security.module';
import { ArenaModule } from './arena/arena.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limit global (Fase seguridad): configurable por env.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
        limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
      },
    ]),
    EventEmitterModule.forRoot(),
    ...(existsSync(webDist)
      ? [ServeStaticModule.forRoot({ rootPath: webDist, serveRoot: '/app' })]
      : []),
    PrismaModule,
    AuditModule,
    AuthModule,
    ChannelsModule,
    CrmModule,
    AgentsModule,
    WorkflowsModule,
    ApprovalModule,
    MarketplaceModule,
    AutomationsModule,
    SecurityModule,
    ArenaModule,
  ],
  controllers: [RootController, HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
