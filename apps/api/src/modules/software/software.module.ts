import { Module } from '@nestjs/common';
import { SoftwareService } from './software.service';
import { SoftwareController } from './software.controller';

@Module({
  controllers: [SoftwareController],
  providers: [SoftwareService],
  exports: [SoftwareService],
})
export class SoftwareModule {}
