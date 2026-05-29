import { Module } from '@nestjs/common';
import { ScanningService } from './scanning.service';
import { ScanningController } from './scanning.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [TenantsModule, DiscoveryModule],
  controllers: [ScanningController],
  providers: [ScanningService],
  exports: [ScanningService],
})
export class ScanningModule {}

