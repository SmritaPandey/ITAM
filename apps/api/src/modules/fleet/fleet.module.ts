import { Module } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { FleetController } from './fleet.controller';
import { EventBusService } from '../../common/events/event-bus.service';
import { PrismaModule } from '../../common/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FleetController],
  providers: [FleetService, EventBusService],
})
export class FleetModule {}
