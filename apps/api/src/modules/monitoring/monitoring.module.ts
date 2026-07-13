import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { NetworkConfigController } from './network-config.controller';
import { SnmpPollerService } from './snmp-poller.service';
import { SnmpScanner } from '../../common/scanners/snmp.scanner';
import { SnmpTrapReceiverService } from './snmp-trap-receiver.service';
import { OnvifDiscoveryService } from './onvif-discovery.service';
import { VdiHypervisorService } from './vdi-hypervisor.service';
import { CameraHlsService } from './camera-hls.service';
import { TopologyService } from './topology.service';
import { SyslogReceiverService } from './syslog-receiver.service';
import { NetflowCollectorService } from './netflow-collector.service';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [DiscoveryModule],
  controllers: [MonitoringController, NetworkConfigController],
  providers: [
    MonitoringService,
    SnmpPollerService,
    SnmpScanner,
    SnmpTrapReceiverService,
    OnvifDiscoveryService,
    VdiHypervisorService,
    CameraHlsService,
    TopologyService,
    SyslogReceiverService,
    NetflowCollectorService,
  ],
  exports: [
    MonitoringService,
    SnmpPollerService,
    OnvifDiscoveryService,
    VdiHypervisorService,
    CameraHlsService,
    TopologyService,
    SyslogReceiverService,
    NetflowCollectorService,
  ],
})
export class MonitoringModule {}

