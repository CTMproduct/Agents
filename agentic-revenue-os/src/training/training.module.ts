import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { HeroesModule } from '../heroes/heroes.module';
import { MemoryService } from './memory.service';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';

@Module({
  imports: [AgentsModule, HeroesModule], // LlmProvider (chat + embed) + SkillTreeService
  controllers: [TrainingController],
  providers: [MemoryService, TrainingService],
  exports: [MemoryService, TrainingService],
})
export class TrainingModule {}
