import { Module } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
