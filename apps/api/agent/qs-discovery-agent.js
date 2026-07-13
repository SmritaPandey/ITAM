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
let configEmail = '';
let configPassword = '';
let agentId = ''; // Declared early for config loading
const configPath = path.join(__dirname, 'config.json');

if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.server) SERVER = config.server;
    if (config.token) tokenFromFile = config.token;
    if (config.email) configEmail = config.email;
    if (config.password) configPassword = config.password;
    if (config.agentId) agentId = config.agentId;
    log('info', '📦 Loaded local config.json successfully');
    try { if (process.platform !== 'win32') fs.chmodSync(configPath, 0o600); } catch {}
  } catch (e) {
    log('error', `⚠️ Failed to parse config.json: ${e.message}`);
  }
}

const API_BASE = `${SERVER}/api/v1`;

// Merge credentials: CLI args > config.json > env vars
if (!USER && configEmail) USER = configEmail;
if (!PASS && configPassword) PASS = configPassword;

if (!tokenFromFile && (!USER || !PASS)) {
  log('error', '❌ Usage: node qs-discovery-agent.js --server http://SERVER:4100 --user EMAIL --pass PASSWORD');
  process.exit(1);
}

let accessToken = '';

if (process.argv.includes('--insecure')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  log('warn', '⚠️  TLS verification disabled (--insecure flag). Do NOT use in production.');
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

function request(method, apiPath, body, retries = MAX_RETRIES) {
  return new Promise(async (resolve, reject) => {
    const url = `${API_BASE}${apiPath}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, options);
        const text = await res.text();
        let responseData;
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
        resolve({ status: res.status, data: responseData });
        return;
      } catch (err) {
        if (attempt < retries) {
          const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
          log('info', `⏳ Request to ${apiPath} failed (attempt ${attempt + 1}/${retries + 1}): ${err.message}. Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          reject(new Error(`Request to ${apiPath} failed after ${retries + 1} attempts: ${err.message}`));
        }
      }
    }
  });
}

// ─── JWT Helpers ────────────────────────────────────────────
function isTokenExpired(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (!payload.exp) return false;
    // Consider expired if less than 60 seconds remaining
    return (payload.exp * 1000) < (Date.now() + 60000);
  } catch {
    return true;
  }
}

function saveToConfig(key, value) {
  try {
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    config[key] = value;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    try { if (process.platform !== 'win32') fs.chmodSync(configPath, 0o600); } catch {}
  } catch (e) {
    log('error', `Failed to save ${key} to config: ${e.message}`);
  }
}

function saveTokenToConfig(newToken) {
  saveToConfig('token', newToken);
  log('info', '📦 Refreshed token saved to config.json');
}

// ─── Login ──────────────────────────────────────────────────
async function loginWithCredentials() {
  if (!USER || !PASS) return false;
  log('info', `🔑 Authenticating with credentials as ${USER}...`);
  try {
    const res = await request('POST', '/auth/login', { email: USER, password: PASS }, 1);
    if (res.status === 200 || res.status === 201) {
      accessToken = res.data.accessToken || res.data.access_token;
      log('success', 'Authenticated successfully via credentials');
      // Persist new token so future restarts use fresh token
      saveTokenToConfig(accessToken);
      tokenFromFile = accessToken;
      return true;
    }
    log('error', `Credential login failed (${res.status}): ${res.data.message || res.data}`);
    return false;
  } catch (err) {
    log('error', `Credential login network error: ${err.message}`);
    return false;
  }
}

async function login() {
  // 1. Try config token if present and NOT expired
  if (tokenFromFile && !isTokenExpired(tokenFromFile)) {
    log('info', '🔑 Authenticating using valid pre-seeded token...');
    accessToken = tokenFromFile;
    return true;
  }

  // 2. Token is expired or missing — try credential-based login
  if (tokenFromFile && isTokenExpired(tokenFromFile)) {
    log('info', '⚠️  Config token has expired. Attempting credential-based re-authentication...');
  }

  if (await loginWithCredentials()) return true;

  // 3. Last resort: use the expired token anyway (server might accept it)
  if (tokenFromFile) {
    log('info', '🔑 Falling back to config token (may be expired)...');
    accessToken = tokenFromFile;
    return true;
  }

  log('error', 'No valid authentication method available.');
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
      const output = execCmd('powershell -command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace,FileSystem | ConvertTo-Json"');
      const drives = [];
      try {
        const parsed = JSON.parse(output);
        const disks = Array.isArray(parsed) ? parsed : [parsed];
        for (const disk of disks) {
          const total = parseInt(disk.Size || '0');
          const free = parseInt(disk.FreeSpace || '0');
          if (disk.DeviceID && total > 0) {
            const totalGb = Math.round(total / 1073741824);
            const usedGb = Math.round((total - free) / 1073741824);
            const freeGb = Math.round(free / 1073741824);
            drives.push({
              mount: disk.DeviceID,
              totalGb,
              sizeGb: totalGb,
              size: totalGb,
              usedGb,
              used: usedGb,
              freeGb,
              available: freeGb,
              fileSystem: disk.FileSystem || 'Unknown'
            });
          }
        }
      } catch {}
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
      const output = execCmd('powershell -command "Get-CimInstance Win32_Product | Select-Object Name,Version | ConvertTo-Json"');
      try {
        const parsed = JSON.parse(output);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        return items.filter(s => s.Name).map(s => ({ name: s.Name, version: s.Version || 'N/A' }));
      } catch { return []; }
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
        return apps;
      } else {
        const brew = execCmd('brew list --versions 2>/dev/null | head -200');
        return brew.split('\n').filter(Boolean).map(l => {
          const parts = l.split(' ');
          return { name: parts[0], version: parts.slice(1).join(' ') };
        });
      }
    } else {
      // Linux: dpkg or rpm
      const dpkg = execCmd("dpkg-query -W -f='${Package} ${Version}\\n' 2>/dev/null | head -200");
      if (dpkg) return dpkg.split('\n').filter(Boolean).map(l => { const p = l.split(' '); return { name: p[0], version: p[1] }; });
      const rpm = execCmd("rpm -qa --qf '%{NAME} %{VERSION}\\n' 2>/dev/null | head -200");
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
      // LUKS encryption detection
      const luksCheck = execCmd('lsblk -o NAME,FSTYPE 2>/dev/null | grep -i luks');
      if (luksCheck) {
        info.encryptionEnabled = true;
        info.encryptionMethod = 'LUKS';
      } else if (fs.existsSync('/etc/crypttab')) {
        const crypttab = execCmd('cat /etc/crypttab 2>/dev/null');
        if (crypttab && crypttab.trim().length > 0) {
          info.encryptionEnabled = true;
          info.encryptionMethod = 'LUKS (crypttab)';
        }
      }
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
      const output = execCmd('powershell -command "Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPClass -eq \'USB\' } | Select-Object Name | ConvertTo-Json"');
      try {
        const parsed = JSON.parse(output);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        return items.filter(d => d.Name).slice(0, 30).map(d => ({
          name: d.Name || 'USB Device', vendor: '', serial: '', type: 'USB',
        }));
      } catch { return []; }
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
      return execCmd('sc query type= service state= all 2>nul | findstr "SERVICE_NAME STATE"').split('\n')
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

function getGpuInfo() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const output = execCmd('system_profiler SPDisplaysDataType -json 2>/dev/null');
      if (output) {
        try {
          const data = JSON.parse(output);
          const gpus = [];
          const displays = data.SPDisplaysDataType || [];
          for (const gpu of displays) {
            gpus.push({
              name: gpu.sppci_model || gpu._name || 'Unknown',
              vram: gpu.sppci_vram || gpu.spdisplays_vram || 'Unknown',
              vendor: gpu.sppci_vendor || 'Unknown',
            });
          }
          return gpus.length > 0 ? gpus : null;
        } catch { return null; }
      }
    } else if (platform === 'win32') {
      const output = execCmd('powershell -command "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json"');
      if (output) {
        try {
          const parsed = JSON.parse(output);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          return items.map(g => ({
            name: g.Name || 'Unknown',
            vramBytes: g.AdapterRAM || 0,
            vramMb: g.AdapterRAM ? Math.round(g.AdapterRAM / 1048576) : 0,
            driverVersion: g.DriverVersion || 'Unknown',
          }));
        } catch { return null; }
      }
    } else {
      // Linux: try nvidia-smi first, fallback to lspci
      const nvidiaSmi = execCmd('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null');
      if (nvidiaSmi) {
        return nvidiaSmi.split('\n').filter(Boolean).map(line => {
          const parts = line.split(',').map(p => p.trim());
          return { name: parts[0] || 'NVIDIA GPU', vram: parts[1] || 'Unknown' };
        });
      }
      const lspci = execCmd('lspci 2>/dev/null | grep -i vga');
      if (lspci) {
        return lspci.split('\n').filter(Boolean).map(line => ({
          name: line.replace(/^.*VGA compatible controller:\s*/i, '').trim(),
          vram: 'Unknown',
        }));
      }
    }
  } catch {}
  return null;
}

function getBatteryInfo() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const output = execCmd('pmset -g batt 2>/dev/null');
      if (output) {
        const percentMatch = output.match(/(\d+)%/);
        const chargingMatch = output.match(/(charging|discharging|charged|AC attached)/i);
        if (percentMatch) {
          return {
            percentage: parseInt(percentMatch[1], 10),
            status: chargingMatch ? chargingMatch[1] : 'unknown',
            hasBattery: true,
          };
        }
      }
    } else if (platform === 'win32') {
      const output = execCmd('powershell -command "Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json"');
      if (output) {
        try {
          const parsed = JSON.parse(output);
          const bat = Array.isArray(parsed) ? parsed[0] : parsed;
          if (bat && bat.EstimatedChargeRemaining !== undefined) {
            const statusMap = { 1: 'discharging', 2: 'AC connected', 3: 'fully charged', 4: 'low', 5: 'critical', 6: 'charging' };
            return {
              percentage: bat.EstimatedChargeRemaining,
              status: statusMap[bat.BatteryStatus] || 'unknown',
              hasBattery: true,
            };
          }
        } catch {}
      }
    } else {
      // Linux
      const capacity = execCmd('cat /sys/class/power_supply/BAT0/capacity 2>/dev/null');
      const status = execCmd('cat /sys/class/power_supply/BAT0/status 2>/dev/null');
      if (capacity) {
        return {
          percentage: parseInt(capacity, 10),
          status: status?.toLowerCase() || 'unknown',
          hasBattery: true,
        };
      }
    }
  } catch {}
  return null; // No battery detected (desktop/server)
}

function getAntivirusInfo() {
  const platform = os.platform();
  const avList = [];
  try {
    if (platform === 'darwin') {
      // XProtect
      const xprotect = execCmd('defaults read /System/Library/CoreServices/XProtect.bundle/Contents/Resources/XProtect.meta.plist Version 2>/dev/null');
      if (xprotect) {
        avList.push({ name: 'XProtect', version: xprotect.trim(), status: 'active' });
      } else {
        avList.push({ name: 'XProtect', version: 'built-in', status: 'active' });
      }
      // CrowdStrike
      try {
        execSync('pgrep -x falcond', { timeout: 3000, stdio: 'ignore' });
        avList.push({ name: 'CrowdStrike Falcon', version: 'N/A', status: 'running' });
      } catch {}
      // SentinelOne
      try {
        execSync('pgrep -x SentinelAgent', { timeout: 3000, stdio: 'ignore' });
        avList.push({ name: 'SentinelOne', version: 'N/A', status: 'running' });
      } catch {}
    } else if (platform === 'win32') {
      const output = execCmd('powershell -command "Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | Select-Object displayName,productState | ConvertTo-Json"');
      if (output) {
        try {
          const parsed = JSON.parse(output);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const av of items) {
            if (av.displayName) {
              avList.push({
                name: av.displayName,
                productState: av.productState,
                status: av.productState ? 'registered' : 'unknown',
              });
            }
          }
        } catch {}
      }
    } else {
      // Linux
      const clamav = execCmd('clamd --version 2>/dev/null');
      if (clamav) {
        avList.push({ name: 'ClamAV', version: clamav.trim(), status: 'installed' });
      }
      // CrowdStrike
      try {
        execSync('pgrep -x falcon-sensor', { timeout: 3000, stdio: 'ignore' });
        avList.push({ name: 'CrowdStrike Falcon', version: 'N/A', status: 'running' });
      } catch {}
    }
  } catch {}
  return avList.length > 0 ? avList : [];
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
      const output = execCmd('query user 2>nul');
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

