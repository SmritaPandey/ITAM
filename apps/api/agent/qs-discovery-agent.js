#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// QS Discovery Agent — Lightweight System Reporter
// ═══════════════════════════════════════════════════════════════
//
// Run on any laptop/desktop on the LAN. Reports hardware, OS,
// software, network info back to the main QS Asset server.
//
// Serves a premium local background HTTP Dashboard on port 49152
// and automatically launches the OS native browser on startup.
// ═══════════════════════════════════════════════════════════════

const os = require('os');
const { execSync, exec } = require('child_process');
const https = require('https');
const http = require('http');

const fs = require('fs');
const path = require('path');

const VERSION = '1.1.0';

// ─── Logging & Local Log Buffer API ───────────────────────────
const localLogs = [];
function log(type, msg) {
  const time = new Date().toLocaleTimeString();
  localLogs.push({ time, type, message: msg });
  if (localLogs.length > 100) localLogs.shift();
  
  if (type === 'heartbeat') {
    console.log(`💓 ${msg}`);
  } else if (type === 'error') {
    console.error(`❌ ${msg}`);
  } else if (type === 'security') {
    console.warn(`🛡️  ${msg}`);
  } else if (type === 'success') {
    console.log(`✅ ${msg}`);
  } else {
    console.log(msg);
  }
}

// ─── Parse Args ─────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, envKey, fallback) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.env[envKey] || fallback;
}

let SERVER = getArg('--server', 'QS_AGENT_SERVER', '') || process.env.RECONAPM_SERVER || 'http://localhost:4100';
let USER = getArg('--user', 'QS_AGENT_USER', '') || process.env.RECONAPM_USER || '';
let PASS = getArg('--pass', 'QS_AGENT_PASS', '') || process.env.RECONAPM_PASS || '';
const INTERVAL = parseInt(getArg('--interval', 'QS_AGENT_INTERVAL', '') || process.env.RECONAPM_INTERVAL || '60', 10);
const SILENT_MODE = args.includes('--silent') || process.env.QS_AGENT_SILENT === 'true';

let tokenFromFile = '';
const configPath = path.join(__dirname, 'config.json');

if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.server) SERVER = config.server;
    if (config.token) tokenFromFile = config.token;
    log('info', '📦 Loaded local config.json successfully');
  } catch (e) {
    log('error', `⚠️ Failed to parse config.json: ${e.message}`);
  }
}

const API_BASE = `${SERVER}/api/v1`;

if (!tokenFromFile && (!USER || !PASS)) {
  log('error', '❌ Usage: node qs-discovery-agent.js --server http://SERVER:4100 --user EMAIL --pass PASSWORD');
  process.exit(1);
}

let accessToken = '';
let agentId = '';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    fetch(url, options)
      .then(async (res) => {
        const text = await res.text();
        let responseData;
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
        resolve({ status: res.status, data: responseData });
      })
      .catch(reject);
  });
}

// ─── Login ──────────────────────────────────────────────────
async function login() {
  if (tokenFromFile) {
    log('info', '🔑 Authenticating using pre-seeded secure token...');
    accessToken = tokenFromFile;
    return true;
  }
  log('info', `🔑 Authenticating as ${USER}...`);
  const res = await request('POST', '/auth/login', { email: USER, password: PASS });
  if (res.status === 200 || res.status === 201) {
    accessToken = res.data.accessToken || res.data.access_token;
    log('success', 'Authenticated successfully');
    return true;
  }
  log('error', `Login failed (${res.status}): ${res.data.message || res.data}`);
  return false;
}

// ─── Collect System Info ────────────────────────────────────
function execCmd(cmd) {
  try { return execSync(cmd, { timeout: 10000, encoding: 'utf-8' }).trim(); } catch { return ''; }
}

let primaryIpAddress = '127.0.0.1';
let primaryMacAddress = undefined;

async function resolveActiveNetworkInterface() {
  const detectActiveInterface = () => {
    return new Promise((resolve) => {
      const dgram = require('dgram');
      const socket = dgram.createSocket('udp4');
      
      const timeoutId = setTimeout(() => {
        try { socket.close(); } catch {}
        resolve(null);
      }, 2000);

      socket.connect(53, '8.8.8.8', () => {
        clearTimeout(timeoutId);
        try {
          const { address } = socket.address();
          socket.close();
          resolve(address);
        } catch {
          resolve(null);
        }
      });

      socket.on('error', () => {
        clearTimeout(timeoutId);
        try { socket.close(); } catch {}
        resolve(null);
      });
    });
  };

  const activeIp = await detectActiveInterface();
  const interfaces = os.networkInterfaces();
  let matchedIface = null;

  // 1. Try to match the active UDP outbound IP address
  if (activeIp) {
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && addr.address === activeIp) {
          matchedIface = { name, ip: addr.address, mac: addr.mac, netmask: addr.netmask };
          break;
        }
      }
      if (matchedIface) break;
    }
  }

  // 2. Fallback: Heuristic priority-name sorting
  if (!matchedIface) {
    const ifaces = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const lowerName = name.toLowerCase();
          let score = 100;

          if (lowerName.includes('docker') || lowerName.includes('veth') || lowerName.includes('br-') || lowerName.includes('virbr')) score -= 80;
          if (lowerName.includes('vboxnet') || lowerName.includes('vbox') || lowerName.includes('virtualbox')) score -= 70;
          if (lowerName.includes('vmnet') || lowerName.includes('vmware') || lowerName.includes('virtual')) score -= 60;
          if (lowerName.includes('vpn') || lowerName.includes('tun') || lowerName.includes('tap') || lowerName.includes('ppp')) score -= 50;

          if (lowerName.startsWith('en') || lowerName.startsWith('eth') || lowerName.startsWith('wlan') || lowerName.startsWith('wlp')) score += 20;
          if (lowerName.includes('ethernet') || lowerName.includes('wi-fi') || lowerName.includes('wifi')) score += 25;

          ifaces.push({ name, ip: addr.address, mac: addr.mac, netmask: addr.netmask, score });
        }
      }
    }

    if (ifaces.length > 0) {
      ifaces.sort((a, b) => b.score - a.score);
      matchedIface = ifaces[0];
    }
  }

  if (matchedIface) {
    primaryIpAddress = matchedIface.ip;
    primaryMacAddress = matchedIface.mac;
    log('info', `Resolved active physical network interface: ${matchedIface.name} (IP: ${primaryIpAddress}, MAC: ${primaryMacAddress || 'unknown'})`);
  } else {
    primaryIpAddress = '127.0.0.1';
    primaryMacAddress = undefined;
    log('info', 'Could not detect active network interface. Defaulting to loopback.');
  }
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
  return primaryIpAddress;
}

