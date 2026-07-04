import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { AgentsModule } from '../agents/agents.module';
import { MessageReceivedWorkflow } from './message-received.workflow';

@Module({
  imports: [CrmModule, AgentsModule],
  providers: [MessageReceivedWorkflow],
})
export class WorkflowsModule {}
