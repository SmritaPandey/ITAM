import { SshScanner, SshScanResult } from './ssh.scanner';
import { exec } from 'child_process';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('SshScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should check if ssh is installed and return availability status', async () => {
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd, opts, callback) => {
        callback(null, { stdout: '/usr/bin/ssh\n' }, '');
      });

      const status = await SshScanner.isAvailable();
      expect(status.available).toBe(true);
    });
  });

  describe('scan hardware parameters validation', () => {
    it('should correctly parse macOS hardware profile over remote SSH channel', async () => {
      const mockExec = exec as unknown as jest.Mock;
      
      // Simulate remote SSH command responses for macOS
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('uname -s')) {
          callback(null, { stdout: 'Darwin\n' }, '');
        } else if (cmd.includes('uname -m')) {
          callback(null, { stdout: 'arm64\n' }, '');
        } else if (cmd.includes('sw_vers -productName')) {
          callback(null, { stdout: 'macOS\n' }, '');
        } else if (cmd.includes('sw_vers -productVersion')) {
          callback(null, { stdout: '14.5\n' }, '');
        } else if (cmd.includes('hostname')) {
          callback(null, { stdout: 'Smritas-MacBook-Pro.local\n' }, '');
        } else if (cmd.includes('IOPlatformSerialNumber')) {
          callback(null, { stdout: 'C02ABC123XYZ\n' }, '');
        } else if (cmd.includes('machdep.cpu.brand_string')) {
          callback(null, { stdout: 'Apple M3 Max\n' }, '');
        } else if (cmd.includes('hw.model')) {
          callback(null, { stdout: 'Mac15,9\n' }, '');
        } else {
          callback(null, { stdout: '\n' }, '');
        }
      });

      const result = await SshScanner.scan('192.168.1.8', { username: 'testuser' });

      expect(result.error).toBeUndefined();
      expect(result.ip).toBe('192.168.1.8');
      expect(result.hostname).toBe('Smritas-MacBook-Pro.local');
      expect(result.osInfo?.distro).toBe('macOS');
      expect(result.osInfo?.version).toBe('14.5');
      
      // Verify high-fidelity macOS hardware mappings
      expect(result.hardwareDetails).toBeDefined();
      expect(result.hardwareDetails?.serialNumber).toBe('C02ABC123XYZ');
      expect(result.hardwareDetails?.biosVendor).toBe('Apple Inc.');
      expect(result.hardwareDetails?.biosVersion).toBe('Apple M3 Max');
      expect(result.hardwareDetails?.motherboard).toBe('Mac15,9');
      expect(result.hardwareDetails?.tpmEnabled).toBe(true);
      expect(result.hardwareDetails?.tpmVersion).toBe('Secure Enclave');
    });

    it('should correctly parse Linux hardware profile and TPM over remote SSH channel', async () => {
      const mockExec = exec as unknown as jest.Mock;

      // Simulate remote SSH command responses for Linux
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('uname -s')) {
          callback(null, { stdout: 'Linux\n' }, '');
        } else if (cmd.includes('uname -m')) {
          callback(null, { stdout: 'x86_64\n' }, '');
        } else if (cmd.includes('os-release')) {
          callback(null, { stdout: 'PRETTY_NAME="Ubuntu 24.04 LTS"\nVERSION_ID="24.04"\n' }, '');
        } else if (cmd.includes('hostname')) {
          callback(null, { stdout: 'ubuntu-server\n' }, '');
        } else if (cmd.includes('product_serial')) {
          callback(null, { stdout: 'VMware-56 4d ab cd\n' }, '');
        } else if (cmd.includes('bios_vendor')) {
          callback(null, { stdout: 'Phoenix Technologies Ltd.\n' }, '');
        } else if (cmd.includes('bios_version')) {
          callback(null, { stdout: '6.00\n' }, '');
        } else if (cmd.includes('board_vendor')) {
          callback(null, { stdout: 'Intel Corporation\n' }, '');
        } else if (cmd.includes('board_name')) {
          callback(null, { stdout: '440BX Desktop Reference Platform\n' }, '');
        } else if (cmd.includes('ls /sys/class/tpm')) {
          callback(null, { stdout: '/sys/class/tpm/tpm0\n' }, '');
        } else if (cmd.includes('tpm0/device/description')) {
          callback(null, { stdout: 'TPM 2.0 Device\n' }, '');
        } else {
          callback(null, { stdout: '\n' }, '');
        }
      });

      const result = await SshScanner.scan('10.0.0.5', { username: 'ubuntu', password: 'password' });

      expect(result.error).toBeUndefined();
      expect(result.osInfo?.distro).toBe('Ubuntu 24.04 LTS');
      
      // Verify high-fidelity Linux hardware mappings
      expect(result.hardwareDetails).toBeDefined();
      expect(result.hardwareDetails?.serialNumber).toBe('VMware-56 4d ab cd');
      expect(result.hardwareDetails?.biosVendor).toBe('Phoenix Technologies Ltd.');
      expect(result.hardwareDetails?.biosVersion).toBe('6.00');
      expect(result.hardwareDetails?.motherboard).toBe('Intel Corporation 440BX Desktop Reference Platform');
      expect(result.hardwareDetails?.tpmEnabled).toBe(true);
      expect(result.hardwareDetails?.tpmVersion).toBe('TPM 2.0 Device');
    });
  });
});