function getPrimaryMAC() {
  return primaryMacAddress;
}

function getDiskUsage() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const output = execCmd('wmic logicaldisk get size,freespace,caption /format:list');
      const drives = [];
      const blocks = output.split('\n\n').filter(b => b.includes('Caption'));
      for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim());
        const caption = lines.find(l => l.startsWith('Caption='))?.split('=')[1];
        const free = parseInt(lines.find(l => l.startsWith('FreeSpace='))?.split('=')[1] || '0');
        const total = parseInt(lines.find(l => l.startsWith('Size='))?.split('=')[1] || '0');
        if (caption && total > 0) {
          const totalGb = Math.round(total / 1073741824);
          const usedGb = Math.round((total - free) / 1073741824);
          const freeGb = Math.round(free / 1073741824);
          drives.push({
            mount: caption,
            totalGb,
            sizeGb: totalGb,
            size: totalGb,
            usedGb,
            used: usedGb,
            freeGb,
            available: freeGb
          });
        }
      }
      return drives;
    } else {
      const output = execCmd("df -h 2>/dev/null | grep -E '^/dev/' || df -h 2>/dev/null");
      const lines = output.split('\n').filter(Boolean);
      const dataLines = lines[0]?.includes('Filesystem') ? lines.slice(1) : lines;
      return dataLines.map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6) return null;
        return {
          mount: parts[5] || parts[parts.length - 1],
          totalGb: parts[1],
          sizeGb: parts[1],
          size: parts[1],
          usedGb: parts[2],
          used: parts[2],
          freeGb: parts[3],
          available: parts[3],
          usedPercent: parts[4]
        };
      }).filter(Boolean);
    }
  } catch { return []; }
}

function getInstalledSoftware() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const output = execCmd('wmic product get name,version /format:csv 2>nul');
      return output.split('\n').filter(l => l.includes(',')).slice(1, 30).map(l => {
        const parts = l.trim().split(',');
        return { name: parts[1], version: parts[2] };
      }).filter(s => s.name);
    } else if (platform === 'darwin') {
      const apps = [];
      try {
        const dirs = ['/Applications', path.join(os.homedir(), 'Applications')];
        for (const dir of dirs) {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              if (file.endsWith('.app')) {
                const appName = file.slice(0, -4);
                let version = 'N/A';
                try {
                  const plistPath = path.join(dir, file, 'Contents', 'Info.plist');
                  if (fs.existsSync(plistPath)) {
                    const content = fs.readFileSync(plistPath, 'utf8');
                    const match = content.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/) ||
                                  content.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/);
                    if (match) version = match[1];
                  }
                } catch {}
                apps.push({ name: appName, version, path: path.join(dir, file) });
              }
            }
          }
        }
      } catch {}

      if (apps.length > 0) {
        return apps.slice(0, 40);
      } else {
        const brew = execCmd('brew list --versions 2>/dev/null | head -20');
        return brew.split('\n').filter(Boolean).map(l => {
          const parts = l.split(' ');
          return { name: parts[0], version: parts.slice(1).join(' ') };
        });
      }
    } else {
      // Linux: dpkg or rpm
      const dpkg = execCmd("dpkg-query -W -f='${Package} ${Version}\\n' 2>/dev/null | head -30");
      if (dpkg) return dpkg.split('\n').filter(Boolean).map(l => { const p = l.split(' '); return { name: p[0], version: p[1] }; });
      const rpm = execCmd("rpm -qa --qf '%{NAME} %{VERSION}\\n' 2>/dev/null | head -30");
      if (rpm) return rpm.split('\n').filter(Boolean).map(l => { const p = l.split(' '); return { name: p[0], version: p[1] }; });
      return [];
    }
  } catch { return []; }
}

function getRunningProcesses() {
  try {
    if (os.platform() === 'win32') {
      return execCmd('tasklist /fo csv /nh 2>nul').split('\n').slice(0, 20).map(l => {
        const parts = l.split(',').map(p => p.replace(/"/g, ''));
        return { name: parts[0], pid: parts[1], memKb: parseInt(parts[4]?.replace(/\D/g, '') || '0') };
      }).filter(p => p.name);
    } else {
      const output = execCmd('ps aux 2>/dev/null');
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
    }
  } catch { return []; }
}

function getSecurityInfo() {
  const platform = os.platform();
  const info = { firewallEnabled: false, encryptionEnabled: false };
  try {
    if (platform === 'darwin') {
      info.firewallEnabled = execCmd('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null').includes('enabled');
      info.encryptionEnabled = execCmd('fdesetup status 2>/dev/null').includes('On');
      info.encryptionMethod = info.encryptionEnabled ? 'FileVault' : null;
    } else if (platform === 'win32') {
      info.firewallEnabled = execCmd('netsh advfirewall show allprofiles 2>nul').includes('ON');
      info.encryptionEnabled = execCmd('manage-bde -status 2>nul').includes('Percentage Encrypted');
      info.encryptionMethod = info.encryptionEnabled ? 'BitLocker' : null;
    } else {
      const iptablesCount = parseInt(execCmd('sudo iptables -L -n 2>/dev/null | wc -l') || '0', 10);
      info.firewallEnabled = iptablesCount > 10 || execCmd('systemctl is-active ufw 2>/dev/null') === 'active';
    }
  } catch {}
  return info;
}

function getUsbDevices() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const output = execCmd('system_profiler SPUSBDataType -json 2>/dev/null');
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
    } else if (platform === 'linux') {
      const output = execCmd('lsusb 2>/dev/null');
      return output.split('\n').filter(l => l && !l.includes('hub')).map(l => {
        const match = l.match(/ID\s+(\S+)\s+(.*)/);
        return { name: match ? match[2] : l, vendor: match ? match[1] : '', serial: '', type: 'USB' };
      });
    } else if (platform === 'win32') {
      const output = execCmd('wmic path Win32_USBControllerDevice get Dependent /format:list 2>nul');
      return output.split('\n').filter(l => l.includes('Dependent')).slice(0, 15).map(l => ({
        name: l.split('=')[1]?.trim() || 'USB Device', vendor: '', serial: '', type: 'USB',
      }));
    }
  } catch {}
  return [];
}

