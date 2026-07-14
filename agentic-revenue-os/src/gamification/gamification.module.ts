import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { RankedService } from './ranked.service';

@Module({
  controllers: [GamificationController],
  providers: [RankedService],
  exports: [RankedService],
})
export class GamificationModule {}
