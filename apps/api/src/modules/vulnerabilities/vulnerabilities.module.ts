import { Module } from '@nestjs/common';
import { VulnerabilitiesController } from './vulnerabilities.controller';
import { VulnerabilitiesService } from './vulnerabilities.service';
import { TicketsModule } from '../tickets/tickets.module';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Module({
  imports: [AuthModule, TicketsModule],
  controllers: [VulnerabilitiesController],
  providers: [VulnerabilitiesService, ApiKeyGuard],
  exports: [VulnerabilitiesService],
})
export class VulnerabilitiesModule {}