function getRunningServices() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      return execCmd('launchctl list 2>/dev/null | head -20').split('\n').slice(1).map(l => {
        const parts = l.split('\t');
        return { name: parts[2] || parts[0], pid: parts[0], status: parts[1] === '0' ? 'running' : 'stopped' };
      }).filter(s => s.name);
    } else if (platform === 'linux') {
      return execCmd('systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -20').split('\n').slice(1).map(l => {
        const parts = l.trim().split(/\s+/);
        return { name: parts[0]?.replace('.service', ''), status: 'running' };
      }).filter(s => s.name && !s.name.startsWith('●'));
    } else if (platform === 'win32') {
      return execCmd('sc query type= service state= all 2>nul | findstr SERVICE_NAME STATE').split('\n')
        .reduce((acc, line, i, arr) => {
          if (line.includes('SERVICE_NAME') && arr[i+1]) {
            acc.push({ name: line.split(':')[1]?.trim(), status: arr[i+1].includes('RUNNING') ? 'running' : 'stopped' });
          }
          return acc;
        }, []).slice(0, 20);
    }
  } catch {}
  return [];
}

function getSystemUsers() {
  const platform = os.platform();
  const users = new Set();
  try {
    if (platform === 'win32') {
      const output = execCmd('net user');
      const lines = output.split('\n');
      let startParsing = false;
      for (const line of lines) {
        if (line.includes('---')) {
          startParsing = true;
          continue;
        }
        if (line.includes('The command completed successfully')) {
          break;
        }
        if (startParsing) {
          const parts = line.split(/\s{2,}/).map(u => u.trim()).filter(Boolean);
          for (const u of parts) {
            users.add(u);
          }
        }
      }
    } else if (platform === 'darwin') {
      if (fs.existsSync('/Users')) {
        const dirs = fs.readdirSync('/Users');
        for (const dir of dirs) {
          if (dir && dir !== 'Shared' && dir !== 'Guest' && !dir.startsWith('.')) {
            users.add(dir);
          }
        }
      }
      const dscl = execCmd('dscl . -list /Users');
      dscl.split('\n').forEach(u => {
        const username = u.trim();
        if (username && !username.startsWith('_') && username !== 'nobody' && username !== 'daemon') {
          users.add(username);
        }
      });
    } else {
      if (fs.existsSync('/etc/passwd')) {
        const content = fs.readFileSync('/etc/passwd', 'utf8');
        content.split('\n').forEach(line => {
          const parts = line.split(':');
          const username = parts[0];
          const uid = parseInt(parts[2], 10);
          if (username && uid >= 1000 && uid < 60000) {
            users.add(username);
          }
        });
      }
    }
  } catch (e) {
    users.add(os.userInfo().username);
  }
  if (users.size === 0) {
    users.add(os.userInfo().username);
  }
  return Array.from(users);
}

function getActiveShellUsers() {
  const platform = os.platform();
  const active = new Set();
  try {
    if (platform === 'win32') {
      const output = execCmd('query user');
      const lines = output.split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0]) {
          const username = parts[0].replace('>', '');
          active.add(username);
        }
      }
    } else {
      const output = execCmd('who');
      output.split('\n').forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts[0]) active.add(parts[0]);
      });
    }
  } catch (e) {
    active.add(os.userInfo().username);
  }
  if (active.size === 0) {
    active.add(os.userInfo().username);
  }
  return Array.from(active);
}

let mockFailedLoginCounter = 0;
function getFailedLoginsCount() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const output = execCmd('wevtutil qe Security "/q:*[System[(EventID=4625)]]" /c:20 /f:text');
      const count = (output.match(/Event ID:\s*4625/g) || []).length;
      return count;
    } else if (platform === 'darwin') {
      // Optimize from rolling 10m to 2m and tighten the query to prevent false brute force alarms
      const output = execCmd('log show --predicate \'eventMessage contains "failed to authenticate" || eventMessage contains "Authentication failed"\' --last 2m 2>/dev/null');
      const lines = output.split('\n').filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (trimmed.startsWith('Filtering the log')) return false;
        if (trimmed.startsWith('Timestamp')) return false;
        return true;
      });
      let count = 0;
      for (const line of lines) {
        if (/fail/gi.test(line)) count++;
      }
      if (count === 0) {
        return mockFailedLoginCounter;
      }
      return count;
    } else {
      let count = 0;
      if (fs.existsSync('/var/log/auth.log')) {
        const content = execCmd('grep -i "fail" /var/log/auth.log | wc -l');
        count = parseInt(content, 10) || 0;
      } else if (fs.existsSync('/var/log/secure.log')) {
        const content = execCmd('grep -i "fail" /var/log/secure.log | wc -l');
        count = parseInt(content, 10) || 0;
      }
      return count;
    }
  } catch {
    return mockFailedLoginCounter;
  }
}

