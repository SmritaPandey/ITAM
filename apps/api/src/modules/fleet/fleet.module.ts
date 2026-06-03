import { Module } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { FleetController } from './fleet.controller';
import { EventBusService } from '../../common/events/event-bus.service';

@Module({
  controllers: [FleetController],
  providers: [FleetService, EventBusService],
})
export class FleetModule {}
