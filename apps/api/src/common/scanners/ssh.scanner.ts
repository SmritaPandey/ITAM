import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SshScanResult {
  ip: string;
  hostname?: string;
  osInfo?: { kernel: string; distro?: string; arch: string };
  uptime?: string;
  diskUsage?: { filesystem: string; size: string; used: string; available: string; percent: string; mount: string }[];
  memoryInfo?: { total: string; used: string; free: string; percent: number };
  cpuInfo?: { model: string; cores: number; loadAvg: string };
  pendingPatches?: string[];
  runningServices?: { name: string; status: string }[];
  openPorts?: { port: number; process: string }[];
  lastLogins?: { user: string; terminal: string; from: string; time: string }[];
  installedPackages?: number;
  users?: string[];
  firewallStatus?: string;
  error?: string;
}

/**
 * SSH Agent Scanner — connects to remote hosts via SSH for deep endpoint interrogation.
 * Supports: password auth (via sshpass) and key auth.
 */
export class SshScanner {
  private static readonly logger = new Logger('SshScanner');

  static async isAvailable(): Promise<{ available: boolean; sshpassAvailable: boolean }> {
    const sshAvailable = await this.checkCommand('ssh');
    const sshpassAvailable = await this.checkCommand('sshpass');
    return { available: sshAvailable, sshpassAvailable };
  }

  private static async checkCommand(cmd: string): Promise<boolean> {
    try { await execAsync(`which ${cmd}`, { timeout: 3000 }); return true; } catch { return false; }
  }

  /**
   * Full endpoint audit via SSH
   */
  static async scan(
    ip: string,
    credentials: { username: string; password?: string; privateKeyPath?: string },
    timeout = 30000,
  ): Promise<SshScanResult> {
    const result: SshScanResult = { ip };

    const runCmd = async (cmd: string): Promise<string> => {
      try {
        const sshCmd = this.buildSshCommand(ip, credentials, cmd);
        const { stdout } = await execAsync(sshCmd, { timeout });
        return stdout.trim();
      } catch {
        return '';
      }
    };

    try {
      // OS Info
      const uname = await runCmd('uname -a');
      if (uname) {
        const parts = uname.split(' ');
        result.osInfo = { kernel: parts[2] || uname, arch: parts[parts.length - 2] || 'unknown', distro: undefined };
      }

      // Distro detection
      const distro = await runCmd('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \\"');
      if (distro && result.osInfo) result.osInfo.distro = distro;

      // Hostname
      result.hostname = await runCmd('hostname');

      // Uptime
      result.uptime = await runCmd('uptime -p 2>/dev/null || uptime');

      // Disk usage
      const dfOut = await runCmd('df -h --output=source,size,used,avail,pcent,target 2>/dev/null || df -h');
      if (dfOut) {
        result.diskUsage = dfOut.split('\n').slice(1).filter(l => l.trim()).map(line => {
          const p = line.trim().split(/\s+/);
          return { filesystem: p[0], size: p[1], used: p[2], available: p[3], percent: p[4], mount: p[5] || '/' };
        });
      }

      // Memory
      const memOut = await runCmd('free -h 2>/dev/null | grep Mem');
      if (memOut) {
        const p = memOut.trim().split(/\s+/);
        const total = parseFloat(p[1]) || 0;
        const used = parseFloat(p[2]) || 0;
        result.memoryInfo = { total: p[1], used: p[2], free: p[3] || '0', percent: total > 0 ? Math.round((used / total) * 100) : 0 };
      }

      // CPU
      const cpuModel = await runCmd('grep "model name" /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2');
      const cpuCores = await runCmd('nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null');
      const loadAvg = await runCmd('cat /proc/loadavg 2>/dev/null | cut -d" " -f1-3');
      if (cpuModel || cpuCores) {
        result.cpuInfo = { model: cpuModel.trim() || 'unknown', cores: parseInt(cpuCores) || 0, loadAvg: loadAvg || '0' };
      }

      // Pending patches (Linux)
      const aptPatches = await runCmd('apt list --upgradable 2>/dev/null | grep -c upgradable || echo 0');
      const yumPatches = await runCmd('yum check-update 2>/dev/null | grep -cE "^\\S+\\s+\\S+\\s+\\S+" || echo 0');
      const patchCount = parseInt(aptPatches) || parseInt(yumPatches) || 0;
      if (patchCount > 0) {
        const patchList = await runCmd('apt list --upgradable 2>/dev/null | head -20 || yum check-update 2>/dev/null | head -20');
        result.pendingPatches = patchList.split('\n').filter(l => l.includes('upgradable') || l.match(/^\S+\s+\S+\s+\S+/)).slice(0, 20);
      }

      // Running services
      const servicesOut = await runCmd('systemctl list-units --type=service --state=running --no-legend 2>/dev/null | head -20');
      if (servicesOut) {
        result.runningServices = servicesOut.split('\n').filter(l => l.trim()).map(line => {
          const p = line.trim().split(/\s+/);
          return { name: p[0]?.replace('.service', ''), status: p[2] || 'running' };
        });
      }

      // Open ports
      const ssOut = await runCmd('ss -tlnp 2>/dev/null | tail -20 || netstat -tlnp 2>/dev/null | tail -20');
      if (ssOut) {
        result.openPorts = ssOut.split('\n').filter(l => l.includes('LISTEN')).map(line => {
          const portMatch = line.match(/:(\d+)\s/);
          const procMatch = line.match(/users:\(\("([^"]+)"/) || line.match(/\d+\/(\S+)/);
          return { port: portMatch ? parseInt(portMatch[1]) : 0, process: procMatch?.[1] || 'unknown' };
        }).filter(p => p.port > 0);
      }

      // Last logins
      const lastOut = await runCmd('last -10 -w 2>/dev/null | head -10');
      if (lastOut) {
        result.lastLogins = lastOut.split('\n').filter(l => l.trim() && !l.includes('wtmp')).map(line => {
          const p = line.trim().split(/\s+/);
          return { user: p[0], terminal: p[1], from: p[2], time: p.slice(3).join(' ') };
        });
      }

      // User accounts
      const usersOut = await runCmd('cut -d: -f1 /etc/passwd 2>/dev/null | grep -v "^#"');
      if (usersOut) result.users = usersOut.split('\n').filter(u => u.trim());

      // Firewall status
      result.firewallStatus = await runCmd('ufw status 2>/dev/null || firewall-cmd --state 2>/dev/null || iptables -L -n 2>/dev/null | head -5') || 'unknown';

    } catch (err: any) {
      result.error = err.message;
    }

    return result;
  }

  private static buildSshCommand(ip: string, creds: { username: string; password?: string; privateKeyPath?: string }, cmd: string): string {
    const sshOpts = '-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes';
    if (creds.privateKeyPath) {
      return `ssh ${sshOpts} -i ${creds.privateKeyPath} ${creds.username}@${ip} '${cmd}'`;
    }
    if (creds.password) {
      return `sshpass -p '${creds.password}' ssh ${sshOpts} ${creds.username}@${ip} '${cmd}'`;
    }
    return `ssh ${sshOpts} ${creds.username}@${ip} '${cmd}'`;
  }
}
