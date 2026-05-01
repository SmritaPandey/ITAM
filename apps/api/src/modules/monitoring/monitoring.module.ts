import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { NetworkConfigController } from './network-config.controller';

@Module({
  controllers: [MonitoringController, NetworkConfigController],
  providers: [MonitoringService],
})
export class MonitoringModule {}
