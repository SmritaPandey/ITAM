const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');

const VERSION = '1.1.0';

function exec(cmd) {
  try { return execSync(cmd, { timeout: 10000, encoding: 'utf-8' }).trim(); } catch { return ''; }
}

function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        result.push({ name, ip: addr.address, mac: addr.mac, netmask: addr.netmask });
      }
    }
  }
  return result;
}

function getPrimaryIP() {
  const ifaces = getNetworkInterfaces();
  return ifaces.length > 0 ? ifaces[0].ip : '127.0.0.1';
}

function getPrimaryMAC() {
  const ifaces = getNetworkInterfaces();
  return ifaces.length > 0 ? ifaces[0].mac : undefined;
}

function getDiskUsage() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      return [];
    } else {
      const output = exec("df -h / /home 2>/dev/null | tail -n+2");
      return output.split('\n').filter(Boolean).map(line => {
        const parts = line.split(/\s+/);
        return { mount: parts[5], totalGb: parts[1], usedGb: parts[2], freeGb: parts[3], usedPercent: parts[4] };
      });
    }
  } catch { return []; }
}

function getInstalledSoftware() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const output = exec("system_profiler SPApplicationsDataType -json 2>/dev/null | head -c 8000");
      try {
        const data = JSON.parse(output);
        const apps = data.SPApplicationsDataType || [];
        return apps.slice(0, 30).map(a => ({ name: a._name, version: a.version || 'N/A', path: a.path }));
      } catch {
        const brew = exec('brew list --versions 2>/dev/null | head -20');
        return brew.split('\n').filter(Boolean).map(l => {
          const parts = l.split(' ');
          return { name: parts[0], version: parts.slice(1).join(' ') };
        });
      }
    }
    return [];
  } catch { return []; }
}

function getRunningProcesses() {
  try {
    const output = exec('ps aux 2>/dev/null');
    if (!output) return [];
    const lines = output.split('\n').slice(1);
    const procs = lines.map(l => {
      const p = l.trim().split(/\s+/);
      if (p.length < 11) return null;
      return {
        user: p[0],
        pid: p[1],
        cpu: p[2],
        mem: p[3],
        command: p.slice(10).join(' ')
      };
    }).filter(Boolean);
    procs.sort((a, b) => parseFloat(b.mem || 0) - parseFloat(a.mem || 0));
    return procs.slice(0, 15);
  } catch { return []; }
}

function getSecurityInfo() {
  const platform = os.platform();
  const info = { firewallEnabled: false, encryptionEnabled: false };
  try {
    if (platform === 'darwin') {
      info.firewallEnabled = exec('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null').includes('enabled');
      info.encryptionEnabled = exec('fdesetup status 2>/dev/null').includes('On');
      info.encryptionMethod = info.encryptionEnabled ? 'FileVault' : null;
    }
  } catch {}
  return info;
}

function getUsbDevices() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const output = exec('system_profiler SPUSBDataType -json 2>/dev/null | head -c 5000');
      try {
        const data = JSON.parse(output);
        const items = data.SPUSBDataType || [];
        const devices = [];
        function walk(list) {
          for (const item of list) {
            if (item._name && !item._name.includes('Hub')) {
              devices.push({ name: item._name, vendor: item.manufacturer || '', serial: item.serial_num || '', type: 'USB' });
            }
            if (item._items) walk(item._items);
          }
        }
        walk(items);
        return devices;
      } catch { return []; }
    }
  } catch {}
  return [];
}

function getRunningServices() {
  try {
    return exec('launchctl list 2>/dev/null | head -20').split('\n').slice(1).map(l => {
      const parts = l.split('\t');
      return { name: parts[2] || parts[0], pid: parts[0], status: parts[1] === '0' ? 'running' : 'stopped' };
    }).filter(s => s.name);
  } catch {}
  return [];
}

function getSystemUsers() {
  const users = new Set();
  try {
    if (fs.existsSync('/Users')) {
      const dirs = fs.readdirSync('/Users');
      for (const dir of dirs) {
        if (dir && dir !== 'Shared' && dir !== 'Guest' && !dir.startsWith('.')) {
          users.add(dir);
        }
      }
    }
  } catch {}
  return Array.from(users);
}

function getActiveShellUsers() {
  const active = new Set();
  try {
    const output = exec('who');
    output.split('\n').forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts[0]) active.add(parts[0]);
    });
  } catch {}
  return Array.from(active);
}

function getListeningPorts() {
  const ports = [];
  try {
    const lsofOutput = exec('lsof -i -P -n -sTCP:LISTEN 2>/dev/null');
    if (lsofOutput) {
      const lines = lsofOutput.split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 8) {
          const proc = parts[0];
          const pid = parts[1];
          const proto = parts[4];
          const nameNode = parts[8];
          const portStr = nameNode.split(':').pop();
          const port = parseInt(portStr, 10);
          if (port && !isNaN(port)) {
            ports.push({ port, process: proc, pid, protocol: proto });
          }
        }
      }
    }
  } catch {}
  return ports;
}

const info = {
  collectedAt: new Date().toISOString(),
  agentVersion: VERSION,
  hardware: {
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    cpuCores: os.cpus().length,
    totalRamMb: Math.round(os.totalmem() / 1048576),
    freeRamMb: Math.round(os.freemem() / 1048576),
    diskDrives: getDiskUsage(),
  },
  operatingSystem: {
    platform: os.platform(),
    type: os.type(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: Math.round(os.uptime()),
  },
  network: {
    interfaces: getNetworkInterfaces(),
    hostname: os.hostname(),
  },
  security: {
    ...getSecurityInfo(),
    users: getSystemUsers(),
    activeShellUsers: getActiveShellUsers(),
    failedLoginsCount: 0,
    openPorts: getListeningPorts(),
  },
  software: getInstalledSoftware(),
  processes: getRunningProcesses(),
  usbDevices: getUsbDevices(),
  services: getRunningServices(),
};

console.log('=== SYSTEM INFO DATA ===');
console.log(JSON.stringify(info, null, 2));
console.log('Payload Size:', JSON.stringify(info).length, 'bytes');
