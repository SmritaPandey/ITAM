import { Module } from '@nestjs/common';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceCatalogController } from './service-catalog.controller';

@Module({
  controllers: [ServiceCatalogController],
  providers: [ServiceCatalogService],
})
export class ServiceCatalogModule {}