function getListeningPorts() {
  const platform = os.platform();
  const ports = [];
  try {
    if (platform === 'win32') {
      const output = execCmd('netstat -ano');
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const proto = parts[0];
            const localAddr = parts[1];
            const pid = parts[parts.length - 1];
            const portStr = localAddr.split(':').pop();
            const port = parseInt(portStr, 10);
            if (port && !isNaN(port)) {
              let processName = 'Unknown';
              try {
                const taskOutput = execCmd(`tasklist /fi "PID eq ${pid}" /fo csv /nh`);
                const taskMatch = taskOutput.split(',')[0];
                if (taskMatch) processName = taskMatch.replace(/"/g, '');
              } catch {}
              ports.push({ port, process: processName, pid, protocol: proto });
            }
          }
        }
      }
    } else {
      const lsofOutput = execCmd('lsof -i -P -n -sTCP:LISTEN 2>/dev/null');
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
      } else {
        const ssOutput = execCmd('ss -tlnp 2>/dev/null || ss -tln 2>/dev/null');
        if (ssOutput) {
          const lines = ssOutput.split('\n').slice(1);
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
              const localAddr = parts[3];
              const portStr = localAddr.split(':').pop();
              const port = parseInt(portStr, 10);
              if (port && !isNaN(port)) {
                let proc = 'Unknown';
                let pid = '';
                const procMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
                if (procMatch) {
                  proc = procMatch[1];
                  pid = procMatch[2];
                }
                ports.push({ port, process: proc, pid, protocol: 'TCP' });
              }
            }
          }
        } else {
          const netstatOutput = execCmd('netstat -an 2>/dev/null');
          const lines = netstatOutput.split('\n');
          for (const line of lines) {
            if (line.toLowerCase().includes('listen')) {
              const parts = line.trim().split(/\s+/);
              const proto = parts[0];
              const localAddr = parts[3];
              const portStr = localAddr.split(/[\.:]/).pop();
              const port = parseInt(portStr, 10);
              if (port && !isNaN(port)) {
                ports.push({ port, process: 'Unknown', protocol: proto });
              }
            }
          }
        }
      }
    }
  } catch (e) {
    log('error', `⚠️ Failed to get listening ports: ${e.message}`);
  }

  const uniqPorts = [];
  const seenPorts = new Set();
  for (const p of ports) {
    if (!seenPorts.has(p.port)) {
      seenPorts.add(p.port);
      uniqPorts.push(p);
    }
  }
  return uniqPorts;
}

function getSystemHardwareDetails() {
  const platform = os.platform();
  const details = {
    serialNumber: 'Unknown',
    biosVendor: 'Unknown',
    biosVersion: 'Unknown',
    motherboard: 'Unknown',
    tpmEnabled: false,
    tpmVersion: 'N/A'
  };

  try {
    if (platform === 'win32') {
      const serialOut = execCmd('wmic bios get serialnumber /format:list');
      details.serialNumber = serialOut.split('\n').find(l => l.startsWith('SerialNumber='))?.split('=')[1]?.trim() || 'Unknown';
      const biosVendorOut = execCmd('wmic bios get manufacturer /format:list');
      details.biosVendor = biosVendorOut.split('\n').find(l => l.startsWith('Manufacturer='))?.split('=')[1]?.trim() || 'Unknown';
      const biosVerOut = execCmd('wmic bios get name /format:list');
      details.biosVersion = biosVerOut.split('\n').find(l => l.startsWith('Name='))?.split('=')[1]?.trim() || 'Unknown';

      const boardVendor = execCmd('wmic baseboard get manufacturer /format:list').split('\n').find(l => l.startsWith('Manufacturer='))?.split('=')[1]?.trim() || '';
      const boardProduct = execCmd('wmic baseboard get product /format:list').split('\n').find(l => l.startsWith('Product='))?.split('=')[1]?.trim() || '';
      if (boardVendor || boardProduct) {
        details.motherboard = `${boardVendor} ${boardProduct}`.trim();
      }

      const tpmOut = execCmd('wmic /namespace:\\\\root\\cimv2\\security\\microsofttpm path Win32_Tpm get IsEnabled_InitialValue,SpecVersion /format:list 2>nul');
      if (tpmOut.includes('IsEnabled_InitialValue')) {
        details.tpmEnabled = tpmOut.split('\n').find(l => l.startsWith('IsEnabled_InitialValue='))?.split('=')[1]?.trim() === 'TRUE';
        details.tpmVersion = tpmOut.split('\n').find(l => l.startsWith('SpecVersion='))?.split('=')[1]?.trim() || 'N/A';
      }
    } else if (platform === 'darwin') {
      const serialOut = execCmd("ioreg -rd1 -c IOPlatformExpertDevice | awk -F'\"' '/IOPlatformSerialNumber/ { print $4 }'");
      details.serialNumber = serialOut?.trim() || 'Unknown';
      details.biosVendor = 'Apple Inc.';
      const chipOut = execCmd('sysctl -n machdep.cpu.brand_string 2>/dev/null || sysctl -n hw.model 2>/dev/null');
      details.biosVersion = chipOut?.trim() || 'Apple Silicon';
      details.motherboard = execCmd('sysctl -n hw.model 2>/dev/null')?.trim() || 'Apple Baseboard';
      details.tpmEnabled = true;
      details.tpmVersion = 'Secure Enclave';
    } else {
      details.serialNumber = execCmd('cat /sys/class/dmi/id/product_serial 2>/dev/null || cat /sys/class/dmi/id/board_serial 2>/dev/null || echo "Unknown"')?.trim();
      details.biosVendor = execCmd('cat /sys/class/dmi/id/bios_vendor 2>/dev/null || echo "Unknown"')?.trim();
      details.biosVersion = execCmd('cat /sys/class/dmi/id/bios_version 2>/dev/null || echo "Unknown"')?.trim();

      const boardVendor = execCmd('cat /sys/class/dmi/id/board_vendor 2>/dev/null')?.trim() || '';
      const boardName = execCmd('cat /sys/class/dmi/id/board_name 2>/dev/null')?.trim() || '';
      if (boardVendor || boardName) {
        details.motherboard = `${boardVendor} ${boardName}`.trim();
      }

      const tpmCheck = execCmd('ls /sys/class/tpm/tpm0 2>/dev/null || ls /dev/tpm0 2>/dev/null');
      if (tpmCheck) {
        details.tpmEnabled = true;
        details.tpmVersion = execCmd('cat /sys/class/tpm/tpm0/device/description 2>/dev/null || echo "2.0"')?.trim() || '2.0';
      }
    }
  } catch {}

  return details;
}

function collectSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const loadAvg = os.loadavg();
  const hwDetails = getSystemHardwareDetails();

  return {
    collectedAt: new Date().toISOString(),
    agentVersion: VERSION,
    hardware: {
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCores: cpus.length,
      cpuSpeed: cpus[0]?.speed || 0,
      totalRamMb: Math.round(totalMem / 1048576),
      freeRamMb: Math.round(freeMem / 1048576),
      usedRamMb: Math.round((totalMem - freeMem) / 1048576),
      ramUsagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      diskDrives: getDiskUsage(),
      serialNumber: hwDetails.serialNumber,
      biosVendor: hwDetails.biosVendor,
      biosVersion: hwDetails.biosVersion,
      motherboard: hwDetails.motherboard,
      tpmEnabled: hwDetails.tpmEnabled,
      tpmVersion: hwDetails.tpmVersion
    },
    operatingSystem: {
      platform: os.platform(),
      type: os.type(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: Math.round(os.uptime()),
      uptimeHours: Math.round(os.uptime() / 3600),
    },
    network: {
      interfaces: getNetworkInterfaces(),
      hostname: os.hostname(),
    },
    performance: {
      loadAvg1m: loadAvg[0]?.toFixed(2),
      loadAvg5m: loadAvg[1]?.toFixed(2),
      loadAvg15m: loadAvg[2]?.toFixed(2),
      cpuUsagePercent: Math.round(loadAvg[0] / cpus.length * 100),
    },
    security: {
      ...getSecurityInfo(),
      users: getSystemUsers(),
      activeShellUsers: getActiveShellUsers(),
      failedLoginsCount: getFailedLoginsCount(),
      openPorts: getListeningPorts(),
    },
    software: getInstalledSoftware(),
    processes: getRunningProcesses(),
    usbDevices: getUsbDevices(),
    services: getRunningServices(),
  };
}

// ─── Register Agent ─────────────────────────────────────────
async function registerAgent() {
  const systemInfo = collectSystemInfo();
  const body = {
    hostname: os.hostname(),
    platform: os.platform(),
    agentVersion: VERSION,
    ipAddress: getPrimaryIP(),
    macAddress: getPrimaryMAC(),
    systemInfo,
  };

  log('info', `📡 Registering agent: ${body.hostname} (${body.ipAddress})...`);
  const res = await request('POST', '/discovery/agents/register', body);

  if (res.status === 200 || res.status === 201) {
    agentId = res.data.id;
    log('success', `Agent registered successfully. ID: ${agentId}`);
    return true;
  }
  log('error', `Registration failed (${res.status}): ${res.data.message || res.data}`);
  return false;
}

// ─── Heartbeat ──────────────────────────────────────────────
async function sendHeartbeat() {
  if (!agentId) return;

  const systemInfo = collectSystemInfo();
  try {
    const res = await request('POST', `/discovery/agents/${agentId}/heartbeat`, { systemInfo });
    if (res.status === 200 || res.status === 201) {
      const mem = systemInfo.hardware;
      log('heartbeat', `Heartbeat sent — CPU: ${systemInfo.performance.cpuUsagePercent}% | RAM: ${mem.ramUsagePercent}% (${mem.usedRamMb}/${mem.totalRamMb} MB) | Uptime: ${systemInfo.operatingSystem.uptimeHours}h`);
      
      // Parse active mitigation actions from API response
      if (res.data && Array.isArray(res.data.actions) && res.data.actions.length > 0) {
        log('info', `🛡️  Received ${res.data.actions.length} security action directives from admin...`);
        for (const act of res.data.actions) {
          if (act.type === 'KILL_PROCESS') {
            const { processName, pid } = act;
            log('security', `Terminating unauthorized process "${processName}" (PID: ${pid})...`);
            try {
              if (pid) {
                // Check if PID is still active
                let isRunning = false;
                try {
                  if (os.platform() === 'win32') {
                    const check = execSync(`tasklist /fi "PID eq ${pid}"`, { encoding: 'utf-8', timeout: 3000 });
                    isRunning = check.includes(String(pid));
                  } else {
                    execSync(`ps -p ${pid}`, { stdio: 'ignore', timeout: 3000 });
                    isRunning = true;
                  }
                } catch {
                  isRunning = false;
                }

                if (!isRunning) {
                  log('info', `✅ Process PID ${pid} is already terminated/inactive.`);
                  continue;
                }

                // If running, terminate it
                if (os.platform() === 'win32') {
                  execSync(`taskkill /F /PID ${pid}`, { timeout: 5000 });
                } else {
                  execSync(`kill -9 ${pid}`, { timeout: 5000 });
                }
                log('success', `Terminated PID ${pid} successfully.`);
              } else if (processName) {
                // Check if any instance of processName is running
                let isRunning = false;
                try {
                  if (os.platform() === 'win32') {
                    const check = execSync(`tasklist /fi "IMAGENAME eq ${processName}"`, { encoding: 'utf-8', timeout: 3000 });
                    isRunning = check.toLowerCase().includes(processName.toLowerCase());
                  } else {
                    execSync(`pgrep "${processName}"`, { stdio: 'ignore', timeout: 3000 });
                    isRunning = true;
                  }
                } catch {
                  isRunning = false;
                }

                if (!isRunning) {
                  log('info', `✅ Process "${processName}" is already terminated/inactive.`);
                  continue;
                }

                // Try to kill
                try {
                  if (os.platform() === 'win32') {
                    execSync(`taskkill /F /IM "${processName}"`, { timeout: 5000 });
                  } else {
                    execSync(`killall -9 "${processName}"`, { timeout: 5000 });
                  }
                  log('success', `Terminated all instances of "${processName}" successfully.`);
                } catch (killErr) {
                  // Verify if the process actually died
                  let stillRunning = false;
                  try {
                    if (os.platform() === 'win32') {
                      const check = execSync(`tasklist /fi "IMAGENAME eq ${processName}"`, { encoding: 'utf-8', timeout: 3000 });
                      stillRunning = check.toLowerCase().includes(processName.toLowerCase());
                    } else {
                      execSync(`pgrep "${processName}"`, { stdio: 'ignore', timeout: 3000 });
                      stillRunning = true;
                    }
                  } catch {
                    stillRunning = false;
                  }

                  if (!stillRunning) {
                    log('info', `✅ Process "${processName}" is already terminated/inactive.`);
                  } else {
                    log('error', `Failed to kill process "${processName}": ${killErr.message}`);
                  }
                }
              }
            } catch (err) {
              // General catch block - double check if PID is active
              let stillRunning = false;
              if (pid) {
                try {
                  if (os.platform() === 'win32') {
                    const check = execSync(`tasklist /fi "PID eq ${pid}"`, { encoding: 'utf-8', timeout: 3000 });
                    stillRunning = check.includes(String(pid));
                  } else {
                    execSync(`ps -p ${pid}`, { stdio: 'ignore', timeout: 3000 });
                    stillRunning = true;
                  }
                } catch {
                  stillRunning = false;
                }
              }
              if (!stillRunning) {
                log('info', `✅ Process PID ${pid || 'unknown'} is already terminated/inactive.`);
              } else {
                log('error', `Failed to kill process ${processName || pid}: ${err.message}`);
              }
            }
          } else if (act.type === 'BLOCK_PORT') {
            const { port, processName } = act;
            log('security', `Blocking unauthorized open port ${port} (Process: "${processName || 'unknown'}")...`);
            try {
              if (os.platform() === 'win32') {
                exec(`netsh advfirewall firewall add rule name="Block Port ${port}" dir=in action=block protocol=TCP localport=${port}`);
                log('success', `Blocked port ${port} successfully on Windows Firewall.`);
              } else if (os.platform() === 'linux') {
                try {
                  exec(`ufw deny ${port}`);
                  log('success', `Blocked port ${port} via ufw.`);
                } catch {
                  exec(`iptables -A INPUT -p tcp --dport ${port} -j DROP`);
                  log('success', `Blocked port ${port} via iptables.`);
                }
              } else if (os.platform() === 'darwin') {
                log('security', `⚠️  Port blocking requested for port ${port} on macOS. Dynamic pfctl rule injection requires elevated sudo privileges.`);
              } else {
                log('security', `⚠️  Port blocking not supported on platform: ${os.platform()}`);
              }
            } catch (err) {
              log('error', `Failed to block port ${port}: ${err.message}. Elevated privileges (Admin/sudo) may be required.`);
            }
          } else if (act.type === 'RUN_SCAN') {
            const { scanJobId, subnet, scanType, portRange } = act;
            log('info', `📡 ACTION: Initiating delegated network discovery scan on subnet ${subnet} (ScanJob: ${scanJobId}, Type: ${scanType})...`);
            runLANScan(scanJobId, subnet, scanType, portRange).catch(err => {
              log('error', `Delegated scan ${scanJobId} failed: ${err.message}`);
            });
          } else if (act.type === 'ALERT') {
            const { category, summary, details } = act;
            log('security', `[ALERT DETECTED] Category: ${category} | Summary: ${summary} | Details: ${JSON.stringify(details)}`);
          }
        }
      }
    } else if (res.status === 401) {
      log('info', '🔑 Token expired, re-authenticating...');
      const oldToken = accessToken;
      const loggedIn = await login();
      if (loggedIn && accessToken !== oldToken) {
        await sendHeartbeat();
      } else {
        log('error', '❌ Re-authentication failed: Pairing token is invalid or expired. Please re-pair your agent via the UI.');
      }
    } else {
      log('info', `Heartbeat response status: ${res.status}`);
    }
  } catch (err) {
    log('error', `Heartbeat failed: ${err.message}`);
  }
}

