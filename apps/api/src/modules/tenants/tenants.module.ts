import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantMeteringService } from './tenant-metering.service';
import { TenantsController } from './tenants.controller';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantMeteringService],
  exports: [TenantsService, TenantMeteringService],
})
export class TenantsModule {}
