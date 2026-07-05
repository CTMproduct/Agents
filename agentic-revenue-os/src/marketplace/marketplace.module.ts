import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { MarketplaceController } from './marketplace.controller';
import { AdminController } from './admin.controller';
import { MarketplaceUiController } from './marketplace-ui.controller';

@Module({
  imports: [AgentsModule],
  controllers: [MarketplaceController, AdminController, MarketplaceUiController],
})
export class MarketplaceModule {}