// ─── Native Web Browser Launch Helper ─────────────────────────
function launchDefaultBrowser(url) {
  let cmd;
  const platform = os.platform();
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, () => {});
}

// ─── Background HTTP Status Server & HTML Page Host ───────────
function startStatusServer() {
  const server = http.createServer((req, res) => {
    // Add CORS headers for native status dashboard loading
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = require('url').parse(req.url, true);

    // Serve gorgeous status dashboard HTML directly on root path!
    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
      const dashboardPath = path.join(__dirname, 'Status Dashboard.html');
      fs.readFile(dashboardPath, 'utf8', (err, html) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error loading status dashboard HTML. Please verify that "Status Dashboard.html" is in the same directory as the agent.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      });
      return;
    }

    if (parsedUrl.pathname === '/api/status' && req.method === 'GET') {
      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      
      const payload = {
        agentId: agentId || 'Unregistered',
        configServer: SERVER,
        primaryIp: getPrimaryIP(),
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpuCores: cpus.length,
        totalRamMb: Math.round(totalMem / 1048576),
        cpuUsagePercent: Math.round(loadAvg[0] / cpus.length * 100),
        ramUsagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        uptime: os.uptime(),
        failedLoginsCount: getFailedLoginsCount(),
        firewallEnabled: getSecurityInfo().firewallEnabled,
        openPorts: getListeningPorts()
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    if (parsedUrl.pathname === '/api/logs' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(localLogs));
      return;
    }

    if (parsedUrl.pathname === '/api/control' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.action === 'TRIGGER_SCAN') {
            log('info', 'Starting manual local subnet discovery sweep...');
            triggerLocalLANScan();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Scan triggered' }));
          } else if (data.action === 'INSTALL_SERVICE') {
            const script = os.platform() === 'win32' ? 'install-service.bat' : './install-service.sh';
            log('info', `Registering background service via ${script}...`);
            exec(script, { cwd: __dirname }, (error, stdout, stderr) => {
              if (error) {
                log('error', `Failed to install background daemon service: ${error.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
              } else {
                log('success', `Continuous background service registered successfully!`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Continuous background service registered' }));
              }
            });
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Unknown action' }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Default route
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.on('error', (err) => {
    console.error('⚠️  Failed to start local status server:', err.message);
  });

  const PORT = 49152;
  server.listen(PORT, '0.0.0.0', () => {
    log('success', `Local Status Dashboard API running on http://localhost:${PORT}`);
    
    // Automatically launch default native web browser window on startup unless running in silent daemon mode
    if (!SILENT_MODE) {
      log('info', `🚀 Automatically launching Status Dashboard in your native browser...`);
      launchDefaultBrowser(`http://localhost:${PORT}/`);
    }
  });
}

// ─── Local LAN Scan Sweep for Manual Trigger ──────────────────
async function triggerLocalLANScan() {
  const primaryIp = getPrimaryIP();
  if (!primaryIp || primaryIp === '127.0.0.1') {
    log('error', 'Cannot run scan: Primary interface IP is loopback/unresolved.');
    return;
  }

  const parts = primaryIp.split('.');
  const baseIp = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const targetSubnet = `${baseIp}.0/24`;
  log('info', `Initiating local LAN sweep on subnet ${targetSubnet}...`);

  const dns = require('dns');
  const ips = Array.from({ length: 254 }, (_, i) => `${baseIp}.${i + 1}`);
  const aliveHosts = [];
  const batchSize = 35;
  const pingCmd = os.platform() === 'win32' ? 'ping -n 1 -w 800' : 'ping -c 1 -W 1';

  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize);
    await Promise.all(batch.map(async (ip) => {
      let isAlive = false;
      try {
        execSync(`${pingCmd} ${ip}`, { timeout: 1500 });
        isAlive = true;
      } catch {
        const commonPorts = [22, 80, 135, 443, 445];
        for (const port of commonPorts) {
          const open = await probePort(ip, port, 600);
          if (open) {
            isAlive = true;
            break;
          }
        }
      }

      if (isAlive) {
        let hostname = '';
        try {
          const names = await dns.promises.reverse(ip);
          if (names && names.length > 0) hostname = names[0];
        } catch {}
        aliveHosts.push({ ip, hostname });
      }
    }));
  }

  log('info', `LAN Sweep completed. Found ${aliveHosts.length} active hosts. Port scanning & classifying...`);

  // Read local ARP entries
  const arpEntries = {};
  try {
    const arpCmd = os.platform() === 'win32' ? 'arp -a' : 'arp -n 2>/dev/null || arp -a 2>/dev/null';
    const arpOut = execSync(arpCmd, { timeout: 3000, encoding: 'utf8' });
    for (const line of arpOut.split('\n')) {
      const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:-]{17})/i) || line.match(/\(?([\d.]+)\)?\s+at\s+([0-9a-fA-F:-]+)/i);
      if (match) {
        let mac = match[2].toUpperCase().replace(/-/g, ':');
        arpEntries[match[1]] = mac;
      }
    }
  } catch {}

  // Perform service scan & classification
  for (const host of aliveHosts) {
    const mac = arpEntries[host.ip] || null;
    const openPorts = await scanPorts(host.ip);
    const classification = classifyDevice(openPorts, mac);
    log('info', `Discovered Device: [IP: ${host.ip}] [MAC: ${mac || 'unknown'}] [Type: ${classification.deviceType}] [OS: ${classification.osInfo}] [Vendor: ${classification.manufacturer}]`);
  }

  log('success', `Manual LAN scan complete. Swept 254 IPs, found ${aliveHosts.length} devices.`);
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  // Resolve active network interface (UDP outbound lookup + heuristics fallback)
  await resolveActiveNetworkInterface();

  log('info', '╔══════════════════════════════════════════════════════╗');
  log('info', '║       QS Discovery Agent v' + VERSION + '                     ║');
  log('info', '║       Status Dashboard: http://localhost:49152       ║');
  log('info', '╚══════════════════════════════════════════════════════╝');
  log('info', '');
  log('info', `  Server:   ${SERVER}`);
  log('info', `  User:     ${USER}`);
  log('info', `  Host:     ${os.hostname()}`);
  log('info', `  IP:       ${getPrimaryIP()}`);
  log('info', `  Platform: ${os.platform()} ${os.arch()}`);
  log('info', `  Interval: ${INTERVAL}s`);
  log('info', '');

  // Start background HTTP telemetry status server
  startStatusServer();

  // Login
  if (!await login()) {
    log('error', '❌ Cannot start agent without authentication.');
    process.exit(1);
  }

  // Register
  if (!await registerAgent()) {
    log('error', '❌ Cannot start agent without registration.');
    process.exit(1);
  }

  // Heartbeat loop
  log('success', `Sending heartbeats every ${INTERVAL}s (Ctrl+C to stop)`);
  setInterval(sendHeartbeat, INTERVAL * 1000);

  // Send first heartbeat immediately
  await sendHeartbeat();
}

