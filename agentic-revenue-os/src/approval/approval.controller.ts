import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SuggestedReplyStatus, MessageDirection } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ChannelRegistryService } from '../channels/channel-registry.service';

/**
 * Human-in-the-loop: el asesor aprueba, edita o rechaza cada respuesta sugerida.
 * Solo al aprobar se envia por el conector del canal.
 */
@Controller('approvals')
export class ApprovalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly registry: ChannelRegistryService,
  ) {}

  @Get('pending')
  pending() {
    return this.prisma.suggestedReply.findMany({
      where: { status: SuggestedReplyStatus.PENDING_APPROVAL },
      include: { conversation: { include: { contact: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: { approvedBy: string; editedBody?: string },
  ) {
    if (!body?.approvedBy) throw new BadRequestException('approvedBy es obligatorio');
    const traceId = randomUUID();

    const reply = await this.prisma.suggestedReply.findUnique({
      where: { id },
      include: { conversation: { include: { contact: { include: { channelIdentities: true } } } } },
    });
    if (!reply) throw new BadRequestException('SuggestedReply no existe');
    if (reply.status !== SuggestedReplyStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Estado actual: ${reply.status}`);
    }

    const finalBody = body.editedBody?.trim() || reply.body;
    const identity = reply.conversation.contact.channelIdentities.find(
      (ci: { channel: string; externalId: string }) => ci.channel === reply.conversation.channel,
    );
    if (!identity) throw new BadRequestException('El contacto no tiene identidad en ese canal');

    const connector = this.registry.get(reply.conversation.channel);
    const sent = await connector.sendMessage({
      channel: reply.conversation.channel,
      externalId: identity.externalId,
      body: finalBody,
    });
    if (!sent.ok) throw new BadRequestException(`Fallo el envio: ${sent.error}`);

    await this.prisma.message.create({
      data: {
        conversationId: reply.conversationId,
        direction: MessageDirection.OUTBOUND,
        channel: reply.conversation.channel,
        body: finalBody,
        externalId: sent.externalMessageId ?? null,
      },
    });
    const updated = await this.prisma.suggestedReply.update({
      where: { id },
      data: { status: SuggestedReplyStatus.SENT, approvedBy: body.approvedBy, body: finalBody },
    });
    await this.audit.log({
      eventType: 'reply.approved_and_sent',
      actor: `user:${body.approvedBy}`,
      entity: 'SuggestedReply',
      entityId: id,
      payload: { edited: Boolean(body.editedBody) },
      traceId,
    });
    return updated;
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() body: { approvedBy: string; reason?: string }) {
    if (!body?.approvedBy) throw new BadRequestException('approvedBy es obligatorio');
    const updated = await this.prisma.suggestedReply.update({
      where: { id },
      data: { status: SuggestedReplyStatus.REJECTED, approvedBy: body.approvedBy },
    });
    await this.audit.log({
      eventType: 'reply.rejected',
      actor: `user:${body.approvedBy}`,
      entity: 'SuggestedReply',
      entityId: id,
      payload: { reason: body.reason ?? null },
    });
    // Cada rechazo es un dato para el eval harness: registrarlo importa.
    return updated;
  }
}
