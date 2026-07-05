import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    ChannelsModule,
    CrmModule,
    AgentsModule,
    WorkflowsModule,
    ApprovalModule,
    MarketplaceModule,
  ],
  controllers: [RootController, HealthController],
})
export class AppModule {}