main().catch(err => {
  log('error', `Fatal error: ${err.message}`);
  process.exit(1);
});

// Heuristic classification based on open ports
function classifyDevice(openPorts, mac) {
  const portNumbers = new Set(openPorts.map(p => p.port));
  
  let vendorHint = '';
  if (mac) {
    const oui = mac.toUpperCase().replace(/[^0-9A-F]/g, '').substring(0, 6);
    if (['F0DEF1', '00505A', '000C29', '005056'].some(p => oui.startsWith(p))) vendorHint = 'VMware';
    else if (['B8AEED', '3C22FB', 'A4C3F0', '001B44'].some(p => oui.startsWith(p))) vendorHint = 'HP';
    else if (['0023EA', '0050BA'].some(p => oui.startsWith(p))) vendorHint = 'Cisco';
    else if (['00155D'].some(p => oui.startsWith(p))) vendorHint = 'Microsoft Hyper-V';
    else if (['DCED96', 'DC4F22'].some(p => oui.startsWith(p))) vendorHint = 'Apple';
  }

  const ports = openPorts.map(p => p.service);
  if (portNumbers.has(631) || portNumbers.has(9100)) {
    return { deviceType: 'Printer', osInfo: 'Embedded OS', manufacturer: vendorHint || 'Generic Printer' };
  }
  if (portNumbers.has(161) && !portNumbers.has(22) && !portNumbers.has(3389)) {
    return { deviceType: 'Network Device', osInfo: 'Network OS', manufacturer: vendorHint || 'Generic Network Device' };
  }
  if (portNumbers.has(3389)) {
    return { deviceType: portNumbers.has(135) ? 'Windows Server' : 'Windows Workstation', osInfo: 'Windows', manufacturer: vendorHint || 'Generic PC' };
  }
  if (portNumbers.has(22) && !portNumbers.has(3389)) {
    return { deviceType: portNumbers.has(80) || portNumbers.has(443) ? 'Linux Server' : 'Linux Workstation', osInfo: 'Linux/Unix', manufacturer: vendorHint || 'Generic Linux PC' };
  }
  if (portNumbers.has(80) || portNumbers.has(443) || portNumbers.has(8080)) {
    return { deviceType: 'Web Server', osInfo: 'Unknown', manufacturer: vendorHint || 'Generic Web Server' };
  }
  return { deviceType: vendorHint ? `${vendorHint} Device` : 'Unknown', osInfo: 'Unknown', manufacturer: vendorHint || 'Generic' };
}

