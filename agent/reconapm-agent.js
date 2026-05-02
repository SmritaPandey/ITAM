#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// ReconAPM Agent — Lightweight System Reporter
// ═══════════════════════════════════════════════════════════════
//
// Run on any laptop/desktop on the LAN. Reports hardware, OS,
// software, network info back to the main ReconAPM server.
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

const VERSION = '1.0.0';

// ─── Parse Args ─────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, envKey, fallback) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.env[envKey] || fallback;
}

const SERVER = getArg('--server', 'RECONAPM_SERVER', 'http://localhost:4100');
const USER = getArg('--user', 'RECONAPM_USER', '');
const PASS = getArg('--pass', 'RECONAPM_PASS', '');
const INTERVAL = parseInt(getArg('--interval', 'RECONAPM_INTERVAL', '60'), 10);
const API_BASE = `${SERVER}/api/v1`;

if (!USER || !PASS) {
  console.error('❌ Usage: node reconapm-agent.js --server http://SERVER:4100 --user EMAIL --pass PASSWORD');
  process.exit(1);
}

let accessToken = '';
let agentId = '';

// ─── HTTP Helper ────────────────────────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      rejectUnauthorized: false,
    };

    const req = lib.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Login ──────────────────────────────────────────────────
async function login() {
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
      return exec('ps aux --sort=-%mem 2>/dev/null | head -15 || ps aux | head -15').split('\n').slice(1).map(l => {
        const p = l.trim().split(/\s+/);
        return { user: p[0], pid: p[1], cpu: p[2], mem: p[3], command: p.slice(10).join(' ') };
      });
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
    security: getSecurityInfo(),
    software: getInstalledSoftware(),
    processes: getRunningProcesses(),
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
  console.log('║         ReconAPM Agent v' + VERSION + '                       ║');
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
