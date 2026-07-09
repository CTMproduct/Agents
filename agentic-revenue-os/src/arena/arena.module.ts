import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { ArenaController } from './arena.controller';
import { ArenaService } from './arena.service';

@Module({
  imports: [AgentsModule], // aporta LlmProvider (modelo por agente, stubbeable en tests)
  controllers: [ArenaController],
  providers: [ArenaService],
  exports: [ArenaService],
})
export class ArenaModule {}
