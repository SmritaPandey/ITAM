import { OnvifDiscoveryService } from './onvif-discovery.service';

describe('OnvifDiscoveryService', () => {
  let service: OnvifDiscoveryService;
  const mockPrisma: any = {
    monitoredDevice: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'cam-1' }),
    },
  };
  const mockEventBus: any = {
    emitMonitoringEvent: jest.fn(),
  };

  beforeEach(() => {
    service = new OnvifDiscoveryService(mockPrisma, mockEventBus);
    jest.clearAllMocks();
  });

  describe('parseProbeMatch', () => {
    it('should parse a valid WS-Discovery ProbeMatch response', () => {
      const xml = `<ProbeMatches>
        <ProbeMatch>
          <XAddrs>http://192.168.1.100:80/onvif/device_service</XAddrs>
          <Scopes>onvif://www.onvif.org/name/TestCamera onvif://www.onvif.org/hardware/Hikvision onvif://www.onvif.org/model/DS-2CD2132</Scopes>
        </ProbeMatch>
      </ProbeMatches>`;

      const result = (service as any).parseProbeMatch(xml);
      expect(result).not.toBeNull();
      expect(result.address).toBe('192.168.1.100');
      expect(result.port).toBe(80);
      expect(result.name).toBe('TestCamera');
      expect(result.xaddrs).toBe('http://192.168.1.100:80/onvif/device_service');
    });

    it('should handle HTTPS XAddrs', () => {
      const xml = `<d:ProbeMatch>
        <d:XAddrs>https://10.0.0.50:443/onvif/device_service</d:XAddrs>
        <d:Scopes></d:Scopes>
      </d:ProbeMatch>`;

      const result = (service as any).parseProbeMatch(xml);
      expect(result).not.toBeNull();
      expect(result.address).toBe('10.0.0.50');
      expect(result.port).toBe(443);
    });

    it('should return null for invalid responses', () => {
      const result = (service as any).parseProbeMatch('<html>Not ONVIF</html>');
      expect(result).toBeNull();
    });

    it('should detect PTZ support from scopes', () => {
      const xml = `<ProbeMatch>
        <XAddrs>http://192.168.1.50:80/onvif/device_service</XAddrs>
        <Scopes>onvif://www.onvif.org/type/ptz</Scopes>
      </ProbeMatch>`;

      const result = (service as any).parseProbeMatch(xml);
      expect(result.scopes.some((s: string) => s.includes('ptz'))).toBe(true);
    });
  });

  describe('extractScope', () => {
    it('should extract name from scope URIs', () => {
      const scopes = ['onvif://www.onvif.org/name/MainGateCamera', 'onvif://www.onvif.org/hardware/Dahua'];
      const name = (service as any).extractScope(scopes, 'name');
      expect(name).toBe('MainGateCamera');
    });

    it('should extract hardware from scope URIs', () => {
      const scopes = ['onvif://www.onvif.org/hardware/Hikvision'];
      const hw = (service as any).extractScope(scopes, 'hardware');
      expect(hw).toBe('Hikvision');
    });

    it('should return undefined for missing scope keys', () => {
      const scopes = ['onvif://www.onvif.org/name/Test'];
      const result = (service as any).extractScope(scopes, 'nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('UUID generation', () => {
    it('should generate a valid UUID v4 format', () => {
      const uuid = (service as any).generateUuid();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should generate unique UUIDs', () => {
      const a = (service as any).generateUuid();
      const b = (service as any).generateUuid();
      expect(a).not.toBe(b);
    });
  });
});
