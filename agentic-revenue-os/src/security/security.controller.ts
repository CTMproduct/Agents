import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { SecretsService } from './secrets.service';

const TENANT_ROLES: UserRole[] = [
  UserRole.TENANT_ADMIN,
  UserRole.TENANT_MEMBER,
  UserRole.TENANT_REVIEWER,
  UserRole.TENANT_VIEWER,
];

/**
 * Gobierno del tenant (solo TENANT_ADMIN):
 * - Vault de secretos cifrados (write-only: el valor jamas se devuelve).
 * - Gestion de usuarios con roles granulares (RBAC).
 */
@Controller('security')
@UseGuards(AuthGuard)
@Roles(UserRole.TENANT_ADMIN)
export class SecurityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsService,
    private readonly audit: AuditService,
  ) {}

  private tenantOf(user: JwtPayload): string {
    if (!user.tenantId) throw new ForbiddenException('Tu cuenta no pertenece a ninguna empresa');
    return user.tenantId;
  }

  // ---------- Vault de secretos ----------

  @Get('secrets')
  listSecrets(@CurrentUser() user: JwtPayload) {
    return this.prisma.secretCredential.findMany({
      where: { tenantId: this.tenantOf(user) },
      select: { id: true, name: true, createdBy: true, createdAt: true }, // nunca el valor
      orderBy: { name: 'asc' },
    });
  }

  @Post('secrets')
  async createSecret(@CurrentUser() user: JwtPayload, @Body() body: { name: string; value: string }) {
    const tenantId = this.tenantOf(user);
    if (!body?.name?.trim() || !body?.value) throw new BadRequestException('name y value son obligatorios');
    const secret = await this.prisma.secretCredential.upsert({
      where: { tenantId_name: { tenantId, name: body.name.trim() } },
      update: { encryptedValue: this.secrets.encrypt(body.value), createdBy: user.email },
      create: {
        tenantId,
        name: body.name.trim(),
        encryptedValue: this.secrets.encrypt(body.value),
        createdBy: user.email,
      },
    });
    await this.audit.log({
      eventType: 'secret.saved',
      actor: `user:${user.email}`,
      entity: 'SecretCredential',
      entityId: secret.id,
    });
    return { id: secret.id, name: secret.name, createdAt: secret.createdAt };
  }

  @Delete('secrets/:id')
  async deleteSecret(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const secret = await this.prisma.secretCredential.findFirst({ where: { id, tenantId: this.tenantOf(user) } });
    if (!secret) throw new BadRequestException('Secreto no encontrado');
    await this.prisma.secretCredential.delete({ where: { id: secret.id } });
    await this.audit.log({
      eventType: 'secret.deleted',
      actor: `user:${user.email}`,
      entity: 'SecretCredential',
      entityId: secret.id,
    });
    return { ok: true };
  }

  // ---------- Usuarios y roles (RBAC) ----------

  @Get('users')
  listUsers(@CurrentUser() user: JwtPayload) {
    return this.prisma.user.findMany({
      where: { tenantId: this.tenantOf(user) },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('users')
  async createUser(
    @CurrentUser() user: JwtPayload,
    @Body() body: { email: string; password: string; role: string },
  ) {
    const tenantId = this.tenantOf(user);
    if (!body?.email || !body?.password || body.password.length < 8) {
      throw new BadRequestException('email y password (min 8 caracteres) son obligatorios');
    }
    if (!TENANT_ROLES.includes(body.role as UserRole)) {
      throw new BadRequestException(`role debe ser uno de: ${TENANT_ROLES.join(', ')}`);
    }
    const exists = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw new BadRequestException('Ya existe una cuenta con ese email');
    const created = await this.prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: body.role as UserRole,
        tenantId,
      },
      select: { id: true, email: true, role: true },
    });
    await this.audit.log({
      eventType: 'user.created',
      actor: `user:${user.email}`,
      entity: 'User',
      entityId: created.id,
      payload: { role: created.role },
    });
    return created;
  }
}
