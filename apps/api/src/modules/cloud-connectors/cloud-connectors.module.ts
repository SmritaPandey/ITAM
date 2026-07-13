import { Module } from '@nestjs/common';
import { CloudConnectorsService } from './cloud-connectors.service';
import { CloudConnectorsController } from './cloud-connectors.controller';

@Module({
  controllers: [CloudConnectorsController],
  providers: [CloudConnectorsService],
  exports: [CloudConnectorsService],
})
export class CloudConnectorsModule {}
