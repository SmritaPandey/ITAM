import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import { OtProbeService } from './ot-probe.service';
import { OtProbeController } from './ot-probe.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MqttController, OtProbeController],
  providers: [MqttService, OtProbeService],
  exports: [MqttService, OtProbeService],
})
export class IotModule {}
