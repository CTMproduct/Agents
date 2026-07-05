import { Controller, Get, Header } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

/** Sirve la tienda de agentes (src/ui/marketplace.html) en GET /marketplace. */
@Controller()
export class MarketplaceUiController {
  private readonly html = readFileSync(join(__dirname, '..', 'ui', 'marketplace.html'), 'utf8');

  @Get('marketplace')
  @Header('content-type', 'text/html; charset=utf-8')
  storefront(): string {
    return this.html;
  }
}
