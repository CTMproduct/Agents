import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita acentos tras normalizar
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'empresa'
  );
}

/**
 * Autenticacion propia (email + password + JWT), sin proveedor externo.
 * Multi-tenant: registrarse crea una empresa (Tenant) nueva con un
 * TENANT_ADMIN. PLATFORM_ADMIN (tu cuenta) se crea solo via seed + env vars.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get jwtSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('Falta JWT_SECRET en .env');
    return secret;
  }

  private sign(payload: JwtPayload): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
  }

  verify(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }

  async register(input: { email: string; password: string; tenantName: string }) {
    if (!input.email || !input.password || !input.tenantName) {
      throw new BadRequestException('email, password y tenantName son obligatorios');
    }
    if (input.password.length < 8) {
      throw new BadRequestException('La contrasena debe tener al menos 8 caracteres');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new BadRequestException('Ya existe una cuenta con ese email');

    const baseSlug = slugify(input.tenantName);
    let slug = baseSlug;
    for (let i = 1; await this.prisma.tenant.findUnique({ where: { slug } }); i++) {
      slug = `${baseSlug}-${i}`;
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const tenant = await this.prisma.tenant.create({ data: { name: input.tenantName, slug } });
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash, role: UserRole.TENANT_ADMIN, tenantId: tenant.id },
    });

    const token = this.sign({ sub: user.id, email: user.email, role: user.role, tenantId: tenant.id });
    return { token, user: { id: user.id, email: user.email, role: user.role }, tenant };
  }

  async login(input: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales invalidas');
    }
    const token = this.sign({ sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId });
    return { token, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId } };
  }
}
