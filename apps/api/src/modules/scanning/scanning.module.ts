import { Module } from '@nestjs/common';
import { ScanningService } from './scanning.service';
import { ScanningController } from './scanning.controller';

@Module({
  controllers: [ScanningController],
  providers: [ScanningService],
  exports: [ScanningService],
})
export class ScanningModule {}
