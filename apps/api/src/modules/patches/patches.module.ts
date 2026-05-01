import { Module } from '@nestjs/common';
import { PatchesService } from './patches.service';
import { PatchesController } from './patches.controller';

@Module({
  controllers: [PatchesController],
  providers: [PatchesService],
  exports: [PatchesService],
})
export class PatchesModule {}
