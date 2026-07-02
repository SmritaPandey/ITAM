import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ReportsController } from './reports.controller';
import { ComplianceService } from './compliance.service';

@Module({
  controllers: [ComplianceController, ReportsController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
