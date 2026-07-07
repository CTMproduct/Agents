import { Module } from '@nestjs/common';
import { SecretsService } from './secrets.service';
import { SecurityController } from './security.controller';

@Module({
  providers: [SecretsService],
  controllers: [SecurityController],
  exports: [SecretsService],
})
export class SecurityModule {}
