import { Module } from '@nestjs/common';
import { HeroesController } from './heroes.controller';
import { HeroesService } from './heroes.service';
import { SkillTreeService } from './skill-tree.service';

@Module({
  controllers: [HeroesController],
  providers: [HeroesService, SkillTreeService],
  exports: [SkillTreeService], // el Training Camp inyecta las skills desbloqueadas al practicar
})
export class HeroesModule {}
