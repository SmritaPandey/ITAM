import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { CredentialVaultService } from './credential-vault.service';
import { ScanSchedulerService } from './scan-scheduler.service';

@Module({
  controllers: [DiscoveryController],
  providers: [DiscoveryService, CredentialVaultService, ScanSchedulerService],
  exports: [DiscoveryService, CredentialVaultService],
})
export class DiscoveryModule {}
