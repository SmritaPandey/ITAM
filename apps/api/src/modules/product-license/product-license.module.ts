import { Global, Module } from '@nestjs/common';
import { ProductLicenseService } from './product-license.service';
import { ProductLicenseController } from './product-license.controller';

@Global()
@Module({
  controllers: [ProductLicenseController],
  providers: [ProductLicenseService],
  exports: [ProductLicenseService],
})
export class ProductLicenseModule {}