let failedLoginsCountCached = 0;
let lastFailedLoginsCheckTime = 0;

function getFailedLoginsCount() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const output = execCmd('wevtutil qe Security "/q:*[System[(EventID=4625)]]" /c:20 /f:text');
      const count = (output.match(/Event ID:\s*4625/g) || []).length;
      return count;
    } else if (platform === 'darwin') {
      // macOS: log show is very slow (takes 10s+), so check asynchronously and return cached value
      const now = Date.now();
      if (now - lastFailedLoginsCheckTime > 60000) { // throttle checks to once per minute
        lastFailedLoginsCheckTime = now;
        exec('log show --predicate \'eventMessage contains "failed to authenticate" || eventMessage contains "Authentication failed"\' --last 2m 2>/dev/null', (err, stdout) => {
          if (err || !stdout) return;
          const lines = stdout.split('\n').filter(line => {
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
          failedLoginsCountCached = count;
        });
      }
      return failedLoginsCountCached || 0;
    } else {
      let count = 0;
      if (fs.existsSync('/var/log/auth.log')) {
        const content = execCmd('grep -i "fail" /var/log/auth.log | wc -l');
        count = parseInt(content, 10) || 0;
      } else if (fs.existsSync('/var/log/secure')) {
        const content = execCmd('grep -i "fail" /var/log/secure | wc -l');
        count = parseInt(content, 10) || 0;
      }
      return count;
    }
  } catch {
    return 0;
  }
}

let pendingUpdatesCount = 0;
let pendingUpdatesList = [];

function startSoftwareUpdatesCheck() {
  const check = () => {
    const platform = os.platform();
    try {
      if (platform === 'darwin') {
        exec('softwareupdate -l 2>/dev/null', (err, stdout) => {
          if (err) return;
          const updates = [];
          const lines = stdout.split('\n');
          for (const line of lines) {
            if (line.includes('*')) {
              const name = line.replace(/^\s*\*\s*/, '').trim();
              updates.push({ name, version: 'N/A' });
            }
          }
          pendingUpdatesCount = updates.length;
          pendingUpdatesList = updates;
        });
      } else if (platform === 'linux') {
        if (fs.existsSync('/usr/bin/apt-get')) {
          exec('apt-get -s upgrade 2>/dev/null', (err, stdout) => {
            if (err) return;
            const updates = [];
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.startsWith('Inst ')) {
                const parts = line.split(' ');
                const name = parts[1];
                const version = parts[2]?.replace('(', '') || 'N/A';
                updates.push({ name, version });
              }
            }
            pendingUpdatesCount = updates.length;
            pendingUpdatesList = updates;
          });
        } else if (fs.existsSync('/usr/bin/yum')) {
          exec('yum check-update 2>/dev/null', (err, stdout) => {
            if (err && err.code !== 100) return;
            const updates = [];
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.trim() === '') continue;
              if (line.startsWith('Security:')) continue;
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 3 && !parts[0].startsWith('Loaded') && !parts[0].startsWith('Obsoleting')) {
                updates.push({ name: parts[0], version: parts[1] });
              }
            }
            pendingUpdatesCount = updates.length;
            pendingUpdatesList = updates;
          });
        }
      } else if (platform === 'win32') {
        const cmd = 'powershell -command "$u = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search(\'IsInstalled=0 and IsHidden=0\').Updates; $u | Select-Object Title | ConvertTo-Json"';
        exec(cmd, (err, stdout) => {
          if (err) return;
          try {
            const parsed = JSON.parse(stdout);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            const updates = items.filter(u => u && u.Title).map(u => ({ name: u.Title, version: 'N/A' }));
            pendingUpdatesCount = updates.length;
            pendingUpdatesList = updates;
          } catch {}
        });
      }
    } catch {}
  };
  check();
  setInterval(check, 4 * 60 * 60 * 1000);
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
      details.serialNumber = execCmd('powershell -command "(Get-CimInstance Win32_BIOS).SerialNumber"')?.trim() || 'Unknown';
      details.biosVendor = execCmd('powershell -command "(Get-CimInstance Win32_BIOS).Manufacturer"')?.trim() || 'Unknown';
      details.biosVersion = execCmd('powershell -command "(Get-CimInstance Win32_BIOS).Name"')?.trim() || 'Unknown';

      try {
        const boardOut = execCmd('powershell -command "Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product | ConvertTo-Json"');
        const board = JSON.parse(boardOut);
        if (board.Manufacturer || board.Product) {
          details.motherboard = `${board.Manufacturer || ''} ${board.Product || ''}`.trim();
        }
      } catch {}

      try {
        const tpmOut = execCmd('powershell -command "Get-CimInstance -Namespace root/cimv2/Security/MicrosoftTpm -ClassName Win32_Tpm | Select-Object IsEnabled_InitialValue,SpecVersion | ConvertTo-Json" 2>nul');
        if (tpmOut) {
          const tpm = JSON.parse(tpmOut);
          details.tpmEnabled = tpm.IsEnabled_InitialValue === true;
          details.tpmVersion = tpm.SpecVersion || 'N/A';
        }
      } catch {}
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

// ─── Startup Programs / Login Items ─────────────────────────────────
function getStartupPrograms() {
  const items = [];
  try {
    if (os.platform() === 'darwin') {
      // System LaunchDaemons
      ['/Library/LaunchDaemons', '/Library/LaunchAgents'].forEach(dir => {
        try {
          if (fs.existsSync(dir)) {
            fs.readdirSync(dir).filter(f => f.endsWith('.plist')).forEach(f => {
              items.push({ name: f.replace('.plist', ''), path: path.join(dir, f), type: 'LaunchDaemon', enabled: true });
            });
          }
        } catch {}
      });
      // User LaunchAgents
      const userAgentsDir = path.join(os.homedir(), 'Library/LaunchAgents');
      try {
        if (fs.existsSync(userAgentsDir)) {
          fs.readdirSync(userAgentsDir).filter(f => f.endsWith('.plist')).forEach(f => {
            items.push({ name: f.replace('.plist', ''), path: path.join(userAgentsDir, f), type: 'UserLaunchAgent', enabled: true });
          });
        }
      } catch {}
      // Login Items via osascript
      try {
        const loginItems = execCmd('osascript -e \'tell application "System Events" to get the name of every login item\' 2>/dev/null');
        if (loginItems) {
          loginItems.split(', ').filter(Boolean).forEach(name => {
            items.push({ name: name.trim(), path: '', type: 'LoginItem', enabled: true });
          });
        }
      } catch {}
    } else if (os.platform() === 'win32') {
      // Registry Run keys
      ['HKLM\\\\SOFTWARE\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run',
       'HKCU\\\\SOFTWARE\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run'].forEach(regKey => {
        try {
          const out = execCmd(`reg query "${regKey}" 2>nul`);
          if (out) {
            out.split('\n').filter(l => l.includes('REG_SZ') || l.includes('REG_EXPAND_SZ')).forEach(line => {
              const parts = line.trim().split(/\s{2,}/);
              if (parts.length >= 3) {
                items.push({ name: parts[0], path: parts.slice(2).join(' '), type: regKey.startsWith('HKLM') ? 'HKLM_Run' : 'HKCU_Run', enabled: true });
              }
            });
          }
        } catch {}
      });
      // Startup folder
      try {
        const startupDir = execCmd('echo %APPDATA%\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs\\\\Startup')?.trim();
        if (startupDir && fs.existsSync(startupDir)) {
          fs.readdirSync(startupDir).forEach(f => {
            items.push({ name: f, path: path.join(startupDir, f), type: 'StartupFolder', enabled: true });
          });
        }
      } catch {}
    } else {
      // Linux — systemd enabled units + autostart
      try {
        const enabled = execCmd('systemctl list-unit-files --state=enabled --type=service --no-pager --plain 2>/dev/null');
        if (enabled) {
          enabled.split('\n').filter(l => l.includes('.service')).slice(0, 50).forEach(line => {
            const name = line.split(/\s+/)[0];
            if (name) items.push({ name, path: '', type: 'systemd_enabled', enabled: true });
          });
        }
      } catch {}
      // XDG autostart
      const autostartDir = path.join(os.homedir(), '.config/autostart');
      try {
        if (fs.existsSync(autostartDir)) {
          fs.readdirSync(autostartDir).filter(f => f.endsWith('.desktop')).forEach(f => {
            items.push({ name: f.replace('.desktop', ''), path: path.join(autostartDir, f), type: 'XDG_autostart', enabled: true });
          });
        }
      } catch {}
    }
  } catch {}
  return items;
}

// ─── Screen Lock / Password Policy ──────────────────────────────────
function getScreenLockPolicy() {
  const policy = { screenLockEnabled: false, idleTimeSeconds: 0, passwordRequired: false, minPasswordLength: 0 };
  try {
    if (os.platform() === 'darwin') {
      // Check screensaver idle time
      try {
        const idle = execCmd('defaults -currentHost read com.apple.screensaver idleTime 2>/dev/null');
        if (idle) {
          policy.idleTimeSeconds = parseInt(idle.trim(), 10) || 0;
          policy.screenLockEnabled = policy.idleTimeSeconds > 0;
        }
      } catch {}
      // Check if screen lock on screensaver is enabled
      try {
        const askForPass = execCmd('defaults read com.apple.screensaver askForPassword 2>/dev/null');
        policy.passwordRequired = askForPass?.trim() === '1';
        if (policy.passwordRequired) policy.screenLockEnabled = true;
      } catch {}
    } else if (os.platform() === 'win32') {
      // Check screen saver timeout
      try {
        const timeout = execCmd('reg query "HKCU\\\\Control Panel\\\\Desktop" /v ScreenSaveTimeOut 2>nul');
        if (timeout) {
          const match = timeout.match(/ScreenSaveTimeOut\s+REG_SZ\s+(\d+)/);
          if (match) {
            policy.idleTimeSeconds = parseInt(match[1], 10) || 0;
            policy.screenLockEnabled = policy.idleTimeSeconds > 0;
          }
        }
      } catch {}
      // Password policy
      try {
        const netAccounts = execCmd('net accounts 2>nul');
        if (netAccounts) {
          const lenMatch = netAccounts.match(/Minimum password length:\s*(\d+)/i);
          if (lenMatch) policy.minPasswordLength = parseInt(lenMatch[1], 10);
          policy.passwordRequired = policy.minPasswordLength > 0;
        }
      } catch {}
    } else {
      // Linux — check for screen lock
      try {
        const gsettings = execCmd('gsettings get org.gnome.desktop.screensaver lock-enabled 2>/dev/null');
        policy.screenLockEnabled = gsettings?.trim() === 'true';
      } catch {}
      try {
        const idleDelay = execCmd('gsettings get org.gnome.desktop.session idle-delay 2>/dev/null');
        const match = idleDelay?.match(/uint32\s+(\d+)/);
        if (match) policy.idleTimeSeconds = parseInt(match[1], 10);
      } catch {}
      // Password policy from login.defs
      try {
        if (fs.existsSync('/etc/login.defs')) {
          const defs = fs.readFileSync('/etc/login.defs', 'utf8');
          const lenMatch = defs.match(/^PASS_MIN_LEN\s+(\d+)/m);
          if (lenMatch) policy.minPasswordLength = parseInt(lenMatch[1], 10);
          policy.passwordRequired = policy.minPasswordLength > 0;
        }
      } catch {}
    }
  } catch {}
  return policy;
}

