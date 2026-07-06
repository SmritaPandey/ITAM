import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { CredentialVaultService } from './credential-vault.service';
import { ScanSchedulerService } from './scan-scheduler.service';
import { ComplianceModule } from '../compliance/compliance.module';
import { AuthModule } from '../auth/auth.module';
import { AlertsModule } from '../alerts/alerts.module';
import { SoftwareModule } from '../software/software.module';
import { SnmpScanner } from '../../common/scanners/snmp.scanner';
import { NacController } from './nac.controller';
import { NacService } from './nac.service';

@Module({
  imports: [ComplianceModule, AuthModule, AlertsModule, SoftwareModule],
  controllers: [DiscoveryController, NacController],
  providers: [DiscoveryService, CredentialVaultService, ScanSchedulerService, SnmpScanner, NacService],
  exports: [DiscoveryService, CredentialVaultService],
})
export class DiscoveryModule {}



