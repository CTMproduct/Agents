import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { ApprovalController } from './approval.controller';

@Module({
  imports: [ChannelsModule],
  controllers: [ApprovalController],
})
export class ApprovalModule {}
