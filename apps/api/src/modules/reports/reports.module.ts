import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportGeneratorService } from './report-generator.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportGeneratorService],
  exports: [ReportsService, ReportGeneratorService],
})
export class ReportsModule {}
