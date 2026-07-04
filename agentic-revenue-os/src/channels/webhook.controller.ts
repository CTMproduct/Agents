import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChannelType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ChannelRegistryService } from './channel-registry.service';
import { AuditService } from '../audit/audit.service';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly registry: ChannelRegistryService,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Post(':channel')
  @HttpCode(200)
  async receive(
    @Param('channel') channelParam: string,
    @Body() payload: unknown,
    @Headers('x-webhook-secret') secret?: string,
  ) {
    const expected = this.config.get<string>('WEBHOOK_SHARED_SECRET');
    if (expected && secret !== expected) {
      throw new UnauthorizedException('Webhook secret invalido');
    }

    const channel = channelParam.toUpperCase() as ChannelType;
    if (!Object.values(ChannelType).includes(channel)) {
      throw new BadRequestException(`Canal desconocido: ${channelParam}`);
    }

    const traceId = randomUUID();
    const connector = this.registry.get(channel);

    let event;
    try {
      event = connector.normalize(payload);
    } catch (e) {
      await this.audit.log({
        eventType: 'webhook.normalize.failed',
        actor: 'system',
        payload: { channel, error: (e as Error).message },
        traceId,
      });
      throw new BadRequestException((e as Error).message);
    }

    // El controller NO contiene logica de negocio: solo emite el evento.
    this.events.emit('message.received', { event, traceId });
    return { ok: true, traceId };
  }
}
