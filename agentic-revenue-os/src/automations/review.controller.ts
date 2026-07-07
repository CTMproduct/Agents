import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowEngineService } from './workflow-engine.service';

/**
 * Human Review Console multi-tenant: la bandeja donde cada empresa aprueba,
 * edita o rechaza lo que sus agentes proponen. Aprobar/rechazar reanuda o
 * cancela la ejecucion del workflow pausado. Cada decision alimenta el
 * learning loop (PendingReview conserva original vs final + learningNote).
 */
@Controller('review')
@UseGuards(AuthGuard)
export class ReviewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly engine: WorkflowEngineService,
  ) {}

  private tenantOf(user: JwtPayload): string {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    return user.tenantId;
  }

  private async ownReview(id: string, user: JwtPayload) {
    const review = await this.prisma.pendingReview.findFirst({
      where: { id, tenantId: this.tenantOf(user) },
    });
    if (!review) throw new BadRequestException('Revision no encontrada en tu empresa');
    return review;
  }

  @Get('queue')
  queue(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    const tenantId = this.tenantOf(user);
    const statusFilter =
      status && Object.values(ReviewStatus).includes(status as ReviewStatus)
        ? (status as ReviewStatus)
        : ReviewStatus.PENDING;
    return this.prisma.pendingReview.findMany({
      where: { tenantId, status: statusFilter },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ownReview(id, user);
  }

  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_MEMBER, UserRole.TENANT_REVIEWER)
  @Post(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.decide(id, user, ReviewStatus.APPROVED);
  }

  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_MEMBER, UserRole.TENANT_REVIEWER)
  @Post(':id/edit-and-approve')
  async editAndApprove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { finalOutput: string },
  ) {
    if (!body?.finalOutput?.trim()) throw new BadRequestException('finalOutput es obligatorio');
    return this.decide(id, user, ReviewStatus.EDITED, body.finalOutput.trim());
  }

  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_MEMBER, UserRole.TENANT_REVIEWER)
  @Post(':id/reject')
  async reject(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() body: { reason?: string }) {
    return this.decide(id, user, ReviewStatus.REJECTED, undefined, body?.reason);
  }

  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_MEMBER, UserRole.TENANT_REVIEWER)
  @Post(':id/escalate')
  async escalate(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() body: { note?: string }) {
    const review = await this.ownReview(id, user);
    if (review.status !== ReviewStatus.PENDING) throw new BadRequestException(`Estado actual: ${review.status}`);
    const updated = await this.prisma.pendingReview.update({
      where: { id: review.id },
      data: { status: ReviewStatus.ESCALATED, reviewedBy: user.email, learningNote: body?.note ?? null },
    });
    await this.audit.log({
      eventType: 'review.escalated',
      actor: `user:${user.email}`,
      entity: 'PendingReview',
      entityId: review.id,
    });
    return updated;
  }

  /** Guarda una nota de aprendizaje sobre una revision ya decidida. */
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_MEMBER, UserRole.TENANT_REVIEWER)
  @Post(':id/save-learning')
  async saveLearning(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() body: { note: string }) {
    if (!body?.note?.trim()) throw new BadRequestException('note es obligatoria');
    const review = await this.ownReview(id, user);
    const updated = await this.prisma.pendingReview.update({
      where: { id: review.id },
      data: { learningNote: body.note.trim() },
    });
    await this.audit.log({
      eventType: 'review.learning_saved',
      actor: `user:${user.email}`,
      entity: 'PendingReview',
      entityId: review.id,
    });
    return updated;
  }

  private async decide(id: string, user: JwtPayload, status: ReviewStatus, finalOutput?: string, reason?: string) {
    const review = await this.ownReview(id, user);
    if (review.status !== ReviewStatus.PENDING) throw new BadRequestException(`Estado actual: ${review.status}`);

    const updated = await this.prisma.pendingReview.update({
      where: { id: review.id },
      data: {
        status,
        finalOutput: finalOutput ?? (status === ReviewStatus.APPROVED ? review.suggestedOutput : null),
        reviewedBy: user.email,
        learningNote: reason ?? null,
      },
    });

    // Reanudar (o cancelar) la ejecucion del workflow pausado en este punto.
    if (review.executionId) {
      const approved = status === ReviewStatus.APPROVED || status === ReviewStatus.EDITED;
      await this.engine.resume(review.executionId, review.tenantId, approved, finalOutput);
    }

    await this.audit.log({
      eventType: `review.${status.toLowerCase()}`,
      actor: `user:${user.email}`,
      entity: 'PendingReview',
      entityId: review.id,
      payload: { edited: status === ReviewStatus.EDITED },
    });
    return updated;
  }
}