// ─── Browser Extensions Inventory ───────────────────────────────────
function getBrowserExtensions() {
  const extensions = [];
  const homeDir = os.homedir();

  // Helper to read Chrome-based extension manifests
  function scanChromeProfile(browserName, profileBase) {
    try {
      if (!fs.existsSync(profileBase)) return;
      const profiles = fs.readdirSync(profileBase).filter(d => d === 'Default' || d.startsWith('Profile'));
      for (const profile of profiles) {
        const extDir = path.join(profileBase, profile, 'Extensions');
        if (!fs.existsSync(extDir)) continue;
        try {
          const extIds = fs.readdirSync(extDir);
          for (const extId of extIds.slice(0, 100)) {
            try {
              const versionDirs = fs.readdirSync(path.join(extDir, extId)).filter(d => !d.startsWith('.'));
              const latestVersion = versionDirs[versionDirs.length - 1];
              if (!latestVersion) continue;
              const manifestPath = path.join(extDir, extId, latestVersion, 'manifest.json');
              if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                extensions.push({
                  id: extId, name: manifest.name || extId, version: manifest.version || '',
                  browser: browserName, profile, description: (manifest.description || '').slice(0, 100),
                });
              }
            } catch {}
          }
        } catch {}
      }
    } catch {}
  }

  try {
    if (os.platform() === 'darwin') {
      scanChromeProfile('Chrome', path.join(homeDir, 'Library/Application Support/Google/Chrome'));
      scanChromeProfile('Edge', path.join(homeDir, 'Library/Application Support/Microsoft Edge'));
      scanChromeProfile('Brave', path.join(homeDir, 'Library/Application Support/BraveSoftware/Brave-Browser'));
      // Safari
      try {
        const safariExts = execCmd('pluginkit -mAvvv -p com.apple.Safari.extension 2>/dev/null');
        if (safariExts) {
          safariExts.split('\n').filter(l => l.includes('(')).forEach(line => {
            const match = line.match(/^\s+(.+?)\(([^)]+)\)/);
            if (match) extensions.push({ id: match[2], name: match[1].trim(), version: '', browser: 'Safari', profile: '', description: '' });
          });
        }
      } catch {}
      // Firefox
      try {
        const ffDir = path.join(homeDir, 'Library/Application Support/Firefox/Profiles');
        if (fs.existsSync(ffDir)) {
          for (const prof of fs.readdirSync(ffDir)) {
            const extJson = path.join(ffDir, prof, 'extensions.json');
            if (fs.existsSync(extJson)) {
              const data = JSON.parse(fs.readFileSync(extJson, 'utf8'));
              (data.addons || []).filter(a => a.type === 'extension' && a.active).forEach(a => {
                extensions.push({ id: a.id, name: a.defaultLocale?.name || a.id, version: a.version || '', browser: 'Firefox', profile: prof, description: '' });
              });
            }
          }
        }
      } catch {}
    } else if (os.platform() === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData/Local');
      scanChromeProfile('Chrome', path.join(localAppData, 'Google/Chrome/User Data'));
      scanChromeProfile('Edge', path.join(localAppData, 'Microsoft/Edge/User Data'));
      scanChromeProfile('Brave', path.join(localAppData, 'BraveSoftware/Brave-Browser/User Data'));
      // Firefox
      try {
        const ffDir = path.join(process.env.APPDATA || '', 'Mozilla/Firefox/Profiles');
        if (fs.existsSync(ffDir)) {
          for (const prof of fs.readdirSync(ffDir)) {
            const extJson = path.join(ffDir, prof, 'extensions.json');
            if (fs.existsSync(extJson)) {
              const data = JSON.parse(fs.readFileSync(extJson, 'utf8'));
              (data.addons || []).filter(a => a.type === 'extension' && a.active).forEach(a => {
                extensions.push({ id: a.id, name: a.defaultLocale?.name || a.id, version: a.version || '', browser: 'Firefox', profile: prof, description: '' });
              });
            }
          }
        }
      } catch {}
    } else {
      // Linux
      scanChromeProfile('Chrome', path.join(homeDir, '.config/google-chrome'));
      scanChromeProfile('Chromium', path.join(homeDir, '.config/chromium'));
      scanChromeProfile('Edge', path.join(homeDir, '.config/microsoft-edge'));
      scanChromeProfile('Brave', path.join(homeDir, '.config/BraveSoftware/Brave-Browser'));
      // Firefox
      try {
        const ffDir = path.join(homeDir, '.mozilla/firefox');
        if (fs.existsSync(ffDir)) {
          for (const prof of fs.readdirSync(ffDir)) {
            const extJson = path.join(ffDir, prof, 'extensions.json');
            if (fs.existsSync(extJson)) {
              const data = JSON.parse(fs.readFileSync(extJson, 'utf8'));
              (data.addons || []).filter(a => a.type === 'extension' && a.active).forEach(a => {
                extensions.push({ id: a.id, name: a.defaultLocale?.name || a.id, version: a.version || '', browser: 'Firefox', profile: prof, description: '' });
              });
            }
          }
        }
      } catch {}
    }
  } catch {}
  // Filter out internal Chrome extensions (like __MSG_)
  return extensions.filter(e => e.name && !e.name.startsWith('__MSG_'));
}

// ─── External USB Volume Mount Detection ────────────────────────────
function getExternalMounts() {
  const mounts = [];
  try {
    if (os.platform() === 'darwin') {
      const out = execCmd('diskutil list external 2>/dev/null');
      if (out) {
        const diskBlocks = out.split(/(?=\/dev\/disk)/);
        for (const block of diskBlocks) {
          const diskMatch = block.match(/^(\/dev\/disk\d+)/);
          if (!diskMatch) continue;
          // Get volume info
          try {
            const info = execCmd(`diskutil info ${diskMatch[1]}s1 2>/dev/null`);
            if (info) {
              const nameMatch = info.match(/Volume Name:\s+(.+)/);
              const mountMatch = info.match(/Mount Point:\s+(.+)/);
              const sizeMatch = info.match(/Disk Size:\s+(.+)/);
              const fsMatch = info.match(/Type \(Bundle\):\s+(.+)/) || info.match(/File System Personality:\s+(.+)/);
              mounts.push({
                device: diskMatch[1], name: nameMatch?.[1]?.trim() || '',
                mountPoint: mountMatch?.[1]?.trim() || '', size: sizeMatch?.[1]?.trim() || '',
                filesystem: fsMatch?.[1]?.trim() || '', type: 'external'
              });
            }
          } catch {}
        }
      }
      // Also check /Volumes for anything not the boot drive
      try {
        const volumes = fs.readdirSync('/Volumes').filter(v => v !== 'Macintosh HD' && v !== 'Macintosh HD - Data');
        for (const vol of volumes) {
          if (!mounts.some(m => m.name === vol)) {
            mounts.push({ device: '', name: vol, mountPoint: `/Volumes/${vol}`, size: '', filesystem: '', type: 'external' });
          }
        }
      } catch {}
    } else if (os.platform() === 'win32') {
      try {
        const out = execCmd('powershell -Command "Get-Volume | Where-Object {$_.DriveType -eq \'Removable\'} | Select-Object DriveLetter,FileSystemLabel,Size,FileSystem | ConvertTo-Json" 2>nul');
        if (out) {
          const vols = JSON.parse(out.startsWith('[') ? out : `[${out}]`);
          for (const v of vols) {
            if (v.DriveLetter) {
              mounts.push({
                device: `${v.DriveLetter}:`, name: v.FileSystemLabel || '',
                mountPoint: `${v.DriveLetter}:\\`, size: v.Size ? `${Math.round(v.Size / 1073741824)}GB` : '',
                filesystem: v.FileSystem || '', type: 'removable'
              });
            }
          }
        }
      } catch {}
    } else {
      // Linux
      try {
        const out = execCmd('lsblk -o NAME,MOUNTPOINT,TRAN,SIZE,FSTYPE -J 2>/dev/null');
        if (out) {
          const data = JSON.parse(out);
          function walkDevices(devices, transport) {
            for (const d of devices || []) {
              const tran = d.tran || transport;
              if (tran === 'usb' && d.mountpoint) {
                mounts.push({
                  device: `/dev/${d.name}`, name: d.name, mountPoint: d.mountpoint,
                  size: d.size || '', filesystem: d.fstype || '', type: 'usb'
                });
              }
              if (d.children) walkDevices(d.children, tran);
            }
          }
          walkDevices(data.blockdevices, null);
        }
      } catch {}
    }
  } catch {}
  return mounts;
}

// ─── Certificate Store Monitoring ───────────────────────────────────
function getCertificateStore() {
  const result = { trustedRootCount: 0, platform: os.platform(), checkedAt: new Date().toISOString() };
  try {
    if (os.platform() === 'darwin') {
      // Count system root certificates
      try {
        const count = execCmd('security find-certificate -a /System/Library/Keychains/SystemRootCertificates.keychain 2>/dev/null | grep -c "keychain:"');
        result.trustedRootCount = parseInt(count?.trim(), 10) || 0;
      } catch {}
      // If 0, try alternative
      if (result.trustedRootCount === 0) {
        try {
          const count = execCmd('security dump-keychain /System/Library/Keychains/SystemRootCertificates.keychain 2>/dev/null | grep -c "^keychain:"');
          result.trustedRootCount = parseInt(count?.trim(), 10) || 0;
        } catch {}
      }
    } else if (os.platform() === 'win32') {
      try {
        const out = execCmd('certutil -store Root 2>nul');
        if (out) {
          const matches = out.match(/================ Certificate \d+ ================/g);
          result.trustedRootCount = matches ? matches.length : 0;
        }
      } catch {}
    } else {
      // Linux — count certs in /etc/ssl/certs
      try {
        const certDir = '/etc/ssl/certs';
        if (fs.existsSync(certDir)) {
          result.trustedRootCount = fs.readdirSync(certDir).filter(f => f.endsWith('.pem') || f.endsWith('.crt')).length;
        }
      } catch {}
    }
  } catch {}
  return result;
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
    softwareUpdates: {
      pendingCount: pendingUpdatesCount,
      updates: pendingUpdatesList
    },
    processes: getRunningProcesses(),
    usbDevices: getUsbDevices(),
    services: getRunningServices(),
    gpu: getGpuInfo(),
    battery: getBatteryInfo(),
    antivirus: getAntivirusInfo(),
    serviceInstalled: checkServiceInstalled(),
    startupPrograms: getStartupPrograms(),
    screenLockPolicy: getScreenLockPolicy(),
    browserExtensions: getBrowserExtensions(),
    externalMounts: getExternalMounts(),
    certificateStore: getCertificateStore(),
  };
}

