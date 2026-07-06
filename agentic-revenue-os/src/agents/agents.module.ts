import { Module } from '@nestjs/common';
import { LlmProvider } from './llm.provider';
import { IntakeAgentService } from './intake-agent.service';
import { AgentRunnerService } from './agent-runner.service';
import { ToolRegistry } from './tools/tool-registry';

@Module({
  providers: [LlmProvider, IntakeAgentService, AgentRunnerService, ToolRegistry],
  exports: [IntakeAgentService, AgentRunnerService, ToolRegistry, LlmProvider],
})
export class AgentsModule {}
