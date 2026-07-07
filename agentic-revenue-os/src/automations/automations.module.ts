import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { WorkflowEngineService } from './workflow-engine.service';
import { AutomationsController } from './automations.controller';
import { ReviewController } from './review.controller';
import { LearningLoopService } from './learning-loop.service';
import { LearningController } from './learning.controller';
import { DecisionMetricsController } from './decision-metrics.controller';

@Module({
  imports: [AgentsModule],
  providers: [WorkflowEngineService, LearningLoopService],
  controllers: [AutomationsController, ReviewController, LearningController, DecisionMetricsController],
})
export class AutomationsModule {}
