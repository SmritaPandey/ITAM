import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrderService } from './work-orders.service';

@Module({
  controllers: [WorkOrdersController],
  providers: [WorkOrderService],
  exports: [WorkOrderService],
})
export class WorkOrdersModule {}
