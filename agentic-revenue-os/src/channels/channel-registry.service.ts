import { Injectable } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { ChannelConnector } from './types';
import { WebchatConnector } from './webchat.connector';
import { WhatsAppConnector } from './whatsapp.connector';

@Injectable()
export class ChannelRegistryService {
  private readonly connectors: Map<ChannelType, ChannelConnector>;

  constructor(webchat: WebchatConnector, whatsapp: WhatsAppConnector) {
    this.connectors = new Map<ChannelType, ChannelConnector>([
      [ChannelType.WEBCHAT, webchat],
      [ChannelType.WHATSAPP, whatsapp],
    ]);
  }

  get(channel: ChannelType): ChannelConnector {
    const c = this.connectors.get(channel);
    if (!c) throw new Error(`No hay conector registrado para el canal ${channel}`);
    return c;
  }
}
