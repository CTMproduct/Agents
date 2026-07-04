import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { ChannelRegistryService } from './channel-registry.service';
import { WebchatConnector } from './webchat.connector';
import { WhatsAppConnector } from './whatsapp.connector';

@Module({
  controllers: [WebhookController],
  providers: [ChannelRegistryService, WebchatConnector, WhatsAppConnector],
  exports: [ChannelRegistryService],
})
export class ChannelsModule {}
