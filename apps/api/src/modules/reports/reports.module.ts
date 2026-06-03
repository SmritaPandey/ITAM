import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportGeneratorService } from './report-generator.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportGeneratorService],
  exports: [ReportsService, ReportGeneratorService],
})
export class ReportsModule {}