function checkServiceInstalled() {
  try {
    if (os.platform() === 'darwin') {
      const plistPath = path.join(process.env.HOME || '~', 'Library/LaunchAgents/com.qsasset.discovery.agent.plist');
      const daemonPath = '/Library/LaunchDaemons/com.qsasset.discovery.agent.plist';
      return fs.existsSync(plistPath) || fs.existsSync(daemonPath);
    } else if (os.platform() === 'linux') {
      try {
        execSync('systemctl is-enabled qsasset-agent 2>/dev/null', { stdio: 'pipe', timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    } else if (os.platform() === 'win32') {
      try {
        execSync('sc query QSAssetAgent 2>nul', { stdio: 'pipe', timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    }
  } catch {}
  return false;
}

// ─── Register Agent ─────────────────────────────────────────
async function registerAgent() {
  const systemInfo = collectSystemInfo();
  const body = {
    ...(agentId ? { id: agentId } : {}),
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
    saveToConfig('agentId', agentId);
    log('success', `Agent registered successfully. ID: ${agentId}`);
    return true;
  }

  // Handle expired token — re-authenticate and retry
  if (res.status === 401) {
    log('info', '🔑 Registration returned 401 — token expired. Re-authenticating...');
    const loggedIn = await loginWithCredentials();
    if (loggedIn) {
      // Re-build body since accessToken might have changed
      const retryRes = await request('POST', '/discovery/agents/register', body);
      if (retryRes.status === 200 || retryRes.status === 201) {
        agentId = retryRes.data.id;
        saveToConfig('agentId', agentId);
        log('success', `Agent registered successfully after re-auth. ID: ${agentId}`);
        return true;
      }
      log('error', `Registration retry failed (${retryRes.status}): ${retryRes.data.message || retryRes.data}`);
    } else {
      log('error', 'Re-authentication failed. Cannot register agent.');
    }
    return false;
  }

  log('error', `Registration failed (${res.status}): ${res.data.message || res.data}`);
  return false;
}

// ─── File Integrity Monitoring ────────────────────────────────
const FIM_BASELINE_PATH = path.join(__dirname, 'fim-baseline.json');
const FIM_WATCH_PATHS = process.platform === 'darwin'
  ? ['/etc/hosts', '/etc/sudoers', '/etc/ssh/sshd_config', '/etc/pam.d', '/etc/shells']
  : process.platform === 'linux'
    ? ['/etc/hosts', '/etc/passwd', '/etc/shadow', '/etc/sudoers', '/etc/ssh/sshd_config', '/etc/crontab', '/etc/fstab']
    : ['C:\\Windows\\System32\\drivers\\etc\\hosts', 'C:\\Windows\\System32\\config\\SAM'];

function computeFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return require('crypto').createHash('sha256').update(content).digest('hex');
  } catch { return null; }
}

function checkFIM() {
  let baseline = {};
  try { baseline = JSON.parse(fs.readFileSync(FIM_BASELINE_PATH, 'utf8')); } catch {}
  const changes = [];
  const current = {};
  for (const fp of FIM_WATCH_PATHS) {
    const hash = computeFileHash(fp);
    if (!hash) continue;
    current[fp] = hash;
    if (baseline[fp] && baseline[fp] !== hash) {
      try {
        const stat = fs.statSync(fp);
        changes.push({ path: fp, oldHash: baseline[fp], newHash: hash, modifiedAt: stat.mtime.toISOString(), size: stat.size });
        log('warn', `FIM: ${fp} modified (hash changed)`);
      } catch {}
    }
  }
  try { fs.writeFileSync(FIM_BASELINE_PATH, JSON.stringify(current, null, 2)); } catch {}
  return changes;
}

// ─── Heartbeat Data Buffering (Offline Resilience) ────────────
const BUFFER_PATH = path.join(__dirname, 'heartbeat-buffer.jsonl');
const MAX_BUFFER_ENTRIES = 100;

function bufferHeartbeat(data) {
  try {
    const lines = fs.existsSync(BUFFER_PATH) ? fs.readFileSync(BUFFER_PATH, 'utf8').split('\n').filter(Boolean) : [];
    if (lines.length >= MAX_BUFFER_ENTRIES) lines.shift();
    lines.push(JSON.stringify({ timestamp: new Date().toISOString(), data }));
    fs.writeFileSync(BUFFER_PATH, lines.join('\n') + '\n');
    log('info', `Heartbeat buffered locally (${lines.length} pending)`);
  } catch (e) { log('error', `Buffer write failed: ${e.message}`); }
}

async function drainBuffer() {
  if (!fs.existsSync(BUFFER_PATH)) return;
  try {
    const lines = fs.readFileSync(BUFFER_PATH, 'utf8').split('\n').filter(Boolean);
    if (lines.length === 0) return;
    log('info', `Draining ${lines.length} buffered heartbeats...`);
    for (const line of lines) {
      try {
        const { data } = JSON.parse(line);
        await request('POST', `/discovery/agents/${agentId}/heartbeat`, data);
      } catch { break; }
    }
    fs.unlinkSync(BUFFER_PATH);
    log('info', 'Buffer drained successfully');
  } catch (e) { log('error', `Buffer drain failed: ${e.message}`); }
}

// ─── Heartbeat ──────────────────────────────────────────────
let heartbeatInProgress = false;

async function sendHeartbeat() {
  if (!agentId) return;
  if (heartbeatInProgress) { log('info', 'Heartbeat already in progress, skipping'); return; }
  heartbeatInProgress = true;

  const systemInfo = collectSystemInfo();
  const fimChanges = checkFIM();
  const heartbeatPayload = { systemInfo, version: VERSION, fim: fimChanges };
  try {
    const res = await request('POST', `/discovery/agents/${agentId}/heartbeat`, heartbeatPayload);
    if (res.status === 200 || res.status === 201) {
      await drainBuffer();
      const mem = systemInfo.hardware;
      log('heartbeat', `Heartbeat sent — CPU: ${systemInfo.performance.cpuUsagePercent}% | RAM: ${mem.ramUsagePercent}% (${mem.usedRamMb}/${mem.totalRamMb} MB) | Uptime: ${systemInfo.operatingSystem.uptimeHours}h`);
      
      // Parse active mitigation actions from API response
      if (res.data && Array.isArray(res.data.actions) && res.data.actions.length > 0) {
        log('info', `🛡️  Received ${res.data.actions.length} security action directives from admin...`);
        for (const act of res.data.actions) {
          if (act.type === 'KILL_PROCESS') {
            const { processName, pid } = act;
            if (processName && !/^[a-zA-Z0-9._\-]+$/.test(processName)) {
              log('error', `Invalid process name rejected: "${processName}"`);
              continue;
            }
            if (pid && (isNaN(pid) || pid < 1)) {
              log('error', `Invalid PID rejected: "${pid}"`);
              continue;
            }
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
            const portNum = parseInt(port);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
              log('error', `Invalid port number rejected: "${port}"`);
              continue;
            }
            log('security', `Blocking unauthorized open port ${portNum} (Process: "${processName || 'unknown'}")...`);
            try {
              if (os.platform() === 'win32') {
                exec(`netsh advfirewall firewall add rule name="Block Port ${portNum}" dir=in action=block protocol=TCP localport=${portNum}`);
                log('success', `Blocked port ${portNum} successfully on Windows Firewall.`);
              } else if (os.platform() === 'linux') {
                try {
                  exec(`ufw deny ${portNum}`);
                  log('success', `Blocked port ${portNum} via ufw.`);
                } catch {
                  exec(`iptables -A INPUT -p tcp --dport ${portNum} -j DROP`);
                  log('success', `Blocked port ${portNum} via iptables.`);
                }
              } else if (os.platform() === 'darwin') {
                try {
                  execSync(`echo 'block drop quick proto tcp from any to any port ${portNum}' | sudo pfctl -ef -`, { timeout: 10000 });
                  log('success', `Port ${portNum} blocked via pfctl.`);
                } catch (pfErr) {
                  log('error', `pfctl failed for port ${port}: ${pfErr.message}. Elevated sudo privileges required.`);
                }
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
          } else if (act.type === 'BLOCK_USB') {
            const { deviceName, serialNumber, mountPoint } = act;
            if (mountPoint && /[;&|$`\\]/.test(mountPoint)) {
              log('error', `Invalid device path rejected: "${mountPoint}"`);
              continue;
            }
            log('security', `🚨 ACTIVE COMPLIANCE THREAT: Disapproved/Unauthorized external device "${deviceName}" (Serial: ${serialNumber || 'unknown'}, Mount: ${mountPoint || 'unknown'}). Enforcing active port block...`);
            try {
              if (os.platform() === 'win32') {
                if (mountPoint) {
                  const driveLetter = mountPoint.trim().slice(0, 2);
                  exec(`powershell -Command "(New-Object -comObject Shell.Application).Namespace(17).ParseName('${driveLetter}').InvokeVerb('Eject')"`);
                }
                exec('sc config usbstor start=disabled');
                log('success', `Blocked unauthorized USB Storage device via System Registry / usbstor driver config.`);
              } else if (os.platform() === 'darwin') {
                if (mountPoint) {
                  exec(`diskutil eject "${mountPoint}" || diskutil unmount force "${mountPoint}"`);
                  log('success', `Forcefully unmounted and ejected unauthorized storage volume at mount: ${mountPoint}`);
                } else {
                  log('security', `⚠️ macOS active block requires storage volume mount point details.`);
                }
              } else if (os.platform() === 'linux') {
                if (mountPoint) {
                  exec(`umount -f "${mountPoint}" || eject "${mountPoint}"`);
                  log('success', `Forcefully unmounted unauthorized USB storage filesystem: ${mountPoint}`);
                } else {
                  log('security', `⚠️ Linux active block requires mount point details.`);
                }
              }
            } catch (err) {
              log('error', `Failed to execute active USB storage block: ${err.message}`);
            }
          } else if (act.type === 'ALERT') {
            const { category, summary, details } = act;
            log('security', `[ALERT DETECTED] Category: ${category} | Summary: ${summary} | Details: ${JSON.stringify(details)}`);
          } else if (act.type === 'APPROVE_CHANGE') {
            log('success', `✅ Admin APPROVED change ${act.changeId || ''} (${act.category || 'unknown'}): ${act.summary || 'n/a'}. Enforcement lifted for this item.`);
          } else if (act.type === 'QUARANTINE_DEVICE') {
            log('security', `🔒 QUARANTINE: Server ordered soft quarantine — reason: ${act.reason}`);
            log('security', `🔒 Blocking all outbound traffic except to QS Asset server...`);
            try {
              // Extract server IP/hostname from config
              const serverHost = (CONFIG.server || '').replace(/^https?:\/\//, '').replace(/:\d+$/, '').replace(/\/.*$/, '');
              if (os.platform() === 'win32') {
                // Block all outbound, allow only QS server
                exec(`netsh advfirewall firewall add rule name="QS_QUARANTINE_BLOCK" dir=out action=block enable=yes 2>nul`);
                exec(`netsh advfirewall firewall add rule name="QS_QUARANTINE_ALLOW" dir=out action=allow remoteip=${serverHost} enable=yes 2>nul`);
                // Allow DNS so hostname resolution still works
                exec(`netsh advfirewall firewall add rule name="QS_QUARANTINE_DNS" dir=out action=allow protocol=UDP remoteport=53 enable=yes 2>nul`);
                log('success', `Windows soft quarantine active. Only traffic to ${serverHost} and DNS is allowed.`);
              } else if (os.platform() === 'darwin') {
                // macOS pfctl rules
                const rules = `# QS Asset Quarantine Rules\nblock out all\npass out quick proto tcp to ${serverHost}\npass out quick proto udp to any port 53\npass out quick on lo0 all\n`;
                const ruleFile = '/tmp/qs-quarantine.conf';
                fs.writeFileSync(ruleFile, rules);
                exec(`sudo pfctl -f ${ruleFile} -e 2>/dev/null || pfctl -f ${ruleFile} -e 2>/dev/null`);
                log('success', `macOS soft quarantine active via pfctl. Only traffic to ${serverHost} and DNS is allowed.`);
              } else {
                // Linux iptables
                exec(`iptables -A OUTPUT -d ${serverHost} -j ACCEPT 2>/dev/null`);
                exec(`iptables -A OUTPUT -p udp --dport 53 -j ACCEPT 2>/dev/null`);
                exec(`iptables -A OUTPUT -o lo -j ACCEPT 2>/dev/null`);
                exec(`iptables -A OUTPUT -j DROP 2>/dev/null`);
                log('success', `Linux soft quarantine active via iptables. Only traffic to ${serverHost} and DNS is allowed.`);
              }
            } catch (err) {
              log('error', `Failed to apply soft quarantine: ${err.message}`);
            }
          } else if (act.type === 'INSTALL_SERVICE') {
            log('info', '🚀 Server requested persistent background service installation (Start on Boot)...');
            try {
              const script = os.platform() === 'win32' ? 'install-service.bat' : './install-service.sh';
              const scriptPath = path.join(__dirname, script);
              if (!fs.existsSync(scriptPath)) {
                log('error', `Service installer script not found: ${scriptPath}`);
                continue;
              }
              // Make executable on Unix
              if (os.platform() !== 'win32') {
                try { fs.chmodSync(scriptPath, 0o755); } catch {}
              }
              exec(script, { cwd: __dirname, timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                  log('error', `Failed to install background service: ${error.message}`);
                  if (stderr) log('error', `Service installer stderr: ${stderr}`);
                } else {
                  log('success', '✅ Persistent background service installed! Agent will now start automatically on boot.');
                  if (stdout) log('info', stdout.trim());
                }
              });
            } catch (err) {
              log('error', `Service installation failed: ${err.message}`);
            }
          } else if (act.type === 'UNINSTALL_SERVICE') {
            log('info', '🛑 Server requested removal of persistent background service...');
            try {
              if (os.platform() === 'darwin') {
                const plistPath = path.join(process.env.HOME || '~', 'Library/LaunchAgents/com.qsasset.discovery.agent.plist');
                const daemonPath = '/Library/LaunchDaemons/com.qsasset.discovery.agent.plist';
                let removed = false;
                if (fs.existsSync(plistPath)) {
                  execSync(`launchctl unload "${plistPath}" 2>/dev/null || true`, { timeout: 5000 });
                  fs.unlinkSync(plistPath);
                  log('success', 'macOS LaunchAgent removed. Agent will no longer start on boot.');
                  removed = true;
                }
                if (fs.existsSync(daemonPath)) {
                  execSync(`sudo launchctl unload "${daemonPath}" 2>/dev/null || launchctl unload "${daemonPath}" 2>/dev/null || true`, { timeout: 5000 });
                  try {
                    fs.unlinkSync(daemonPath);
                  } catch (e) {
                    execSync(`sudo rm -f "${daemonPath}" 2>/dev/null || true`, { timeout: 5000 });
                  }
                  log('success', 'macOS LaunchDaemon removed. Agent will no longer start on boot.');
                  removed = true;
                }
                if (!removed) {
                  log('info', 'No LaunchAgent or LaunchDaemon plist found — service not installed.');
                }
              } else if (os.platform() === 'linux') {
                try {
                  execSync('sudo systemctl stop qsasset-agent 2>/dev/null || true', { timeout: 5000 });
                  execSync('sudo systemctl disable qsasset-agent 2>/dev/null || true', { timeout: 5000 });
                  log('success', 'systemd service disabled. Agent will no longer start on boot.');
                } catch (e) {
                  log('error', `Failed to remove systemd service: ${e.message}`);
                }
              } else if (os.platform() === 'win32') {
                try {
                  execSync('sc stop QSAssetAgent 2>nul & sc delete QSAssetAgent 2>nul', { timeout: 5000 });
                  log('success', 'Windows service removed. Agent will no longer start on boot.');
                } catch (e) {
                  log('error', `Failed to remove Windows service: ${e.message}`);
                }
              }
            } catch (err) {
              log('error', `Service uninstall failed: ${err.message}`);
            }
          }
        }
      }

      // Check for auto-update from server
      if (res.data && res.data.updateAvailable && res.data.updateUrl) {
        log('info', `🔄 Agent update available. Downloading...`);
        try {
          const updateFetch = await globalThis.fetch(res.data.updateUrl);
          if (updateFetch.ok) {
            const newScript = await updateFetch.text();
            const newPath = __filename + '.new';
            fs.writeFileSync(newPath, newScript);
            if (res.data.updateChecksum) {
              const hash = require('crypto').createHash('sha256').update(newScript).digest('hex');
              if (hash !== res.data.updateChecksum) {
                log('error', 'Update checksum mismatch — aborting update');
                fs.unlinkSync(newPath);
              } else {
                fs.renameSync(newPath, __filename);
                log('success', '✅ Agent updated successfully. Service manager will restart...');
                process.exit(0);
              }
            } else {
              // No checksum provided — apply anyway with warning
              fs.renameSync(newPath, __filename);
              log('warn', 'Agent updated without checksum verification. Restarting...');
              process.exit(0);
            }
          }
        } catch (e) { log('error', `Auto-update failed: ${e.message}`); }
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
    bufferHeartbeat(heartbeatPayload);
  } finally {
    heartbeatInProgress = false;
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
    res.setHeader('Access-Control-Allow-Origin', `http://localhost:${PORT}`);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
        let processedHtml = html;
        if (accessToken) {
          processedHtml = processedHtml.replace(
            "const API_URL = 'http://localhost:49152/api';",
            `const API_URL = 'http://localhost:49152/api'; const accessToken = '${accessToken}';`
          );
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(processedHtml);
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
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== 'Bearer ' + accessToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
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
  server.listen(PORT, '127.0.0.1', () => {
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
  log('info', 'Running SSDP/UPnP discovery sweep...');
  const ssdpDevices = await discoverSSDP(2000);

  for (const host of aliveHosts) {
    const mac = arpEntries[host.ip] || null;
    const openPorts = await scanPorts(host.ip);
    
    let ssdpInfo = null;
    const ssdpDev = ssdpDevices[host.ip];
    if (ssdpDev && ssdpDev.location) {
      ssdpInfo = await fetchUPnPDetails(ssdpDev.location);
    }
    
    let httpInfo = null;
    const webPorts = openPorts.filter(p => [80, 443, 8080, 8443].includes(p.port));
    if (webPorts.length > 0) {
      httpInfo = await grabHttpBanner(host.ip, webPorts[0].port);
    }

    const classification = classifyDevice(openPorts, mac, ssdpInfo, httpInfo);
    log('info', `Discovered Device: [IP: ${host.ip}] [MAC: ${mac || 'unknown'}] [Type: ${classification.deviceType}] [OS: ${classification.osInfo}] [Vendor: ${classification.manufacturer}] [Model: ${classification.model}]`);
  }

  log('success', `Manual LAN scan complete. Swept 254 IPs, found ${aliveHosts.length} devices.`);
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  // Resolve active network interface (UDP outbound lookup + heuristics fallback)
  await resolveActiveNetworkInterface();

  // Start background recurring check for pending system updates
  startSoftwareUpdatesCheck();

  log('info', '╔══════════════════════════════════════════════════════╗');
  log('info', '║       QS Discovery Agent v' + VERSION + '                     ║');
  log('info', '║       Status Dashboard: http://localhost:49152       ║');
  log('info', '╚══════════════════════════════════════════════════════╝');
  log('info', '');
  log('info', `  Server:   ${SERVER}`);
  log('info', `  User:     ${USER || '(token-based)'}`);
  log('info', `  Host:     ${os.hostname()}`);
  log('info', `  IP:       ${getPrimaryIP()}`);
  log('info', `  Platform: ${os.platform()} ${os.arch()}`);
  log('info', `  Interval: ${INTERVAL}s`);
  log('info', '');

  // Start background HTTP telemetry status server
  startStatusServer();

  // Wait for server connectivity (up to 10 attempts, 5s apart)
  const MAX_CONNECT_ATTEMPTS = 10;
  const CONNECT_DELAY_MS = 5000;
  let serverReachable = false;

  for (let i = 1; i <= MAX_CONNECT_ATTEMPTS; i++) {
    try {
      await fetch(`${SERVER}/api/v1/health`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      // Even if health endpoint doesn't exist, if we don't get a network error the server is up
      serverReachable = true;
      break;
    } catch {
      // Try a simple TCP connect fallback
      try {
        const serverUrl = new URL(SERVER);
        const port = serverUrl.port || (serverUrl.protocol === 'https:' ? 443 : 80);
        await probePort(serverUrl.hostname, parseInt(port), 2000);
        serverReachable = true;
        break;
      } catch {}
    }
    if (i < MAX_CONNECT_ATTEMPTS) {
      log('info', `⏳ Server at ${SERVER} not reachable (attempt ${i}/${MAX_CONNECT_ATTEMPTS}). Retrying in ${CONNECT_DELAY_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, CONNECT_DELAY_MS));
    }
  }

  if (!serverReachable) {
    log('error', `⚠️  Server at ${SERVER} unreachable after ${MAX_CONNECT_ATTEMPTS} attempts. Will continue trying during heartbeat loop...`);
  }

  // Login with retry
  let loggedIn = false;
  for (let i = 1; i <= 3; i++) {
    try {
      loggedIn = await login();
      if (loggedIn) break;
    } catch (err) {
      log('error', `Login attempt ${i}/3 failed: ${err.message}`);
    }
    if (i < 3) {
      log('info', `Retrying login in 5s...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  if (!loggedIn) {
    log('error', '❌ Cannot start agent without authentication. Check server URL and credentials.');
    process.exit(1);
  }

  // Register with retry
  let registered = false;
  for (let i = 1; i <= 3; i++) {
    try {
      registered = await registerAgent();
      if (registered) break;
    } catch (err) {
      log('error', `Registration attempt ${i}/3 failed: ${err.message}`);
    }
    if (i < 3) {
      log('info', `Retrying registration in 5s...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  if (!registered) {
    log('error', '❌ Cannot start agent without registration. Check server URL and credentials.');
    process.exit(1);
  }

  // Heartbeat loop — use setTimeout chain to prevent overlapping heartbeats
  log('success', `Sending heartbeats every ${INTERVAL}s (Ctrl+C to stop)`);
  async function heartbeatLoop() {
    await sendHeartbeat();
    setTimeout(heartbeatLoop, INTERVAL * 1000);
  }
  await heartbeatLoop();
}

main().catch(err => {
  log('error', `Fatal error: ${err.message}`);
  process.exit(1);
});

function discoverSSDP(timeout = 3000) {
  return new Promise((resolve) => {
    const dgram = require('dgram');
    const client = dgram.createSocket('udp4');
    const devices = {};
    
    const message = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1900\r\n' +
      'MAN: "ssdp:discover"\r\n' +
      'MX: 2\r\n' +
      'ST: ssdp:all\r\n' +
      '\r\n'
    );
    
    client.on('message', (msg, rinfo) => {
      const headers = msg.toString();
      const locationMatch = headers.match(/LOCATION:\s*(https?:\/\/\S+)/i);
      const usnMatch = headers.match(/USN:\s*(\S+)/i);
      if (locationMatch) {
        devices[rinfo.address] = {
          ip: rinfo.address,
          location: locationMatch[1],
          usn: usnMatch ? usnMatch[1] : ''
        };
      }
    });
    
    client.on('error', () => {});
    
    client.send(message, 0, message.length, 1900, '239.255.255.250', (err) => {
      if (err) {
        try { client.close(); } catch {}
        resolve({});
      }
    });
    
    setTimeout(() => {
      try { client.close(); } catch {}
      resolve(devices);
    }, timeout);
  });
}

function fetchUPnPDetails(url) {
  return new Promise((resolve) => {
    const httpLib = url.startsWith('https') ? require('https') : require('http');
    let resolved = false;
    
    const cleanup = () => {
      resolved = true;
    };

    const req = httpLib.get(url, { timeout: 2000, rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
        if (body.length > 50000) req.destroy();
      });
      res.on('end', () => {
        if (resolved) return;
        cleanup();
        const friendlyName = body.match(/<friendlyName>([^<]+)<\/friendlyName>/i)?.[1] || '';
        const manufacturer = body.match(/<manufacturer>([^<]+)<\/manufacturer>/i)?.[1] || '';
        const modelName = body.match(/<modelName>([^<]+)<\/modelName>/i)?.[1] || '';
        const deviceType = body.match(/<deviceType>urn:schemas-upnp-org:device:([^:]+)/i)?.[1] || '';
        resolve({ friendlyName, manufacturer, modelName, deviceType });
      });
    });

    req.on('error', () => {
      if (resolved) return;
      cleanup();
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      if (resolved) return;
      cleanup();
      resolve(null);
    });
  });
}

function grabHttpBanner(ip, port) {
  return new Promise((resolve) => {
    const httpLib = port === 443 || port === 8443 ? require('https') : require('http');
    const options = {
      hostname: ip,
      port: port,
      path: '/',
      method: 'GET',
      headers: { 'User-Agent': 'QS-Discovery-Agent' },
      timeout: 1500,
      rejectUnauthorized: false
    };
    
    let resolved = false;
    const req = httpLib.request(options, (res) => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
        if (body.length > 50000) req.destroy();
      });
      res.on('end', () => {
        if (resolved) return;
        resolved = true;
        const title = body.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
        const server = res.headers['server'] || '';
        resolve({ title, server });
      });
    });
    
    req.on('error', () => {
      if (resolved) return;
      resolved = true;
      resolve(null);
    });
    
    req.on('timeout', () => {
      req.destroy();
      if (resolved) return;
      resolved = true;
      resolve(null);
    });
    
    req.end();
  });
}

// Heuristic classification based on open ports, SSDP, and HTTP banner details
function classifyDevice(openPorts, mac, ssdpInfo, httpInfo) {
  const portNumbers = new Set(openPorts.map(p => p.port));
  
  let vendorHint = '';
  let modelHint = '';
  let deviceType = '';
  let osGuess = '';

  // 1. MAC OUI lookup
    // Comprehensive MAC OUI vendor database (top 200+ manufacturers)
    const OUI_DB = {
      '00:50:56': 'VMware', '00:0C:29': 'VMware', '00:05:69': 'VMware',
      '00:1C:14': 'VMware', '00:0F:4B': 'VMware',
      '00:15:5D': 'Microsoft Hyper-V', '00:1D:D8': 'Microsoft',
      '00:03:FF': 'Microsoft',
      'AC:DE:48': 'Apple', '00:1F:F3': 'Apple', '00:25:00': 'Apple',
      'A8:20:66': 'Apple', '3C:22:FB': 'Apple', '00:17:F2': 'Apple',
      '00:1E:C2': 'Apple', '00:26:08': 'Apple', '00:26:BB': 'Apple',
      '70:56:81': 'Apple', '04:F7:E4': 'Apple', '28:6A:BA': 'Apple',
      'F0:18:98': 'Apple', 'F4:5C:89': 'Apple',
      '00:18:FE': 'HP', '00:1A:4B': 'HP', '00:25:B3': 'HP',
      '3C:D9:2B': 'HP', '00:1E:0B': 'HP', '00:17:A4': 'HP',
      '00:14:38': 'HP', '00:12:79': 'HP', '00:0B:CD': 'HP',
      '2C:44:FD': 'HP', '94:57:A5': 'HP', 'B4:B5:2F': 'HP',
      'EC:B1:D7': 'HP', '80:CE:62': 'HP', 'A0:D3:C1': 'HP',
      '00:00:0C': 'Cisco', '00:0D:BC': 'Cisco', '00:14:69': 'Cisco',
      '00:1A:A1': 'Cisco', '00:24:C4': 'Cisco', '00:26:0B': 'Cisco',
      '00:1B:0D': 'Cisco', '00:1E:BD': 'Cisco', '00:22:55': 'Cisco',
      'F8:C2:88': 'Cisco', '68:86:A7': 'Cisco', '7C:0E:CE': 'Cisco',
      'BC:16:65': 'Cisco', 'F4:CF:E2': 'Cisco', 'FC:5B:39': 'Cisco',
      '00:1B:78': 'Juniper', '00:05:85': 'Juniper', '00:12:1E': 'Juniper',
      '00:17:CB': 'Juniper', '00:24:DC': 'Juniper', '00:26:88': 'Juniper',
      'F0:1C:2D': 'Juniper', '2C:6B:F5': 'Juniper',
      '00:0B:86': 'Aruba', '00:1A:1E': 'Aruba', '00:24:6C': 'Aruba',
      '24:DE:C6': 'Aruba', '6C:F3:7F': 'Aruba', 'AC:A3:1E': 'Aruba',
      'D8:C7:C8': 'Aruba',
      '00:18:0A': 'Meraki', '0C:8D:DB': 'Meraki', '00:18:74': 'Meraki',
      'E0:55:3D': 'Meraki', '68:3A:1E': 'Meraki',
      '00:15:6D': 'Ubiquiti', '04:18:D6': 'Ubiquiti', '24:A4:3C': 'Ubiquiti',
      '44:D9:E7': 'Ubiquiti', '68:72:51': 'Ubiquiti', '74:83:C2': 'Ubiquiti',
      '78:8A:20': 'Ubiquiti', '80:2A:A8': 'Ubiquiti', 'B4:FB:E4': 'Ubiquiti',
      'DC:9F:DB': 'Ubiquiti', 'E0:63:DA': 'Ubiquiti', 'F0:9F:C2': 'Ubiquiti',
      'FC:EC:DA': 'Ubiquiti',
      '00:1E:C9': 'Dell', '00:14:22': 'Dell', '00:08:74': 'Dell',
      '00:06:5B': 'Dell', '00:1A:A0': 'Dell', '00:21:9B': 'Dell',
      '00:23:AE': 'Dell', '00:25:64': 'Dell', '14:FE:B5': 'Dell',
      '18:03:73': 'Dell', '18:66:DA': 'Dell', '24:B6:FD': 'Dell',
      '34:17:EB': 'Dell', '44:A8:42': 'Dell', '54:9F:35': 'Dell',
      'B0:83:FE': 'Dell', 'B8:2A:72': 'Dell', 'D4:81:D7': 'Dell',
      'F8:BC:12': 'Dell', 'F8:DB:88': 'Dell',
      '00:06:1B': 'Lenovo', '00:09:2D': 'Lenovo', '00:1A:6B': 'Lenovo',
      '70:5A:0F': 'Lenovo', '98:E7:43': 'Lenovo', 'E8:6A:64': 'Lenovo',
      'F0:4D:A2': 'Lenovo', '54:EE:75': 'Lenovo', '7C:7A:91': 'Lenovo',
      '8C:EC:4B': 'Lenovo',
      '00:07:E9': 'Intel', '00:13:20': 'Intel', '00:15:17': 'Intel',
      '00:1B:21': 'Intel', '00:1E:64': 'Intel', '00:1E:67': 'Intel',
      '00:22:FA': 'Intel', '3C:97:0E': 'Intel', '48:21:0B': 'Intel',
      '68:05:CA': 'Intel', '7C:5C:F8': 'Intel', 'A4:C4:94': 'Intel',
      'B4:96:91': 'Intel', 'F8:63:3F': 'Intel',
      '00:23:CD': 'TP-Link', '10:FE:ED': 'TP-Link', '14:CC:20': 'TP-Link',
      '30:B5:C2': 'TP-Link', '50:C7:BF': 'TP-Link', '54:C8:0F': 'TP-Link',
      '60:E3:27': 'TP-Link', '64:66:B3': 'TP-Link', '94:D9:B3': 'TP-Link',
      'B0:4E:26': 'TP-Link', 'C0:25:E9': 'TP-Link', 'EC:08:6B': 'TP-Link',
      'F4:F2:6D': 'TP-Link',
      '00:14:6C': 'Netgear', '00:1B:2F': 'Netgear', '00:1E:2A': 'Netgear',
      '00:1F:33': 'Netgear', '00:22:3F': 'Netgear', '00:24:B2': 'Netgear',
      '00:26:F2': 'Netgear', '20:0C:C8': 'Netgear', '28:C6:8E': 'Netgear',
      '44:94:FC': 'Netgear', '6C:B0:CE': 'Netgear', 'A0:21:B7': 'Netgear',
      'C4:3D:C7': 'Netgear', 'E0:46:9A': 'Netgear',
      '00:13:10': 'ASUS', '00:1A:92': 'ASUS', '1C:87:2C': 'ASUS',
      '2C:56:DC': 'ASUS', '30:85:A9': 'ASUS', '50:46:5D': 'ASUS',
      'AC:22:0B': 'ASUS', 'BC:EE:7B': 'ASUS', 'E0:3F:49': 'ASUS',
      'F4:6D:04': 'ASUS',
      '00:1C:F0': 'Synology', '00:11:32': 'Synology',
      '00:08:9B': 'QNAP', '24:5E:BE': 'QNAP',
      '00:09:0F': 'Fortinet', '00:60:6E': 'Fortinet', '70:4C:A5': 'Fortinet',
      '90:6C:AC': 'Fortinet', 'E8:1C:BA': 'Fortinet',
      '00:1B:17': 'Palo Alto', '00:86:9C': 'Palo Alto',
      'B4:0C:25': 'Palo Alto',
      '00:1F:45': 'SonicWall', '00:17:C5': 'SonicWall',
      'C0:EA:E4': 'SonicWall',
      '00:04:96': 'Ruckus', '74:91:1A': 'Ruckus', 'EC:8C:A2': 'Ruckus',
      '00:1C:B3': 'MikroTik', '4C:5E:0C': 'MikroTik', '6C:3B:6B': 'MikroTik',
      'B8:69:F4': 'MikroTik', 'CC:2D:E0': 'MikroTik', 'D4:CA:6D': 'MikroTik',
      'E4:8D:8C': 'MikroTik',
      '00:1D:AA': 'Samsung', '00:24:54': 'Samsung', '00:26:37': 'Samsung',
      '08:D4:2B': 'Samsung', '10:D5:42': 'Samsung', '30:96:FB': 'Samsung',
      '50:01:BB': 'Samsung', '6C:F3:73': 'Samsung', '84:25:DB': 'Samsung',
      '8C:77:12': 'Samsung', 'C4:73:1E': 'Samsung', 'E4:7C:F9': 'Samsung',
      '00:10:49': 'WatchGuard', '00:90:7F': 'WatchGuard',
      '00:1A:8C': 'Sophos', '00:1A:8D': 'Sophos', 'B4:0F:3B': 'Sophos',
      '00:24:01': 'D-Link', '1C:7E:E5': 'D-Link', '28:10:7B': 'D-Link',
      '34:08:04': 'D-Link', 'B8:A3:86': 'D-Link', 'C8:BE:19': 'D-Link',
      'CC:B2:55': 'D-Link', 'F0:7D:68': 'D-Link',
      '00:E0:4C': 'Realtek', '00:E0:67': 'Realtek', '52:54:00': 'QEMU/KVM',
      '08:00:27': 'VirtualBox', '0A:00:27': 'VirtualBox',
      '00:16:3E': 'Xen', '00:25:90': 'Super Micro',
      '00:30:48': 'Supermicro', 'AC:1F:6B': 'Supermicro',
      '00:1A:2B': 'Ayecom', '00:17:88': 'Philips Hue',
      'B8:27:EB': 'Raspberry Pi', 'DC:A6:32': 'Raspberry Pi',
      'E4:5F:01': 'Raspberry Pi',
      '00:1D:C9': 'GainSpan', '18:B4:30': 'Nest', '64:16:66': 'Nest',
      '00:17:C8': 'Kyocera', '00:C0:EE': 'Kyocera',
      '00:00:48': 'Xerox', '00:00:AA': 'Xerox',
      '00:00:74': 'Ricoh', '00:26:73': 'Ricoh',
      '00:0E:7F': 'Epson', '00:1B:4C': 'Dahua', '3C:EF:8C': 'Dahua',
      '44:47:CC': 'Hikvision', 'C0:56:E3': 'Hikvision',
      '28:57:BE': 'Hangzhou Hikvision',
      '00:80:F0': 'Panasonic', '00:0A:E4': 'Panasonic',
      '60:02:B4': 'Honeywell', 'CC:6D:A0': 'Honeywell',
      '00:21:6A': 'Intel AMT', '00:0E:0C': 'Intel AMT',
      '00:A0:C9': 'Intel PRO', '00:AA:00': 'Intel',
      '00:30:67': 'Biostar', '00:26:2D': 'Wistron',
      '70:B3:D5': 'IEEE Registered', // Commonly used by IoT devices
    };
    if (mac) {
      const prefix = mac.substring(0, 8).toUpperCase();
      vendorHint = OUI_DB[prefix] || null;
    }

  // 2. SSDP (UPnP) details override (very accurate!)
  if (ssdpInfo) {
    if (ssdpInfo.manufacturer) vendorHint = ssdpInfo.manufacturer;
    if (ssdpInfo.modelName) modelHint = ssdpInfo.modelName;
    if (ssdpInfo.friendlyName && !modelHint) modelHint = ssdpInfo.friendlyName;
    if (ssdpInfo.deviceType) {
      const type = ssdpInfo.deviceType.toLowerCase();
      if (type.includes('printer')) deviceType = 'Printer';
      else if (type.includes('router') || type.includes('gateway')) deviceType = 'Network Device';
      else if (type.includes('media') || type.includes('tv') || type.includes('speaker') || type.includes('player')) deviceType = 'IoT / Media';
    }
  }

  // 3. HTTP banner/title clues
  if (httpInfo) {
    const title = httpInfo.title || '';
    const server = httpInfo.server || '';

    // Extract vendor/model from HTML title
    if (title) {
      if (/asus/i.test(title)) vendorHint = 'ASUS';
      if (/netgear/i.test(title)) vendorHint = 'Netgear';
      if (/linksys/i.test(title)) vendorHint = 'Linksys';
      if (/tp-link/i.test(title)) vendorHint = 'TP-Link';
      if (/synology/i.test(title)) { vendorHint = 'Synology'; deviceType = 'Storage / NAS'; }
      if (/qnap/i.test(title)) { vendorHint = 'QNAP'; deviceType = 'Storage / NAS'; }
      if (/cups/i.test(title) || /laserjet/i.test(title) || /officejet/i.test(title) || /epson/i.test(title) || /canon/i.test(title)) {
        deviceType = 'Printer';
        if (/epson/i.test(title)) vendorHint = 'Epson';
        if (/canon/i.test(title)) vendorHint = 'Canon';
        if (/hp/i.test(title)) vendorHint = 'HP';
      }
      
      // Treat title as model name if it's reasonably short
      if (title.length < 50 && !modelHint) {
        modelHint = title;
      }
    }
    
    // HTTP Server header clues
    if (server) {
      if (/microsoft-iis/i.test(server)) {
        osGuess = 'Windows';
        deviceType = 'Web Server';
      } else if (/apache|nginx/i.test(server)) {
        deviceType = 'Web Server';
      }
    }
  }

  // 4. Fallback port-based classification
  if (!deviceType) {
    if (portNumbers.has(631) || portNumbers.has(9100)) {
      deviceType = 'Printer';
    } else if (portNumbers.has(161) && !portNumbers.has(22) && !portNumbers.has(3389)) {
      deviceType = 'Network Device';
    } else if (portNumbers.has(3389)) {
      deviceType = portNumbers.has(135) ? 'Windows Server' : 'Windows Workstation';
      osGuess = 'Windows';
    } else if (portNumbers.has(22) && !portNumbers.has(3389)) {
      deviceType = portNumbers.has(80) || portNumbers.has(443) ? 'Linux Server' : 'Linux Workstation';
      osGuess = 'Linux/Unix';
    } else if (portNumbers.has(80) || portNumbers.has(443) || portNumbers.has(8080)) {
      deviceType = 'Web Server';
    } else {
      deviceType = vendorHint ? `${vendorHint} Device` : 'Unknown';
    }
  }

  if (!osGuess) {
    if (deviceType.startsWith('Windows')) osGuess = 'Windows';
    else if (deviceType.startsWith('Linux') || deviceType === 'Web Server') osGuess = 'Linux/Unix';
    else if (deviceType === 'Printer' || deviceType === 'Network Device') osGuess = 'Embedded OS';
    else osGuess = 'Unknown';
  }

  return {
    deviceType,
    osInfo: osGuess,
    manufacturer: vendorHint || 'Generic',
    model: modelHint || 'Generic Model'
  };
}

// ─── SNMP Scanning (v1/v2c via raw UDP) ──────────────────────
function snmpEncodeTLV(tag, value) {
  const len = value.length;
  if (len < 128) return Buffer.concat([Buffer.from([tag, len]), value]);
  if (len < 256) return Buffer.concat([Buffer.from([tag, 0x81, len]), value]);
  return Buffer.concat([Buffer.from([tag, 0x82, (len >> 8) & 0xff, len & 0xff]), value]);
}

function snmpEncodeOID(oid) {
  const parts = oid.split('.').map(Number);
  const bytes = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    if (val < 128) { bytes.push(val); }
    else {
      const encoded = [];
      while (val > 0) { encoded.unshift(val & 0x7f); val >>= 7; }
      for (let j = 0; j < encoded.length - 1; j++) encoded[j] |= 0x80;
      bytes.push(...encoded);
    }
  }
  return snmpEncodeTLV(0x06, Buffer.from(bytes));
}

function snmpEncodeInteger(val) {
  if (val === 0) return snmpEncodeTLV(0x02, Buffer.from([0]));
  const bytes = [];
  let v = val;
  while (v > 0) { bytes.unshift(v & 0xff); v >>= 8; }
  if (bytes[0] & 0x80) bytes.unshift(0);
  return snmpEncodeTLV(0x02, Buffer.from(bytes));
}

function snmpEncodeString(str) {
  return snmpEncodeTLV(0x04, Buffer.from(str, 'utf8'));
}

function snmpBuildGetRequest(community, oids, requestId) {
  const varbinds = oids.map(oid => {
    const oidBuf = snmpEncodeOID(oid);
    const nullVal = Buffer.from([0x05, 0x00]);
    return snmpEncodeTLV(0x30, Buffer.concat([oidBuf, nullVal]));
  });
  const varbindList = snmpEncodeTLV(0x30, Buffer.concat(varbinds));
  const reqIdBuf = snmpEncodeInteger(requestId);
  const errorStatus = snmpEncodeInteger(0);
  const errorIndex = snmpEncodeInteger(0);
  const pdu = snmpEncodeTLV(0xa0, Buffer.concat([reqIdBuf, errorStatus, errorIndex, varbindList]));
  const versionBuf = snmpEncodeInteger(1); // SNMPv2c
  const communityBuf = snmpEncodeString(community);
  return snmpEncodeTLV(0x30, Buffer.concat([versionBuf, communityBuf, pdu]));
}

function snmpBuildGetNextRequest(community, oid, requestId) {
  const oidBuf = snmpEncodeOID(oid);
  const nullVal = Buffer.from([0x05, 0x00]);
  const varbind = snmpEncodeTLV(0x30, Buffer.concat([oidBuf, nullVal]));
  const varbindList = snmpEncodeTLV(0x30, varbind);
  const reqIdBuf = snmpEncodeInteger(requestId);
  const errorStatus = snmpEncodeInteger(0);
  const errorIndex = snmpEncodeInteger(0);
  const pdu = snmpEncodeTLV(0xa1, Buffer.concat([reqIdBuf, errorStatus, errorIndex, varbindList]));
  const versionBuf = snmpEncodeInteger(1);
  const communityBuf = snmpEncodeString(community);
  return snmpEncodeTLV(0x30, Buffer.concat([versionBuf, communityBuf, pdu]));
}

function snmpDecodeTLV(buffer, offset) {
  if (offset >= buffer.length) return null;
  const tag = buffer[offset];
  let len = buffer[offset + 1];
  let headerLen = 2;
  if (len & 0x80) {
    const numBytes = len & 0x7f;
    len = 0;
    for (let i = 0; i < numBytes; i++) { len = (len << 8) | buffer[offset + 2 + i]; }
    headerLen = 2 + numBytes;
  }
  const value = buffer.slice(offset + headerLen, offset + headerLen + len);
  return { tag, len, value, totalLen: headerLen + len };
}

function snmpDecodeOID(buffer) {
  const parts = [Math.floor(buffer[0] / 40), buffer[0] % 40];
  let val = 0;
  for (let i = 1; i < buffer.length; i++) {
    val = (val << 7) | (buffer[i] & 0x7f);
    if (!(buffer[i] & 0x80)) { parts.push(val); val = 0; }
  }
  return parts.join('.');
}

function snmpDecodeValue(tag, buffer) {
  if (tag === 0x04) return buffer.toString('utf8');
  if (tag === 0x06) return snmpDecodeOID(buffer);
  if (tag === 0x02) {
    let val = 0;
    for (let i = 0; i < buffer.length; i++) val = (val << 8) | buffer[i];
    return val;
  }
  if (tag === 0x41) { // Counter
    let val = 0;
    for (let i = 0; i < buffer.length; i++) val = (val << 8) | buffer[i];
    return val;
  }
  if (tag === 0x42) { // Gauge
    let val = 0;
    for (let i = 0; i < buffer.length; i++) val = (val << 8) | buffer[i];
    return val;
  }
  if (tag === 0x43) { // TimeTicks
    let val = 0;
    for (let i = 0; i < buffer.length; i++) val = (val << 8) | buffer[i];
    return val;
  }
  if (tag === 0x40) return Array.from(buffer).join('.'); // IpAddress
  return buffer.toString('hex');
}

function snmpParseResponse(buffer) {
  try {
    const msg = snmpDecodeTLV(buffer, 0);
    if (!msg || msg.tag !== 0x30) return null;
    let offset = 0;
    const version = snmpDecodeTLV(msg.value, offset);
    offset += version.totalLen;
    const community = snmpDecodeTLV(msg.value, offset);
    offset += community.totalLen;
    const pdu = snmpDecodeTLV(msg.value, offset);
    if (!pdu) return null;
    let pduOffset = 0;
    const reqId = snmpDecodeTLV(pdu.value, pduOffset); pduOffset += reqId.totalLen;
    const errorStat = snmpDecodeTLV(pdu.value, pduOffset); pduOffset += errorStat.totalLen;
    const errorIdx = snmpDecodeTLV(pdu.value, pduOffset); pduOffset += errorIdx.totalLen;
    const varbindList = snmpDecodeTLV(pdu.value, pduOffset);
    if (!varbindList) return null;
    const results = [];
    let vbOffset = 0;
    while (vbOffset < varbindList.value.length) {
      const varbind = snmpDecodeTLV(varbindList.value, vbOffset);
      if (!varbind) break;
      let innerOff = 0;
      const oidTlv = snmpDecodeTLV(varbind.value, innerOff);
      innerOff += oidTlv.totalLen;
      const valTlv = snmpDecodeTLV(varbind.value, innerOff);
      const oid = snmpDecodeOID(oidTlv.value);
      const value = snmpDecodeValue(valTlv.tag, valTlv.value);
      results.push({ oid, value, type: valTlv.tag });
      vbOffset += varbind.totalLen;
    }
    return { results, errorStatus: snmpDecodeValue(0x02, errorStat.value) };
  } catch (e) { return null; }
}

function snmpGet(host, port, community, oids, timeout = 3000) {
  const dgram = require('dgram');
  return new Promise((resolve) => {
    const reqId = Math.floor(Math.random() * 2147483647);
    const packet = snmpBuildGetRequest(community, oids, reqId);
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => { socket.close(); resolve(null); }, timeout);
    socket.on('message', (msg) => {
      clearTimeout(timer);
      const parsed = snmpParseResponse(msg);
      socket.close();
      resolve(parsed);
    });
    socket.on('error', () => { clearTimeout(timer); socket.close(); resolve(null); });
    socket.send(packet, 0, packet.length, port, host);
  });
}

function snmpWalk(host, port, community, baseOid, timeout = 5000, maxIterations = 100) {
  const dgram = require('dgram');
  return new Promise(async (resolve) => {
    const results = [];
    let currentOid = baseOid;
    let iterations = 0;
    while (iterations < maxIterations) {
      iterations++;
      const response = await new Promise((res) => {
        const reqId = Math.floor(Math.random() * 2147483647);
        const packet = snmpBuildGetNextRequest(community, currentOid, reqId);
        const socket = dgram.createSocket('udp4');
        const timer = setTimeout(() => { socket.close(); res(null); }, timeout);
        socket.on('message', (msg) => {
          clearTimeout(timer);
          const parsed = snmpParseResponse(msg);
          socket.close();
          res(parsed);
        });
        socket.on('error', () => { clearTimeout(timer); socket.close(); res(null); });
        socket.send(packet, 0, packet.length, port, host);
      });
      if (!response || !response.results || response.results.length === 0) break;
      const result = response.results[0];
      // Check if OID is still under the base OID subtree
      if (!result.oid.startsWith(baseOid + '.') && result.oid !== baseOid) break;
      // End of MIB view
      if (result.type === 0x82 || result.type === 0x81) break;
      results.push(result);
      currentOid = result.oid;
    }
    resolve(results);
  });
}

async function performSNMPScan(target, community, port) {
  const snmpPort = port || 161;
  const comm = community || 'public';
  log('info', `🔍 SNMP scanning ${target}:${snmpPort} with community "${comm}"...`);
  
  // Standard system MIB OIDs
  const SYSTEM_OIDS = [
    '1.3.6.1.2.1.1.1.0',  // sysDescr
    '1.3.6.1.2.1.1.2.0',  // sysObjectID
    '1.3.6.1.2.1.1.3.0',  // sysUpTime
    '1.3.6.1.2.1.1.4.0',  // sysContact
    '1.3.6.1.2.1.1.5.0',  // sysName
    '1.3.6.1.2.1.1.6.0',  // sysLocation
  ];
  
  const systemInfo = await snmpGet(target, snmpPort, comm, SYSTEM_OIDS);
  if (!systemInfo || !systemInfo.results || systemInfo.results.length === 0) {
    log('warn', `SNMP scan of ${target}: No response (device may not support SNMP or community string incorrect)`);
    return { success: false, host: target, error: 'No SNMP response' };
  }
  
  const sysData = {};
  const OID_NAMES = {
    '1.3.6.1.2.1.1.1.0': 'sysDescr',
    '1.3.6.1.2.1.1.2.0': 'sysObjectID',
    '1.3.6.1.2.1.1.3.0': 'sysUpTime',
    '1.3.6.1.2.1.1.4.0': 'sysContact',
    '1.3.6.1.2.1.1.5.0': 'sysName',
    '1.3.6.1.2.1.1.6.0': 'sysLocation',
  };
  for (const r of systemInfo.results) {
    const name = OID_NAMES[r.oid];
    if (name) sysData[name] = r.value;
  }
  
  // Walk interface table for interface count and names
  log('info', `SNMP: Walking interface table on ${target}...`);
  const ifDescrWalk = await snmpWalk(target, snmpPort, comm, '1.3.6.1.2.1.2.2.1.2', 3000, 50);
  const ifStatusWalk = await snmpWalk(target, snmpPort, comm, '1.3.6.1.2.1.2.2.1.8', 3000, 50);
  const ifSpeedWalk = await snmpWalk(target, snmpPort, comm, '1.3.6.1.2.1.2.2.1.5', 3000, 50);
  
  const interfaces = ifDescrWalk.map((iface, idx) => ({
    name: iface.value,
    status: ifStatusWalk[idx] ? (ifStatusWalk[idx].value === 1 ? 'up' : 'down') : 'unknown',
    speed: ifSpeedWalk[idx] ? ifSpeedWalk[idx].value : 0,
  }));
  
  // Format uptime
  let uptimeStr = '';
  if (sysData.sysUpTime) {
    const totalSecs = Math.floor(sysData.sysUpTime / 100);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    uptimeStr = `${days}d ${hours}h ${mins}m`;
  }
  
  log('success', `SNMP scan of ${target} complete: ${sysData.sysName || 'Unknown'} — ${interfaces.length} interfaces found`);
  
  return {
    success: true,
    host: target,
    systemInfo: {
      sysDescr: sysData.sysDescr || '',
      sysObjectID: sysData.sysObjectID || '',
      sysUpTime: uptimeStr,
      sysUpTimeRaw: sysData.sysUpTime || 0,
      sysContact: sysData.sysContact || '',
      sysName: sysData.sysName || '',
      sysLocation: sysData.sysLocation || '',
    },
    interfaces,
    interfaceCount: interfaces.length,
  };
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

// Parse port range specification into array of port numbers
function parsePortRange(portRange) {
  if (!portRange) return null;
  if (Array.isArray(portRange)) return portRange;
  const ports = new Set();
  const parts = String(portRange).split(',').map(s => s.trim());
  for (const part of parts) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Math.max(1, parseInt(range[1], 10));
      const end = Math.min(65535, parseInt(range[2], 10));
      for (let p = start; p <= end; p++) ports.add(p);
    } else {
      const p = parseInt(part, 10);
      if (p >= 1 && p <= 65535) ports.add(p);
    }
  }
  return ports.size > 0 ? Array.from(ports).sort((a, b) => a - b) : null;
}

// Scan ports of a single active host
async function scanPorts(ip, customPorts) {
  const DEFAULT_SERVICE_PORTS = [22, 80, 135, 139, 161, 443, 445, 631, 3306, 3389, 5432, 5900, 8080, 8443, 9100];
  const EXTENDED_PORTS = [20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 111, 119, 123, 135, 137, 138, 139, 143, 161, 162, 179, 389, 443, 445, 465, 514, 515, 587, 631, 636, 993, 995, 1080, 1433, 1521, 1723, 2049, 2082, 2083, 2086, 2087, 3306, 3389, 4443, 5060, 5432, 5631, 5900, 5901, 6379, 8000, 8008, 8080, 8443, 8888, 9090, 9100, 9200, 9443, 10000, 11211, 27017, 27018, 49152];
  const SERVICE_PORTS = customPorts || DEFAULT_SERVICE_PORTS;
  const PORT_SERVICE_MAP = {
    20: 'FTP-Data', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
    67: 'DHCP', 68: 'DHCP', 69: 'TFTP', 80: 'HTTP', 110: 'POP3', 111: 'RPC',
    119: 'NNTP', 123: 'NTP', 135: 'RPC', 137: 'NetBIOS', 138: 'NetBIOS', 139: 'NetBIOS',
    143: 'IMAP', 161: 'SNMP', 162: 'SNMP-Trap', 179: 'BGP', 389: 'LDAP',
    443: 'HTTPS', 445: 'SMB', 465: 'SMTPS', 514: 'Syslog', 515: 'LPD',
    587: 'SMTP-Sub', 631: 'IPP/Printer', 636: 'LDAPS', 993: 'IMAPS', 995: 'POP3S',
    1080: 'SOCKS', 1433: 'MSSQL', 1521: 'Oracle', 1723: 'PPTP', 2049: 'NFS',
    3306: 'MySQL', 3389: 'RDP', 4443: 'HTTPS-Alt', 5060: 'SIP',
    5432: 'PostgreSQL', 5631: 'pcAnywhere', 5900: 'VNC', 5901: 'VNC',
    6379: 'Redis', 8000: 'HTTP-Alt', 8008: 'HTTP-Alt', 8080: 'HTTP-Proxy',
    8443: 'HTTPS-Alt', 8888: 'HTTP-Alt', 9090: 'Prometheus', 9100: 'JetDirect',
    9200: 'Elasticsearch', 9443: 'HTTPS-Alt', 10000: 'Webmin',
    11211: 'Memcached', 27017: 'MongoDB', 27018: 'MongoDB', 49152: 'Dynamic',
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

  // Phase 2.5: Active SSDP / UPnP Discovery Sweep (2s)
  log('info', 'LAN Scan: Running SSDP/UPnP discovery sweep...');
  const ssdpDevices = await discoverSSDP(2000);
  log('info', `LAN Scan: SSDP sweep found ${Object.keys(ssdpDevices).length} active UPnP endpoints.`);

  // Phase 3: Perform service scan & classification
  const discoveredDevices = [];
  for (const host of aliveHosts) {
    const mac = arpEntries[host.ip] || null;
    const openPorts = await scanPorts(host.ip);
    
    // Check if we have SSDP info for this host
    let ssdpInfo = null;
    const ssdpDev = ssdpDevices[host.ip];
    if (ssdpDev && ssdpDev.location) {
      log('info', `LAN Scan: Querying UPnP device details at ${ssdpDev.location}...`);
      ssdpInfo = await fetchUPnPDetails(ssdpDev.location);
    }
    
    // Grab HTTP title/banner if web ports are open
    let httpInfo = null;
    const webPorts = openPorts.filter(p => [80, 443, 8080, 8443].includes(p.port));
    if (webPorts.length > 0) {
      const targetPort = webPorts[0].port;
      log('info', `LAN Scan: Grabbing HTTP banner from ${host.ip}:${targetPort}...`);
      httpInfo = await grabHttpBanner(host.ip, targetPort);
    }
    
    const classification = classifyDevice(openPorts, mac, ssdpInfo, httpInfo);
    
    // Build rich enrichmentData object matching standard formatting for UI display
    const enrichmentData = {
      collectedAt: new Date().toISOString(),
      method: 'AGENT_LAN_SCAN',
      dataQuality: openPorts.length > 0 ? 'GOOD' : 'LIMITED',
      hardware: {
        detectedType: classification.deviceType,
        manufacturer: classification.manufacturer,
        model: classification.model,
        macPrefix: mac ? mac.substring(0, 8).toUpperCase() : null,
      },
      operatingSystem: {
        osGuess: classification.osInfo,
        name: classification.osInfo,
        hostname: host.hostname || (ssdpInfo && ssdpInfo.friendlyName) || '',
      },
      network: {
        ipAddress: host.ip,
        macAddress: mac,
        openPorts: openPorts.map(p => ({
          port: p.port,
          service: p.service,
          protocol: 'TCP',
          risk: [21, 23, 25, 445, 3389].includes(p.port) ? 'HIGH' :
                [80, 8080, 8443].includes(p.port) ? 'MEDIUM' : 'LOW',
        })),
        services: openPorts.map(p => p.service),
      },
      security: {
        riskScore: openPorts.length * 15,
        riskLevel: openPorts.length >= 4 ? 'HIGH' : openPorts.length >= 2 ? 'MEDIUM' : 'LOW',
      }
    };
    
    discoveredDevices.push({
      ip: host.ip,
      mac,
      hostname: host.hostname || (ssdpInfo && ssdpInfo.friendlyName) || null,
      openPorts,
      deviceType: classification.deviceType,
      manufacturer: classification.manufacturer,
      osInfo: classification.osInfo,
      enrichmentData
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
