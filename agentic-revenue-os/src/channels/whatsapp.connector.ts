import { Injectable, Logger } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import {
  ChannelConnector,
  NormalizedChannelEvent,
  SendMessageInput,
  SendMessageResult,
} from './types';

/**
 * Conector WhatsApp preparado para Cloud API (formato de webhook real de Meta),
 * pero con envio mock hasta que existan credenciales.
 * TODO(prod): implementar sendMessage contra graph.facebook.com con WHATSAPP_TOKEN.
 */
@Injectable()
export class WhatsAppConnector implements ChannelConnector {
  readonly channel = ChannelType.WHATSAPP;
  private readonly logger = new Logger(WhatsAppConnector.name);

  normalize(payload: unknown): NormalizedChannelEvent {
    // Estructura del webhook de WhatsApp Cloud API
    const p = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
            messages?: Array<{ id?: string; from?: string; text?: { body?: string } }>;
          };
        }>;
      }>;
    };
    const value = p?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    const contact = value?.contacts?.[0];
    if (!msg?.from || !msg?.text?.body) {
      throw new Error('Payload de WhatsApp invalido o sin mensaje de texto');
    }
    return {
      channel: this.channel,
      externalId: msg.from,
      displayName: contact?.profile?.name,
      body: msg.text.body,
      externalMessageId: msg.id,
      rawPayload: payload,
      receivedAt: new Date(),
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    this.logger.log(`[whatsapp:MOCK] -> ${input.externalId}: ${input.body.slice(0, 80)}`);
    return { ok: true, externalMessageId: `mock-${Date.now()}` };
  }
}
