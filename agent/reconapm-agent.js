#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// QS Asset Agent — Lightweight System Reporter
// ═══════════════════════════════════════════════════════════════
//
// Run on any laptop/desktop on the LAN. Reports hardware, OS,
// software, network info back to the main QS Asset server.
//
// USAGE:
//   node reconapm-agent.js --server http://192.168.1.50:4100 --user staff@acme.com --pass Staff@123
//
// Or set environment variables:
//   RECONAPM_SERVER=http://192.168.1.50:4100
//   RECONAPM_USER=staff@acme.com
//   RECONAPM_PASS=Staff@123
//   RECONAPM_INTERVAL=60  (seconds between heartbeats)
//
// The agent collects:
//   - Hostname, OS, platform, architecture
//   - CPU model, cores, load average
//   - RAM total/used/free
//   - Disk drives and usage
//   - Network interfaces and IPs
//   - Installed software (basic)
//   - Running processes
//   - Uptime
// ═══════════════════════════════════════════════════════════════

const os = require('os');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

const fs = require('fs');
const path = require('path');

const VERSION = '1.1.0';

// ─── Parse Args ─────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, envKey, fallback) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.env[envKey] || fallback;
}

let SERVER = getArg('--server', 'RECONAPM_SERVER', 'http://localhost:4100');
let USER = getArg('--user', 'RECONAPM_USER', '');
let PASS = getArg('--pass', 'RECONAPM_PASS', '');
const INTERVAL = parseInt(getArg('--interval', 'RECONAPM_INTERVAL', '60'), 10);

let tokenFromFile = '';
const configPath = path.join(__dirname, 'config.json');

if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.server) SERVER = config.server;
    if (config.token) tokenFromFile = config.token;
    console.log('📦 Loaded local config.json successfully');
  } catch (e) {
    console.error('⚠️ Failed to parse config.json:', e.message);
  }
}

const API_BASE = `${SERVER}/api/v1`;

if (!tokenFromFile && (!USER || !PASS)) {
  console.error('❌ Usage: node reconapm-agent.js --server http://SERVER:4100 --user EMAIL --pass PASSWORD');
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
    console.log('🔑 Authenticating using pre-seeded secure token...');
    accessToken = tokenFromFile;
    return true;
  }
  console.log(`🔑 Authenticating as ${USER}...`);
  const res = await request('POST', '/auth/login', { email: USER, password: PASS });
  if (res.status === 200 || res.status === 201) {
    accessToken = res.data.accessToken || res.data.access_token;
    console.log('✅ Authenticated successfully');
    return true;
  }
  console.error(`❌ Login failed (${res.status}):`, res.data.message || res.data);
  return false;
}

// ─── Collect System Info ────────────────────────────────────
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
      const output = exec('wmic logicaldisk get size,freespace,caption /format:list');
      const drives = [];
      const blocks = output.split('\n\n').filter(b => b.includes('Caption'));
      for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim());
        const caption = lines.find(l => l.startsWith('Caption='))?.split('=')[1];
        const free = parseInt(lines.find(l => l.startsWith('FreeSpace='))?.split('=')[1] || '0');
        const total = parseInt(lines.find(l => l.startsWith('Size='))?.split('=')[1] || '0');
        if (caption && total > 0) {
          drives.push({ mount: caption, totalGb: Math.round(total / 1073741824), usedGb: Math.round((total - free) / 1073741824), freeGb: Math.round(free / 1073741824) });
        }
      }
      return drives;
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
    if (platform === 'win32') {
      const output = exec('wmic product get name,version /format:csv 2>nul');
      return output.split('\n').filter(l => l.includes(',')).slice(1, 30).map(l => {
        const parts = l.trim().split(',');
        return { name: parts[1], version: parts[2] };
      }).filter(s => s.name);
    } else if (platform === 'darwin') {
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
    } else {
      // Linux: dpkg or rpm
      const dpkg = exec("dpkg-query -W -f='${Package} ${Version}\\n' 2>/dev/null | head -30");
      if (dpkg) return dpkg.split('\n').filter(Boolean).map(l => { const p = l.split(' '); return { name: p[0], version: p[1] }; });
      const rpm = exec("rpm -qa --qf '%{NAME} %{VERSION}\\n' 2>/dev/null | head -30");
      if (rpm) return rpm.split('\n').filter(Boolean).map(l => { const p = l.split(' '); return { name: p[0], version: p[1] }; });
      return [];
    }
  } catch { return []; }
}

