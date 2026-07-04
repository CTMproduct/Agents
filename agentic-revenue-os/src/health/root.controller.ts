import { Controller, Get, Header } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sirve la consola operativa (src/ui/console.html) en GET /.
 * SPA de un solo archivo: panel, embudo kanban, aprobaciones y chats,
 * todo contra los endpoints existentes. El CRM sigue siendo la verdad;
 * la consola solo lee y ejecuta las acciones humanas (aprobar/rechazar/mover).
 */
@Controller()
export class RootController {
  private readonly html = readFileSync(join(__dirname, '..', 'ui', 'console.html'), 'utf8');

  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  console(): string {
    return this.html;
  }
}
