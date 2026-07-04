import { Injectable, Logger } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import {
  ChannelConnector,
  NormalizedChannelEvent,
  SendMessageInput,
  SendMessageResult,
} from './types';

/**
 * Conector real de webchat (payload propio, simple).
 * POST /webhooks/webchat  { sessionId, name?, message }
 */
@Injectable()
export class WebchatConnector implements ChannelConnector {
  readonly channel = ChannelType.WEBCHAT;
  private readonly logger = new Logger(WebchatConnector.name);

  normalize(payload: unknown): NormalizedChannelEvent {
    const p = payload as { sessionId?: string; name?: string; message?: string };
    if (!p?.sessionId || !p?.message) {
      throw new Error('Payload de webchat invalido: se requiere sessionId y message');
    }
    return {
      channel: this.channel,
      externalId: p.sessionId,
      displayName: p.name,
      body: p.message,
      rawPayload: payload,
      receivedAt: new Date(),
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    // En Fase 1 el webchat entrega respuestas via polling/DB; aqui solo se registra.
    this.logger.log(`[webchat] -> ${input.externalId}: ${input.body.slice(0, 80)}`);
    return { ok: true };
  }
}
