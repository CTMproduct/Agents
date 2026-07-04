import { ChannelType } from '@prisma/client';

/**
 * Evento normalizado: TODO canal (WhatsApp, webchat, email...) se reduce a esto.
 * Los conectores NO tienen logica comercial: reciben, normalizan y envian.
 */
export interface NormalizedChannelEvent {
  channel: ChannelType;
  externalId: string; // identidad del remitente en ese canal
  displayName?: string;
  body: string;
  externalMessageId?: string;
  rawPayload: unknown;
  receivedAt: Date;
}

export interface SendMessageInput {
  channel: ChannelType;
  externalId: string;
  body: string;
}

export interface SendMessageResult {
  ok: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface ChannelConnector {
  readonly channel: ChannelType;
  normalize(payload: unknown): NormalizedChannelEvent;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