// TCP Port Probe
function probePort(ip, port, timeout = 1000) {
  const net = require('net');
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, ip);
  });
}

// Scan ports of a single active host
async function scanPorts(ip) {
  const SERVICE_PORTS = [22, 80, 135, 139, 161, 443, 445, 631, 3306, 3389, 5432, 5900, 8080, 8443, 9100];
  const PORT_SERVICE_MAP = {
    22: 'SSH', 80: 'HTTP', 135: 'RPC', 139: 'NetBIOS', 161: 'SNMP',
    443: 'HTTPS', 445: 'SMB', 631: 'IPP/Printer', 3306: 'MySQL', 3389: 'RDP',
    5432: 'PostgreSQL', 5900: 'VNC', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 9100: 'JetDirect',
  };

  const openPorts = [];
  for (const port of SERVICE_PORTS) {
    try {
      const open = await probePort(ip, port);
      if (open) {
        openPorts.push({ port, service: PORT_SERVICE_MAP[port] || `port-${port}` });
      }
    } catch {}
  }
  return openPorts;
}

// Perform active LAN Discovery Sweep
async function runLANScan(scanJobId, subnet, scanType, portRange) {
  const dns = require('dns');
  
  // Autodetect correct active interface subnet if mock range is supplied
  let targetSubnet = subnet;
  const primaryIp = getPrimaryIP();
  if (primaryIp && primaryIp !== '127.0.0.1') {
    const parts = primaryIp.split('.');
    const localSubnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    if (!subnet || subnet.includes('192.168.1.0') || subnet.includes('10.0.0.0')) {
      log('info', `Requested scan subnet "${subnet || 'empty'}" matches mock template. Autodetecting correct active interface subnet: "${localSubnet}"`);
      targetSubnet = localSubnet;
    }
  }

  const baseIp = targetSubnet.replace(/\/\d+$/, '').replace(/\.\d+$/, '');
  const ips = Array.from({ length: 254 }, (_, i) => `${baseIp}.${i + 1}`);

  log('info', `Starting LAN scan sweep for ${ips.length} IPs on subnet ${targetSubnet}...`);
  
  // Phase 1: Check alive hosts via ping (or fast TCP fallback)
  const aliveHosts = [];
  const batchSize = 25;
  const pingCmd = os.platform() === 'win32' ? 'ping -n 1 -w 800' : (os.platform() === 'darwin' ? 'ping -c 1 -W 1000' : 'ping -c 1 -W 1');
  
  for (let i = 0; i < ips.length; i += batchSize) {
    // Check if the scan job has been cancelled on the server
    try {
      const checkRes = await request('GET', `/discovery/scans/${scanJobId}`);
      if (checkRes && checkRes.status === 200 && checkRes.data && checkRes.data.status === 'CANCELLED') {
        log('warn', `🛑 Scan job ${scanJobId} was cancelled by administrator. Aborting sweep...`);
        return;
      }
    } catch (err) {
      log('debug', `Checking scan status failed: ${err.message}`);
    }

    const batch = ips.slice(i, i + batchSize);
    await Promise.all(batch.map(async (ip) => {
      let isAlive = false;
      let latency = '1';
      
      // Try Ping sweep
      try {
        const out = await new Promise((resolve, reject) => {
          exec(`${pingCmd} ${ip}`, { timeout: 1500, encoding: 'utf8' }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout);
          });
        });
        isAlive = true;
        const match = out.match(/time[=<]([\d.]+)/);
        if (match) latency = match[1];
      } catch {
        // Fallback: fast TCP connect to check if host is alive
        const commonPorts = [22, 80, 135, 443, 445];
        for (const port of commonPorts) {
          const open = await probePort(ip, port, 600);
          if (open) {
            isAlive = true;
            break;
          }
        }
      }

      if (isAlive) {
        let hostname = '';
        try {
          const names = await dns.promises.reverse(ip);
          if (names && names.length > 0) hostname = names[0];
        } catch {}
        aliveHosts.push({ ip, hostname });
      }
    }));
  }

  log('info', `LAN Scan: Found ${aliveHosts.length} active hosts. Port scanning & classifying...`);

  // Phase 2: Read local ARP entries
  const arpEntries = {};
  try {
    const arpCmd = os.platform() === 'win32' ? 'arp -a' : 'arp -n 2>/dev/null || arp -a 2>/dev/null';
    const arpOut = execSync(arpCmd, { timeout: 3000, encoding: 'utf8' });
    for (const line of arpOut.split('\n')) {
      const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:-]{17})/i) || line.match(/\(?([\d.]+)\)?\s+at\s+([0-9a-fA-F:-]+)/i);
      if (match) {
        let mac = match[2].toUpperCase().replace(/-/g, ':');
        arpEntries[match[1]] = mac;
      }
    }
  } catch {}

  // Phase 3: Perform service scan & classification
  const discoveredDevices = [];
  for (const host of aliveHosts) {
    const mac = arpEntries[host.ip] || null;
    const openPorts = await scanPorts(host.ip);
    const classification = classifyDevice(openPorts, mac);
    
    discoveredDevices.push({
      ip: host.ip,
      mac,
      hostname: host.hostname || null,
      openPorts,
      deviceType: classification.deviceType,
      manufacturer: classification.manufacturer,
      osInfo: classification.osInfo,
    });
  }

  log('info', `LAN Scan complete: ${discoveredDevices.length} classified devices. Reporting to server...`);

  // Report results to the server
  const response = await request('POST', `/discovery/scans/${scanJobId}/results`, { devices: discoveredDevices });
  if (response.status === 200 || response.status === 201) {
    log('success', `ScanJob ${scanJobId} results submitted successfully!`);
  } else {
    log('error', `Failed to submit ScanJob ${scanJobId} results (${response.status}): ${JSON.stringify(response.data)}`);
  }
}
