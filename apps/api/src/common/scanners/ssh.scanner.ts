import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SshScanResult {
  ip: string;
  hostname?: string;
  osInfo?: { kernel: string; distro?: string; arch: string; version?: string };
  uptime?: string;
  diskUsage?: { filesystem: string; size: string; used: string; available: string; percent: string; mount: string; type?: string }[];
  memoryInfo?: { total: string; used: string; free: string; percent: number; swapTotal?: string; swapUsed?: string };
  cpuInfo?: { model: string; cores: number; physicalCores?: number; loadAvg: string; cacheSize?: string; virtualization?: string };
  pendingPatches?: string[];
  runningServices?: { name: string; status: string }[];
  openPorts?: { port: number; process: string; pid?: string; protocol?: 'tcp' | 'udp' }[];
  lastLogins?: { user: string; terminal: string; from: string; time: string }[];
  failedLoginsCount?: number;
  installedPackages?: number;
  packages?: { name: string; version: string; publisher?: string; description?: string }[];
  users?: string[];
  activeShellUsers?: string[];
  firewallStatus?: string;
  sshConfigAudit?: { permitRootLogin?: string; passwordAuth?: string; port?: string };
  hardwareDetails?: {
    serialNumber?: string;
    biosVendor?: string;
    biosVersion?: string;
    motherboard?: string;
    tpmEnabled?: boolean;
    tpmVersion?: string;
  };
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
    try {
      await execAsync(`which ${cmd}`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
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
      // 1. Identify Remote Platform (macOS vs Linux)
      const uname = await runCmd('uname -s');
      const isMac = uname.toLowerCase().includes('darwin');
      const arch = await runCmd('uname -m');

      // OS Distro Detection
      let distro = 'Unknown OS';
      let osVer = 'Unknown Version';
      let kernel = await runCmd('uname -r');

      if (isMac) {
        distro = await runCmd('sw_vers -productName');
        osVer = await runCmd('sw_vers -productVersion');
      } else {
        const osRelease = await runCmd('cat /etc/os-release 2>/dev/null');
        if (osRelease) {
          const prettyMatch = osRelease.match(/PRETTY_NAME="([^"]+)"/) || osRelease.match(/PRETTY_NAME=([^"\n]+)/);
          const versionMatch = osRelease.match(/VERSION_ID="([^"]+)"/) || osRelease.match(/VERSION_ID=([^"\n]+)/);
          distro = prettyMatch ? prettyMatch[1] : 'Linux';
          osVer = versionMatch ? versionMatch[1] : '';
        } else {
          const issue = await runCmd('cat /etc/issue 2>/dev/null');
          if (issue) distro = issue.split('\n')[0].replace(/\\./g, '').trim();
        }
      }

      result.osInfo = {
        kernel: kernel || 'unknown',
        arch: arch || 'unknown',
        distro: distro,
        version: osVer,
      };

      // Hostname & Uptime
      result.hostname = await runCmd('hostname');
      result.uptime = await runCmd('uptime -p 2>/dev/null || uptime');

      // Deep Hardware serials, BIOS, TPM, and Motherboard remote audit
      let serialNumber = 'Unknown';
      let biosVendor = 'Unknown';
      let biosVersion = 'Unknown';
      let motherboard = 'Unknown';
      let tpmEnabled = false;
      let tpmVersion = 'N/A';

      if (isMac) {
        serialNumber = (await runCmd("ioreg -rd1 -c IOPlatformExpertDevice | awk -F'\"' '/IOPlatformSerialNumber/ { print $4 }'")).trim() || 'Unknown';
        biosVendor = 'Apple Inc.';
        biosVersion = (await runCmd('sysctl -n machdep.cpu.brand_string 2>/dev/null || sysctl -n hw.model 2>/dev/null')).trim() || 'Apple Silicon';
        motherboard = (await runCmd('sysctl -n hw.model 2>/dev/null')).trim() || 'Apple Baseboard';
        tpmEnabled = true;
        tpmVersion = 'Secure Enclave';
      } else {
        serialNumber = (await runCmd('cat /sys/class/dmi/id/product_serial 2>/dev/null || cat /sys/class/dmi/id/board_serial 2>/dev/null || echo "Unknown"')).trim();
        biosVendor = (await runCmd('cat /sys/class/dmi/id/bios_vendor 2>/dev/null || echo "Unknown"')).trim();
        biosVersion = (await runCmd('cat /sys/class/dmi/id/bios_version 2>/dev/null || echo "Unknown"')).trim();
        
        const boardVendor = (await runCmd('cat /sys/class/dmi/id/board_vendor 2>/dev/null')).trim();
        const boardName = (await runCmd('cat /sys/class/dmi/id/board_name 2>/dev/null')).trim();
        if (boardVendor || boardName) {
          motherboard = `${boardVendor} ${boardName}`.trim();
        }

        const tpmCheck = await runCmd('ls /sys/class/tpm/tpm0 2>/dev/null || ls /dev/tpm0 2>/dev/null');
        if (tpmCheck) {
          tpmEnabled = true;
          tpmVersion = (await runCmd('cat /sys/class/tpm/tpm0/device/description 2>/dev/null || echo "2.0"')).trim() || '2.0';
        }
      }

      result.hardwareDetails = {
        serialNumber,
        biosVendor,
        biosVersion,
        motherboard,
        tpmEnabled,
        tpmVersion,
      };

      // 2. Hardware and Performance Audit
      // CPU Information
      let cpuModel = 'Unknown CPU';
      let logicalCores = 0;
      let physicalCores = 0;
      let cpuVirt = 'None';
      let cacheSize = 'Unknown';

      if (isMac) {
        cpuModel = await runCmd('sysctl -n machdep.cpu.brand_string');
        const cores = await runCmd('sysctl -n hw.ncpu');
        logicalCores = parseInt(cores) || 0;
        const pCores = await runCmd('sysctl -n hw.physicalcpu');
        physicalCores = parseInt(pCores) || logicalCores;
      } else {
        cpuModel = await runCmd('grep "model name" /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2');
        const cores = await runCmd('nproc 2>/dev/null || grep -c "^processor" /proc/cpuinfo 2>/dev/null');
        logicalCores = parseInt(cores) || 0;
        
        const pCores = await runCmd('grep "cpu cores" /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2');
        physicalCores = parseInt(pCores) || logicalCores;

        const cSize = await runCmd('grep "cache size" /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2');
        if (cSize) cacheSize = cSize.trim();

        // Virtualization check flags
        const flags = await runCmd('grep -E "(vmx|svm)" /proc/cpuinfo 2>/dev/null | head -1');
        if (flags) {
          cpuVirt = flags.includes('vmx') ? 'Intel VT-x' : 'AMD-V';
        }
      }

      const loadAvg = await runCmd('cat /proc/loadavg 2>/dev/null | cut -d" " -f1-3 || uptime | awk -F "load averages:" \'{print $2}\' || uptime | awk -F "load average:" \'{print $2}\'');
      result.cpuInfo = {
        model: cpuModel.trim() || 'unknown',
        cores: logicalCores,
        physicalCores: physicalCores,
        loadAvg: loadAvg?.trim() || '0.00, 0.00, 0.00',
        virtualization: cpuVirt !== 'None' ? cpuVirt : undefined,
        cacheSize: cacheSize !== 'Unknown' ? cacheSize : undefined,
      };

      // RAM Health
      if (isMac) {
        const memBytes = await runCmd('sysctl -n hw.memsize');
        const totalGb = Math.round((parseInt(memBytes) || 0) / (1024 * 1024 * 1024));
        // Simple vm_stat parser
        const vmStat = await runCmd('vm_stat');
        const pageSizeMatch = vmStat.match(/page size of (\d+) bytes/);
        const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1]) : 4096;
        const freePagesMatch = vmStat.match(/Pages free:\s+(\d+)/);
        const freePages = freePagesMatch ? parseInt(freePagesMatch[1]) : 0;
        const freeGb = Math.round((freePages * pageSize) / (1024 * 1024 * 1024));
        const usedGb = Math.max(0, totalGb - freeGb);

        result.memoryInfo = {
          total: `${totalGb} GB`,
          used: `${usedGb} GB`,
          free: `${freeGb} GB`,
          percent: totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0,
        };
      } else {
        const memOut = await runCmd('free -b 2>/dev/null || free -m 2>/dev/null');
        if (memOut) {
          const lines = memOut.split('\n');
          const isBytes = memOut.includes('total') && !memOut.includes('used'); // check free output structure
          const memLine = lines.find(l => l.includes('Mem:'));
          const swapLine = lines.find(l => l.includes('Swap:'));

          if (memLine) {
            const parts = memLine.trim().split(/\s+/);
            const rawTotal = parseFloat(parts[1]) || 0;
            const rawUsed = parseFloat(parts[2]) || 0;
            const rawFree = parseFloat(parts[3]) || 0;

            const unit = memOut.includes('total') ? 'GB' : 'MB';
            const divisor = unit === 'GB' ? 1 : 1024;

            const totalNum = divisor === 1 ? Math.round(rawTotal / (1024*1024*1024)) : rawTotal;
            const usedNum = divisor === 1 ? Math.round(rawUsed / (1024*1024*1024)) : rawUsed;
            const freeNum = divisor === 1 ? Math.round(rawFree / (1024*1024*1024)) : rawFree;

            result.memoryInfo = {
              total: `${totalNum} GB`,
              used: `${usedNum} GB`,
              free: `${freeNum} GB`,
              percent: rawTotal > 0 ? Math.round((rawUsed / rawTotal) * 100) : 0,
            };

            if (swapLine && result.memoryInfo) {
              const sParts = swapLine.trim().split(/\s+/);
              const sTotal = parseFloat(sParts[1]) || 0;
              const sUsed = parseFloat(sParts[2]) || 0;
              result.memoryInfo.swapTotal = divisor === 1 ? `${Math.round(sTotal / (1024*1024*1024))} GB` : `${sTotal} MB`;
              result.memoryInfo.swapUsed = divisor === 1 ? `${Math.round(sUsed / (1024*1024*1024))} GB` : `${sUsed} MB`;
            }
          }
        }
      }

      // Disk Usage Mount Map
      const dfOut = await runCmd('df -h -T 2>/dev/null || df -h');
      if (dfOut) {
        result.diskUsage = dfOut.split('\n').slice(1).filter(l => l.trim()).map(line => {
          const p = line.trim().split(/\s+/);
          // Columns if -T: filesystem, type, size, used, avail, pcent, target
          if (dfOut.includes('Type') || p.length >= 7) {
            return { filesystem: p[0], type: p[1], size: p[2], used: p[3], available: p[4], percent: p[5], mount: p[6] || '/' };
          }
          return { filesystem: p[0], size: p[1], used: p[2], available: p[3], percent: p[4], mount: p[5] || '/' };
        });
      }

      // 3. Security posture auditing
      // Accounts Audit (all users and users with active shell capabilities)
      const passwdOut = await runCmd('cat /etc/passwd 2>/dev/null');
      if (passwdOut) {
        const users: string[] = [];
        const shellUsers: string[] = [];
        const lines = passwdOut.split('\n');
        for (const l of lines) {
          const parts = l.split(':');
          if (parts.length >= 7) {
            const username = parts[0];
            const shell = parts[6]?.trim();
            users.push(username);
            // Check for valid active interactive login shells
            if (shell && !shell.includes('nologin') && !shell.includes('false') && !shell.includes('usr/bin/false')) {
              shellUsers.push(username);
            }
          }
        }
        result.users = users.slice(0, 100); // cap to avoid bloating scan result
        result.activeShellUsers = shellUsers;
      }

      // Firewall Configuration Audit
      let firewall = 'Disabled';
      const ufw = await runCmd('sudo ufw status 2>/dev/null || ufw status 2>/dev/null');
      const firewalld = await runCmd('sudo firewall-cmd --state 2>/dev/null || firewall-cmd --state 2>/dev/null');
      const iptables = await runCmd('sudo iptables -L -n 2>/dev/null | head -5');
      const pfctl = isMac ? await runCmd('sudo pfctl -s info 2>/dev/null') : '';

      if (ufw && !ufw.includes('inactive')) firewall = `UFW (${ufw.split('\n')[0]})`;
      else if (firewalld && firewalld.includes('running')) firewall = 'Firewalld (Running)';
      else if (pfctl && pfctl.includes('Enabled')) firewall = 'PF Firewall (Enabled)';
      else if (iptables && iptables.includes('Chain')) firewall = 'iptables Active';

      result.firewallStatus = firewall;

      // Pending Patches Audits (Multi-OS support)
      let patchCount = 0;
      let patches: string[] = [];

      if (isMac) {
        const macPatches = await runCmd('softwareupdate -l 2>/dev/null | grep -E "^\\s+\\*\\s+"');
        if (macPatches) {
          patches = macPatches.split('\n').map(l => l.replace(/^\s+\*\s+/, '').trim()).filter(Boolean);
          patchCount = patches.length;
        }
      } else {
        const distroLower = distro.toLowerCase();
        if (distroLower.includes('ubuntu') || distroLower.includes('debian')) {
          // Debian/APT upgradable
          const aptOut = await runCmd('apt list --upgradable 2>/dev/null | grep -v "Listing..."');
          if (aptOut) {
            patches = aptOut.split('\n').map(l => l.trim()).filter(l => l.includes('upgradable'));
            patchCount = patches.length;
          }
        } else if (distroLower.includes('centos') || distroLower.includes('redhat') || distroLower.includes('fedora') || distroLower.includes('rocky')) {
          // RedHat/YUM upgradable
          const yumOut = await runCmd('yum check-update 2>/dev/null');
          if (yumOut) {
            patches = yumOut.split('\n').filter(l => l.match(/^\S+\s+\S+\s+\S+/)).map(l => l.trim());
            patchCount = patches.length;
          }
        } else if (distroLower.includes('alpine')) {
          const apkOut = await runCmd('apk version -v 2>/dev/null | grep -E "(<|{|>)"');
          if (apkOut) {
            patches = apkOut.split('\n').map(l => l.trim());
            patchCount = patches.length;
          }
        }
      }

      result.pendingPatches = patches.slice(0, 30);
      
      // Full Software Inventory Discovery
      const packages: { name: string; version: string; publisher?: string; description?: string }[] = [];
      const distroLower = (distro || '').toLowerCase();
      
      try {
        if (isMac) {
          // Homebrew packages
          const brewOut = await runCmd('brew list --versions 2>/dev/null');
          if (brewOut) {
            brewOut.split('\n').forEach(line => {
              const [name, version] = line.trim().split(/\s+/);
              if (name && version) packages.push({ name, version, publisher: 'Homebrew' });
            });
          }
          // System Applications
          const appsOut = await runCmd('ls /Applications 2>/dev/null');
          if (appsOut) {
            appsOut.split('\n').forEach(app => {
              if (app.endsWith('.app')) {
                packages.push({ name: app.replace('.app', ''), version: 'Latest', publisher: 'Apple' });
              }
            });
          }
        } else if (distroLower.includes('ubuntu') || distroLower.includes('debian')) {
          const dpkgOut = await runCmd('dpkg-query -W -f=\'${Package}|${Version}|${Maintainer}|${Description}\n\' 2>/dev/null');
          if (dpkgOut) {
            dpkgOut.split('\n').forEach(line => {
              const [name, version, pub, desc] = line.trim().split('|');
              if (name && version) packages.push({ name, version, publisher: pub, description: desc?.split('.')[0] });
            });
          }
        } else if (distroLower.includes('centos') || distroLower.includes('redhat') || distroLower.includes('fedora') || distroLower.includes('rocky')) {
          const rpmOut = await runCmd('rpm -qa --queryformat "%{NAME}|%{VERSION}|%{VENDOR}|%{SUMMARY}\n" 2>/dev/null');
          if (rpmOut) {
            rpmOut.split('\n').forEach(line => {
              const [name, version, pub, desc] = line.trim().split('|');
              if (name && version) packages.push({ name, version, publisher: pub, description: desc });
            });
          }
        } else if (distroLower.includes('alpine')) {
          const apkOut = await runCmd('apk info -v 2>/dev/null');
          if (apkOut) {
            apkOut.split('\n').forEach(line => {
              const match = line.match(/^([a-z0-9-]+)-([0-9].*)$/);
              if (match) packages.push({ name: match[1], version: match[2], publisher: 'Alpine' });
            });
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to fetch package list for ${ip}: ${e.message}`);
      }

      result.packages = packages;
      result.installedPackages = packages.length;

      // Open Listening Ports with Processes mapping
      const openPorts: SshScanResult['openPorts'] = [];
      let portsCommand = 'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null';
      if (isMac) {
        portsCommand = 'lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null';
      }

      const portsOut = await runCmd(portsCommand);
      if (portsOut) {
        const lines = portsOut.split('\n');
        for (const line of lines) {
          if (isMac) {
            // macOS lsof: COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
            // example:   sshd    224 root    3u  IPv4 0x...      0t0  TCP *:22 (LISTEN)
            const match = line.match(/^(\S+)\s+(\d+)\s+.*?TCP\s+.*?[:*](\d+)\s+\(LISTEN\)/);
            if (match) {
              const portNum = parseInt(match[3]);
              if (portNum > 0 && !openPorts.some(p => p.port === portNum)) {
                openPorts.push({ port: portNum, process: match[1], pid: match[2], protocol: 'tcp' });
              }
            }
          } else {
            // Linux ss/netstat listen line:
            // LISTEN   0    128   0.0.0.0:22   0.0.0.0:*   users:(("sshd",pid=1024,fd=3))
            const portMatch = line.match(/:(\d+)\s+/);
            if (portMatch) {
              const portNum = parseInt(portMatch[1]);
              if (portNum > 0 && !openPorts.some(p => p.port === portNum)) {
                const procMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/) || line.match(/(\d+)\/(\S+)/);
                openPorts.push({
                  port: portNum,
                  process: procMatch ? (procMatch[1] || procMatch[2]) : 'unknown',
                  pid: procMatch ? (procMatch[2] || procMatch[1]) : undefined,
                  protocol: 'tcp',
                });
              }
            }
          }
        }
      }
      result.openPorts = openPorts.sort((a, b) => a.port - b.port);

      // Failed login audits
      const lastbOut = await runCmd('sudo lastb -30 2>/dev/null || lastb -30 2>/dev/null');
      if (lastbOut) {
        const failedCount = lastbOut.split('\n').filter(l => l.trim() && !l.includes('btmp')).length;
        result.failedLoginsCount = failedCount;
      } else {
        // Fallback: search auth logs for failed messages count
        const authCount = await runCmd('grep -c "Failed password" /var/log/auth.log 2>/dev/null || grep -c "Failed password" /var/log/secure 2>/dev/null || echo 0');
        result.failedLoginsCount = parseInt(authCount) || 0;
      }

      // Last Logins
      const lastOut = await runCmd('last -10 -w 2>/dev/null || last -10 2>/dev/null');
      if (lastOut) {
        result.lastLogins = lastOut.split('\n').filter(l => l.trim() && !l.includes('wtmp') && !l.includes('reboot')).slice(0, 10).map(line => {
          const p = line.trim().split(/\s+/);
          return { user: p[0], terminal: p[1], from: p[2] || 'localhost', time: p.slice(3).join(' ') };
        });
      }

      // SSHd Daemon Safety Settings Audit
      const sshdConfig = await runCmd('cat /etc/ssh/sshd_config 2>/dev/null || cat /etc/sshd_config 2>/dev/null');
      if (sshdConfig) {
        const permitRootMatch = sshdConfig.match(/^\s*PermitRootLogin\s+(\S+)/im);
        const passwordAuthMatch = sshdConfig.match(/^\s*PasswordAuthentication\s+(\S+)/im);
        const portMatch = sshdConfig.match(/^\s*Port\s+(\d+)/im);

        result.sshConfigAudit = {
          permitRootLogin: permitRootMatch ? permitRootMatch[1] : 'yes (default)',
          passwordAuth: passwordAuthMatch ? passwordAuthMatch[1] : 'yes (default)',
          port: portMatch ? portMatch[1] : '22',
        };
      }

    } catch (err: any) {
      result.error = err.message;
      this.logger.error(`SSH audit failed on ${ip}: ${err.message}`);
    }

    return result;
  }

  private static buildSshCommand(ip: string, creds: { username: string; password?: string; privateKeyPath?: string }, cmd: string): string {
    // Standard secure defaults for script automation
    const sshOpts = '-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes -o UserKnownHostsFile=/dev/null';
    // Quote and escape single quotes in commands correctly
    const cleanCmd = cmd.replace(/'/g, "'\\''");

    if (creds.privateKeyPath) {
      return `ssh ${sshOpts} -i ${creds.privateKeyPath} ${creds.username}@${ip} '${cleanCmd}'`;
    }
    if (creds.password) {
      return `sshpass -p '${creds.password.replace(/'/g, "'\\''")}' ssh ${sshOpts} ${creds.username}@${ip} '${cleanCmd}'`;
    }
    return `ssh ${sshOpts} ${creds.username}@${ip} '${cleanCmd}'`;
  }
}
