import { Module } from '@nestjs/common';
import { ScanningService } from './scanning.service';
import { ScanningController } from './scanning.controller';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [ScanningController],
  providers: [ScanningService],
  exports: [ScanningService],
})
export class ScanningModule {}

