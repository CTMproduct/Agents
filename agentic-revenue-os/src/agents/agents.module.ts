import { Module } from '@nestjs/common';
import { LlmProvider } from './llm.provider';
import { IntakeAgentService } from './intake-agent.service';

@Module({
  providers: [LlmProvider, IntakeAgentService],
  exports: [IntakeAgentService],
})
export class AgentsModule {}
