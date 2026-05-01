import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface DomainEvent {
  type: string;
  tenantId: string;
  payload: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class EventBusService extends EventEmitter {
  private readonly logger = new Logger(EventBusService.name);

  emitDomainEvent(event: DomainEvent) {
    this.logger.log(`Event: ${event.type} [tenant=${event.tenantId}]`);
    this.emit(event.type, event);
    this.emit('*', event); // wildcard for automation engine
  }

  // Convenience helpers
  emitDiscoveryEvent(tenantId: string, type: string, payload: Record<string, any>) {
    this.emitDomainEvent({ type: `discovery.${type}`, tenantId, payload, timestamp: new Date() });
  }

  emitAssetEvent(tenantId: string, type: string, payload: Record<string, any>) {
    this.emitDomainEvent({ type: `asset.${type}`, tenantId, payload, timestamp: new Date() });
  }

  emitTicketEvent(tenantId: string, type: string, payload: Record<string, any>) {
    this.emitDomainEvent({ type: `ticket.${type}`, tenantId, payload, timestamp: new Date() });
  }

  emitMonitoringEvent(tenantId: string, type: string, payload: Record<string, any>) {
    this.emitDomainEvent({ type: `monitoring.${type}`, tenantId, payload, timestamp: new Date() });
  }

  emitPatchEvent(tenantId: string, type: string, payload: Record<string, any>) {
    this.emitDomainEvent({ type: `patch.${type}`, tenantId, payload, timestamp: new Date() });
  }

  emitLicenseEvent(tenantId: string, type: string, payload: Record<string, any>) {
    this.emitDomainEvent({ type: `license.${type}`, tenantId, payload, timestamp: new Date() });
  }
}
