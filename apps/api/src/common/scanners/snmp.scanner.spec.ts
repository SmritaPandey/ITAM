import { Test, TestingModule } from '@nestjs/testing';
import { SnmpScanner, SnmpDeviceInfo } from './snmp.scanner';

describe('SnmpScanner', () => {
  let scanner: SnmpScanner;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SnmpScanner],
    }).compile();

    scanner = module.get<SnmpScanner>(SnmpScanner);
  });

  describe('isAvailable', () => {
    it('should detect if net-snmp module is available', async () => {
      const available = await scanner.isAvailable();
      // In test environment, net-snmp should be installed
      expect(typeof available).toBe('boolean');
    });
  });

  describe('pollDevice', () => {
    it('should return device info even when SNMP is unreachable', async () => {
      // Poll a non-existent IP — should fall back to ping
      const result = await scanner.pollDevice('192.0.2.1', 'public', 1000);
      expect(result).toBeDefined();
      expect(result!.ip).toBe('192.0.2.1');
    });

    it('should return localhost info via fallback', async () => {
      const result = await scanner.pollDevice('127.0.0.1', 'public', 2000);
      expect(result).toBeDefined();
      expect(result!.ip).toBe('127.0.0.1');
      // Localhost should be reachable via ping
      if (result!.sysDescr) {
        expect(result!.sysDescr).toContain('Reachable');
      }
    });
  });

  describe('data structures', () => {
    it('should return properly typed SnmpDeviceInfo', () => {
      const info: SnmpDeviceInfo = {
        ip: '10.0.0.1',
        sysDescr: 'Cisco IOS',
        sysName: 'core-switch',
        sysUpTime: 864000,
        interfaces: [
          { index: 1, name: 'GigabitEthernet0/1', speed: 1000000000, adminStatus: 'up', operStatus: 'up', inOctets: 12345678, outOctets: 87654321 },
        ],
        cpuLoad: 35,
        memoryPercent: 62,
      };

      expect(info.interfaces).toHaveLength(1);
      expect(info.interfaces![0].name).toBe('GigabitEthernet0/1');
      expect(info.cpuLoad).toBe(35);
    });
  });
});