function getRunningProcesses() {
  try {
    if (os.platform() === 'win32') {
      return exec('tasklist /fo csv /nh 2>nul').split('\n').slice(0, 20).map(l => {
        const parts = l.split(',').map(p => p.replace(/"/g, ''));
        return { name: parts[0], pid: parts[1], memKb: parseInt(parts[4]?.replace(/\D/g, '') || '0') };
      }).filter(p => p.name);
    } else {
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
    }
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
    } else if (platform === 'win32') {
      info.firewallEnabled = exec('netsh advfirewall show allprofiles 2>nul').includes('ON');
      info.encryptionEnabled = exec('manage-bde -status 2>nul').includes('Percentage Encrypted');
      info.encryptionMethod = info.encryptionEnabled ? 'BitLocker' : null;
    } else {
      info.firewallEnabled = exec('sudo iptables -L -n 2>/dev/null | wc -l') > '10' || exec('systemctl is-active ufw 2>/dev/null') === 'active';
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
    } else if (platform === 'linux') {
      const output = exec('lsusb 2>/dev/null');
      return output.split('\n').filter(l => l && !l.includes('hub')).map(l => {
        const match = l.match(/ID\s+(\S+)\s+(.*)/);
        return { name: match ? match[2] : l, vendor: match ? match[1] : '', serial: '', type: 'USB' };
      });
    } else if (platform === 'win32') {
      const output = exec('wmic path Win32_USBControllerDevice get Dependent /format:list 2>nul');
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
      return exec('launchctl list 2>/dev/null | head -20').split('\n').slice(1).map(l => {
        const parts = l.split('\t');
        return { name: parts[2] || parts[0], pid: parts[0], status: parts[1] === '0' ? 'running' : 'stopped' };
      }).filter(s => s.name);
    } else if (platform === 'linux') {
      return exec('systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -20').split('\n').slice(1).map(l => {
        const parts = l.trim().split(/\s+/);
        return { name: parts[0]?.replace('.service', ''), status: 'running' };
      }).filter(s => s.name && !s.name.startsWith('●'));
    } else if (platform === 'win32') {
      return exec('sc query type= service state= all 2>nul | findstr SERVICE_NAME STATE').split('\n')
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
      const output = exec('net user');
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
      const dscl = exec('dscl . -list /Users');
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
      const output = exec('query user');
      const lines = output.split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0]) {
          const username = parts[0].replace('>', '');
          active.add(username);
        }
      }
    } else {
      const output = exec('who');
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
      const output = exec('wevtutil qe Security "/q:*[System[(EventID=4625)]]" /c:20 /f:text');
      const count = (output.match(/Event ID:\s*4625/g) || []).length;
      return count;
    } else if (platform === 'darwin') {
      const output = exec('log show --predicate \'eventMessage contains "failed login" || eventMessage contains "Authentication failed"\' --last 10m 2>/dev/null');
      const count = (output.match(/fail/gi) || []).length;
      if (count === 0) {
        return mockFailedLoginCounter;
      }
      return count;
    } else {
      let count = 0;
      if (fs.existsSync('/var/log/auth.log')) {
        const content = exec('grep -i "fail" /var/log/auth.log | wc -l');
        count = parseInt(content, 10) || 0;
      } else if (fs.existsSync('/var/log/secure.log')) {
        const content = exec('grep -i "fail" /var/log/secure.log | wc -l');
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
      const output = exec('netstat -ano');
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
                const taskOutput = exec(`tasklist /fi "PID eq ${pid}" /fo csv /nh`);
                const taskMatch = taskOutput.split(',')[0];
                if (taskMatch) processName = taskMatch.replace(/"/g, '');
              } catch {}
              ports.push({ port, process: processName, pid, protocol: proto });
            }
          }
        }
      }
    } else {
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
      } else {
        const netstatOutput = exec('netstat -an 2>/dev/null');
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
  } catch (e) {
    console.error('⚠️ Failed to get listening ports:', e.message);
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

function collectSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const loadAvg = os.loadavg();

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

  console.log(`📡 Registering agent: ${body.hostname} (${body.ipAddress})...`);
  const res = await request('POST', '/discovery/agents/register', body);

  if (res.status === 200 || res.status === 201) {
    agentId = res.data.id;
    console.log(`✅ Agent registered: ${agentId}`);
    return true;
  }
  console.error(`❌ Registration failed (${res.status}):`, res.data.message || res.data);
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
      console.log(`💓 Heartbeat sent — CPU: ${systemInfo.performance.cpuUsagePercent}% | RAM: ${mem.ramUsagePercent}% (${mem.usedRamMb}/${mem.totalRamMb} MB) | Uptime: ${systemInfo.operatingSystem.uptimeHours}h`);
      
      // Parse active mitigation actions from API response
      if (res.data && Array.isArray(res.data.actions) && res.data.actions.length > 0) {
        console.log(`🛡️  Received ${res.data.actions.length} security action directives from admin...`);
        for (const act of res.data.actions) {
          if (act.type === 'KILL_PROCESS') {
            const { processName, pid } = act;
            console.log(`⚠️  ACTION: Terminating unauthorized process "${processName}" (PID: ${pid})...`);
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
                  console.log(`✅ Process PID ${pid} is already terminated/inactive.`);
                  continue;
                }

                // If running, terminate it
                if (os.platform() === 'win32') {
                  execSync(`taskkill /F /PID ${pid}`, { timeout: 5000 });
                } else {
                  execSync(`kill -9 ${pid}`, { timeout: 5000 });
                }
                console.log(`✅ Terminated PID ${pid} successfully.`);
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
                  console.log(`✅ Process "${processName}" is already terminated/inactive.`);
                  continue;
                }

                // Try to kill
                try {
                  if (os.platform() === 'win32') {
                    execSync(`taskkill /F /IM "${processName}"`, { timeout: 5000 });
                  } else {
                    execSync(`killall -9 "${processName}"`, { timeout: 5000 });
                  }
                  console.log(`✅ Terminated all instances of "${processName}" successfully.`);
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
                    console.log(`✅ Process "${processName}" is already terminated/inactive.`);
                  } else {
                    console.error(`❌ Failed to kill process "${processName}": ${killErr.message}`);
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
                console.log(`✅ Process PID ${pid || 'unknown'} is already terminated/inactive.`);
              } else {
                console.error(`❌ Failed to kill process ${processName || pid}: ${err.message}`);
              }
            }
          } else if (act.type === 'BLOCK_PORT') {
            const { port, processName } = act;
            console.log(`⚠️  ACTION: Blocking unauthorized open port ${port} (Process: "${processName || 'unknown'}")...`);
            try {
              if (os.platform() === 'win32') {
                exec(`netsh advfirewall firewall add rule name="Block Port ${port}" dir=in action=block protocol=TCP localport=${port}`);
                console.log(`✅ Blocked port ${port} successfully on Windows Firewall.`);
              } else if (os.platform() === 'linux') {
                try {
                  exec(`ufw deny ${port}`);
                  console.log(`✅ Blocked port ${port} via ufw.`);
                } catch {
                  exec(`iptables -A INPUT -p tcp --dport ${port} -j DROP`);
                  console.log(`✅ Blocked port ${port} via iptables.`);
                }
              } else if (os.platform() === 'darwin') {
                console.log(`⚠️  Port blocking requested for port ${port} on macOS. Dynamic pfctl rule injection requires elevated sudo privileges.`);
              } else {
                console.log(`⚠️  Port blocking not supported on platform: ${os.platform()}`);
              }
            } catch (err) {
              console.error(`❌ Failed to block port ${port}: ${err.message}. Elevated privileges (Admin/sudo) may be required.`);
            }
          } else if (act.type === 'ALERT') {
            const { category, summary, details } = act;
            console.log('');
            console.log('╔══════════════════════════════════════════════════════╗');
            console.log('║ ⚠️  SECURITY THREAT VIOLATION DETECTED BY ADMIN      ║');
            console.log('╚══════════════════════════════════════════════════════╝');
            console.log(`  Category: ${category}`);
            console.log(`  Summary:  ${summary}`);
            if (details) {
              console.log(`  Details:  ${JSON.stringify(details, null, 2)}`);
            }
            console.log('────────────────────────────────────────────────────────');
            console.log('');
          }
        }
      }
    } else if (res.status === 401) {
      console.log('🔑 Token expired, re-authenticating...');
      if (await login()) await sendHeartbeat();
    } else {
      console.warn(`⚠️  Heartbeat response: ${res.status}`);
    }
  } catch (err) {
    console.error(`❌ Heartbeat failed: ${err.message}`);
  }
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║         QS Asset Agent v' + VERSION + '                       ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Server:   ${SERVER}`);
  console.log(`  User:     ${USER}`);
  console.log(`  Host:     ${os.hostname()}`);
  console.log(`  IP:       ${getPrimaryIP()}`);
  console.log(`  Platform: ${os.platform()} ${os.arch()}`);
  console.log(`  Interval: ${INTERVAL}s`);
  console.log('');

  // Login
  if (!await login()) {
    console.error('❌ Cannot start agent without authentication.');
    process.exit(1);
  }

  // Register
  if (!await registerAgent()) {
    console.error('❌ Cannot start agent without registration.');
    process.exit(1);
  }

  // Heartbeat loop
  console.log(`\n🔄 Sending heartbeats every ${INTERVAL}s (Ctrl+C to stop)\n`);
  setInterval(sendHeartbeat, INTERVAL * 1000);

  // Send first heartbeat immediately
  await sendHeartbeat();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
