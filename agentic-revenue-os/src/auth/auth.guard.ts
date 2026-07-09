import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthService, JwtPayload } from './auth.service';

export const ROLES_KEY = 'roles';
/**
 * Decorador opcional: @Roles(UserRole.TENANT_ADMIN) restringe el endpoint.
 * Usa SetMetadata (no Reflect.metadata) para que funcione tanto a nivel de
 * metodo (getHandler) como de clase (getClass) con el Reflector de Nest.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Exige un Bearer token valido. Adjunta req.user = JwtPayload. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el header Authorization: Bearer <token>');
    }
    const payload: JwtPayload = this.auth.verify(header.slice('Bearer '.length));
    req.user = payload;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // El PLATFORM_ADMIN (tu cuenta) es superusuario: pasa cualquier @Roles.
    // Igual opera sobre su propio tenant para los recursos tenant-scoped
    // (el seed le asigna una empresa), asi que la data sigue aislada.
    const isPlatformAdmin = payload.role === UserRole.PLATFORM_ADMIN;
    if (requiredRoles?.length && !isPlatformAdmin && !requiredRoles.includes(payload.role)) {
      throw new UnauthorizedException('No tienes permiso para este recurso');
    }
    return true;
  }
}
