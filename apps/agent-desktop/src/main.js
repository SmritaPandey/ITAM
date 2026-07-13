'use strict';

const {
  app,
  Tray,
  Menu,
  BrowserWindow,
  nativeImage,
  shell,
  ipcMain,
} = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const AutoLaunch = require('auto-launch');

const DASHBOARD_PORT = 49152;
const HEARTBEAT_STALE_MS = 90_000;

let tray = null;
let statusWindow = null;
let agentProcess = null;
let paused = false;
let lastHeartbeat = null;
let agentOnline = false;
let agentConfig = null;
let usingElectronNode = false;

function getAgentDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'agent');
  }
  return path.resolve(__dirname, '../../../agent');
}

function getAgentScript() {
  return path.join(getAgentDir(), 'qs-discovery-agent.js');
}

function loadAgentConfig() {
  const configPath = path.join(getAgentDir(), 'config.json');
  if (!fs.existsSync(configPath)) {
    agentConfig = null;
    return null;
  }
  try {
    agentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return agentConfig;
  } catch {
    agentConfig = null;
    return null;
  }
}

function assetPath(name) {
  return path.join(__dirname, '..', 'assets', name);
}

function trayIcon(state) {
  const file =
    state === 'online'
      ? 'tray-online.png'
      : state === 'paused'
        ? 'tray-paused.png'
        : 'tray-offline.png';
  let img = nativeImage.createFromPath(assetPath(file));
  if (process.platform === 'darwin') {
    img = img.resize({ width: 16, height: 16 });
  }
  return img;
}

function formatHeartbeat(ts) {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString();
}

function currentState() {
  if (paused) return 'paused';
  if (agentOnline && lastHeartbeat && Date.now() - lastHeartbeat < HEARTBEAT_STALE_MS) {
    return 'online';
  }
  if (agentProcess && !agentProcess.killed) return 'online';
  return 'offline';
}

function getStatusPayload() {
  return {
    state: currentState(),
    online: currentState() === 'online',
    paused,
    lastHeartbeat,
    lastHeartbeatLabel: formatHeartbeat(lastHeartbeat),
    server: agentConfig?.server || null,
    email: agentConfig?.email || null,
    dashboardUrl: `http://localhost:${DASHBOARD_PORT}/`,
    agentDir: getAgentDir(),
  };
}

function buildMenu() {
  const state = currentState();
  const statusLabel =
    state === 'paused' ? 'Paused' : state === 'online' ? 'Online' : 'Offline';

  return Menu.buildFromTemplate([
    { label: `Status: ${statusLabel}`, enabled: false },
    { label: `Last heartbeat: ${formatHeartbeat(lastHeartbeat)}`, enabled: false },
    { type: 'separator' },
    { label: 'Open Status Dashboard', click: () => openStatusDashboard() },
    {
      label: paused ? 'Resume agent' : 'Pause agent',
      click: () => (paused ? resumeAgent() : pauseAgent()),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        stopAgent();
        app.quit();
      },
    },
  ]);
}

function refreshTray() {
  if (!tray) return;
  const state = currentState();
  tray.setImage(trayIcon(state));
  tray.setToolTip(
    state === 'paused'
      ? 'QS Agent — Paused'
      : state === 'online'
        ? `QS Agent — Online\nLast heartbeat: ${formatHeartbeat(lastHeartbeat)}`
        : 'QS Agent — Offline',
  );
  tray.setContextMenu(buildMenu());
  if (statusWindow && !statusWindow.isDestroyed()) {
    statusWindow.webContents.send('agent-status', getStatusPayload());
  }
}

function parseAgentOutput(chunk) {
  const text = chunk.toString();
  if (/Heartbeat sent|💓/.test(text)) {
    lastHeartbeat = Date.now();
    agentOnline = true;
    refreshTray();
  }
  if (/Local Status Dashboard API running|Sending heartbeats|registered successfully/.test(text)) {
    agentOnline = true;
    refreshTray();
  }
}

function attachAgentHandlers(child) {
  child.stdout.on('data', parseAgentOutput);
  child.stderr.on('data', parseAgentOutput);

  child.on('exit', (code, signal) => {
    if (agentProcess !== child) return;
    agentProcess = null;
    agentOnline = false;
    refreshTray();
    if (!paused && signal !== 'SIGTERM' && code !== 0) {
      setTimeout(() => {
        if (!paused && !agentProcess) startAgent();
      }, 5000);
    }
  });
}

