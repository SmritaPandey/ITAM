import { EventBusService, DomainEvent } from './event-bus.service';

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(() => {
    service = new EventBusService();
  });

  describe('emitDomainEvent', () => {
    it('should emit a typed event', (done) => {
      service.on('asset.created', (event: DomainEvent) => {
        expect(event.type).toBe('asset.created');
        expect(event.tenantId).toBe('tenant-1');
        expect(event.payload.assetId).toBe('a1');
        done();
      });

      service.emitDomainEvent({
        type: 'asset.created',
        tenantId: 'tenant-1',
        payload: { assetId: 'a1' },
        timestamp: new Date(),
      });
    });

    it('should emit wildcard events for automation engine', (done) => {
      service.on('*', (event: DomainEvent) => {
        expect(event.type).toBe('monitoring.device_down');
        done();
      });

      service.emitDomainEvent({
        type: 'monitoring.device_down',
        tenantId: 'tenant-1',
        payload: { deviceId: 'dev-1' },
        timestamp: new Date(),
      });
    });
  });

  describe('convenience helpers', () => {
    it('emitAssetEvent should emit with asset. prefix', (done) => {
      service.on('asset.updated', (event: DomainEvent) => {
        expect(event.type).toBe('asset.updated');
        expect(event.payload.name).toBe('Laptop-01');
        done();
      });

      service.emitAssetEvent('tenant-1', 'updated', { name: 'Laptop-01' });
    });

    it('emitMonitoringEvent should emit with monitoring. prefix', (done) => {
      service.on('monitoring.device_recovered', (event: DomainEvent) => {
        expect(event.type).toBe('monitoring.device_recovered');
        done();
      });

      service.emitMonitoringEvent('tenant-1', 'device_recovered', { deviceId: 'dev-1' });
    });

    it('emitTicketEvent should emit with ticket. prefix', (done) => {
      service.on('ticket.created', (event: DomainEvent) => {
        expect(event.type).toBe('ticket.created');
        done();
      });

      service.emitTicketEvent('tenant-1', 'created', { ticketId: 't-1' });
    });

    it('emitDiscoveryEvent should emit with discovery. prefix', (done) => {
      service.on('discovery.scan_completed', (event: DomainEvent) => {
        expect(event.type).toBe('discovery.scan_completed');
        done();
      });

      service.emitDiscoveryEvent('tenant-1', 'scan_completed', { subnet: '10.0.0.0/24' });
    });

    it('emitPatchEvent should emit with patch. prefix', (done) => {
      service.on('patch.deployed', (event: DomainEvent) => {
        expect(event.type).toBe('patch.deployed');
        done();
      });

      service.emitPatchEvent('tenant-1', 'deployed', { patchId: 'KB123' });
    });

    it('emitLicenseEvent should emit with license. prefix', (done) => {
      service.on('license.expiring', (event: DomainEvent) => {
        expect(event.type).toBe('license.expiring');
        done();
      });

      service.emitLicenseEvent('tenant-1', 'expiring', { licenseName: 'Office 365' });
    });
  });

  describe('multiple listeners', () => {
    it('should support multiple listeners on same event', () => {
      let count = 0;
      service.on('test.event', () => count++);
      service.on('test.event', () => count++);
      service.on('*', () => count++);

      service.emitDomainEvent({
        type: 'test.event',
        tenantId: 't1',
        payload: {},
        timestamp: new Date(),
      });

      expect(count).toBe(3);
    });
  });
});
