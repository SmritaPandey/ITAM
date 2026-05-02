import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { CredentialVaultService } from './credential-vault.service';
import { ScanSchedulerService } from './scan-scheduler.service';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [ComplianceModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, CredentialVaultService, ScanSchedulerService],
  exports: [DiscoveryService, CredentialVaultService],
})
export class DiscoveryModule {}

