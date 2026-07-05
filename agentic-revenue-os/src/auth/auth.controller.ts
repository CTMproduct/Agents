import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { JwtPayload } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /** Crea una empresa (Tenant) nueva + su primer usuario (TENANT_ADMIN). */
  @Post('register')
  register(@Body() body: { email: string; password: string; tenantName: string }) {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    const tenant = user.tenantId ? await this.prisma.tenant.findUnique({ where: { id: user.tenantId } }) : null;
    return { id: user.sub, email: user.email, role: user.role, tenant };
  }
}
