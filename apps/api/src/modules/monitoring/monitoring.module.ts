import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { NetworkConfigController } from './network-config.controller';
import { SnmpPollerService } from './snmp-poller.service';
import { SnmpScanner } from '../../common/scanners/snmp.scanner';
import { SnmpTrapReceiverService } from './snmp-trap-receiver.service';
import { OnvifDiscoveryService } from './onvif-discovery.service';
import { VdiHypervisorService } from './vdi-hypervisor.service';

@Module({
  controllers: [MonitoringController, NetworkConfigController],
  providers: [
    MonitoringService,
    SnmpPollerService,
    SnmpScanner,
    SnmpTrapReceiverService,
    OnvifDiscoveryService,
    VdiHypervisorService,
  ],
  exports: [MonitoringService, SnmpPollerService, OnvifDiscoveryService, VdiHypervisorService],
})
export class MonitoringModule {}