function spawnAgentProcess(useElectronNode) {
  const script = getAgentScript();
  const args = [script, '--silent'];
  const env = {
    ...process.env,
    QS_AGENT_SILENT: 'true',
  };

  let command;
  if (useElectronNode) {
    command = process.execPath;
    env.ELECTRON_RUN_AS_NODE = '1';
    usingElectronNode = true;
  } else {
    command = process.env.NODE_BINARY || 'node';
    delete env.ELECTRON_RUN_AS_NODE;
    usingElectronNode = false;
  }

  return spawn(command, args, {
    cwd: getAgentDir(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function startAgent() {
  if (paused || agentProcess) return;

  const script = getAgentScript();
  if (!fs.existsSync(script)) {
    console.error('Agent script not found:', script);
    agentOnline = false;
    refreshTray();
    return;
  }

  loadAgentConfig();

  const child = spawnAgentProcess(usingElectronNode);
  agentProcess = child;
  agentOnline = true;
  attachAgentHandlers(child);

  child.once('error', (err) => {
    console.error('Agent spawn error:', err.message);
    if (agentProcess === child) agentProcess = null;
    if (!usingElectronNode) {
      console.warn('Retrying with Electron Node runtime…');
      usingElectronNode = true;
      startAgent();
    } else {
      agentOnline = false;
      refreshTray();
    }
  });

  refreshTray();
}

function stopAgent() {
  if (!agentProcess) return;
  const child = agentProcess;
  agentProcess = null;
  agentOnline = false;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true });
    } else {
      child.kill('SIGTERM');
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already dead */
        }
      }, 2000);
    }
  } catch {
    /* ignore */
  }
}

function pauseAgent() {
  paused = true;
  stopAgent();
  refreshTray();
}

function resumeAgent() {
  paused = false;
  startAgent();
  refreshTray();
}

function probeDashboard(cb) {
  const req = http.get(
    { hostname: '127.0.0.1', port: DASHBOARD_PORT, path: '/', timeout: 1500 },
    (res) => {
      res.resume();
      cb(res.statusCode >= 200 && res.statusCode < 500);
    },
  );
  req.on('error', () => cb(false));
  req.on('timeout', () => {
    req.destroy();
    cb(false);
  });
}

function openStatusDashboard() {
  probeDashboard((up) => {
    if (up) {
      shell.openExternal(`http://localhost:${DASHBOARD_PORT}/`);
      return;
    }
    showStatusWindow();
  });
}

function showStatusWindow() {
  if (statusWindow && !statusWindow.isDestroyed()) {
    statusWindow.setSkipTaskbar(true);
    statusWindow.show();
    statusWindow.focus();
    statusWindow.webContents.send('agent-status', getStatusPayload());
    return;
  }

  statusWindow = new BrowserWindow({
    width: 420,
    height: 380,
    resizable: false,
    maximizable: false,
    title: 'QS Discovery Agent',
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  statusWindow.setMenuBarVisibility(false);
  statusWindow.setSkipTaskbar(true);
  statusWindow.loadFile(path.join(__dirname, 'status.html'));
  statusWindow.once('ready-to-show', () => {
    statusWindow.show();
    statusWindow.webContents.send('agent-status', getStatusPayload());
  });
  statusWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      statusWindow.hide();
      if (process.platform === 'darwin') app.dock?.hide();
    }
  });
}

function setupAutoLaunch() {
  const autoLauncher = new AutoLaunch({
    name: 'QS Discovery Agent',
    path: app.getPath('exe'),
    isHidden: true,
  });
  autoLauncher
    .isEnabled()
    .then((enabled) => {
      if (!enabled) return autoLauncher.enable();
    })
    .catch((err) => console.warn('Auto-launch setup skipped:', err.message));
}

function createTray() {
  tray = new Tray(trayIcon('offline'));
  tray.setToolTip('QS Discovery Agent');
  tray.setContextMenu(buildMenu());
  tray.on('click', () => {
    if (process.platform !== 'darwin') tray.popUpContextMenu();
  });
  tray.on('double-click', () => openStatusDashboard());
}

ipcMain.handle('get-status', () => getStatusPayload());
ipcMain.handle('open-dashboard', () => {
  openStatusDashboard();
  return true;
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => openStatusDashboard());

  app.whenReady().then(() => {
    if (process.platform === 'darwin') {
      app.dock.hide();
    }

    loadAgentConfig();
    createTray();
    setupAutoLaunch();
    startAgent();
    setInterval(refreshTray, 15_000);
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  stopAgent();
});

app.on('window-all-closed', () => {
  // Stay alive in the system tray
});
