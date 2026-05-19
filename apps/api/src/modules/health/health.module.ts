import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DataRetentionService } from '../../common/services/data-retention.service';

@Module({
  controllers: [HealthController],
  providers: [DataRetentionService],
  exports: [DataRetentionService],
})
export class HealthModule {}

