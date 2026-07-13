# QS Discovery Agent

A **zero-dependency** lightweight agent that runs on staff laptops/desktops and reports system information back to the main QS Asset server.

## What It Collects

| Category | Data |
|----------|------|
| **Hardware** | CPU model, cores, speed, RAM total/used/free, disk usage |
| **OS** | Platform, version, architecture, hostname, uptime |
| **Network** | All interfaces with IP, MAC, netmask |
| **Software** | Installed packages/apps (top 30) |
| **Security** | Firewall status, disk encryption status |
| **Performance** | CPU load average, RAM usage %, top processes |

## Requirements

- **Node.js 18+** (no other dependencies; portable Node can be downloaded by installers)
- Network access to the QS Asset server
- **No Docker required** for running or packaging the agent

## Install paths

Choose one of three paths depending on how IT distributes the agent.

### 1. Desktop App (interactive / one-click)

| OS | How |
|----|-----|
| **macOS** | Double-click `QS-Discovery-Agent.app` (build with `./build-macos-app.sh`) |
| **Windows** | Double-click `Start Agent.bat` or `run-agent.bat` |
| **Linux** | Run `./run-agent.sh` (or use the `.desktop` launcher) |

First-time setup: open `setup.html`, save `config.json` next to the agent, then start.

### 2. Service Installer (always-on, boot start)

Native OS services — preferred for managed fleets. Run elevated / as root.

| OS | Entry point | What it installs |
|----|-------------|------------------|
| **Windows** | `install-service.bat` (Admin) → `packaging/windows/install-windows-service.ps1` | Real Windows Service (`QSDiscoveryAgent`) via **NSSM** or `sc.exe` + Node; Automatic start; failure recovery restart. Full setup: `packaging/windows/QS-Agent-Setup.ps1` (copies to Program Files, portable Node if needed). |
| **macOS** | `sudo ./install-service.sh` | LaunchDaemon `com.qs.discovery-agent` under `/Library/LaunchDaemons/`; stages to `/Library/Application Support/QS-Discovery-Agent` |
| **Linux** | `sudo ./install-service.sh` | systemd unit `qs-discovery-agent.service`; stages to `/opt/qs-discovery-agent` |

**Build installers / packages** (optional; needs host OS tools only):

```bash
# Windows (PowerShell, Admin) — stage + service, or MSI if WiX is installed
powershell -ExecutionPolicy Bypass -File packaging\windows\QS-Agent-Setup.ps1
powershell -ExecutionPolicy Bypass -File packaging\windows\build-msi.ps1

# macOS — .pkg via pkgbuild (Xcode CLT)
./packaging/macos/build-pkg.sh

# Linux — .deb (dpkg-deb) or RPM stub
./packaging/linux/build-deb.sh
./packaging/linux/build-rpm.sh   # stages rpmbuild tree; rpmbuild optional
```

### 3. ZIP install (manual copy)

1. Extract the `agent/` folder (USB, share, or email ZIP).
2. Open `setup.html` → save `config.json` into the extracted folder.
3. Start with the Desktop App path, **or** run the Service Installer from that folder for boot persistence.

```text
agent/
  qs-discovery-agent.js
  setup.html / config.json
  run-agent.bat | run-agent.sh | Start Agent.bat
  install-service.bat | install-service.sh
  QS-Discovery-Agent.app/          (macOS desktop)
  packaging/
    windows/   install-windows-service.ps1, QS-Agent-Setup.ps1, build-msi.ps1
    macos/     com.qs.discovery-agent.plist, build-pkg.sh
    linux/     qs-discovery-agent.service, build-deb.sh, build-rpm.sh
```

> **Canonical source:** monorepo-root `agent/` only (not `apps/api/agent`).

## Quick Start (CLI)

### On the Admin Server
1. Deploy QS Asset (see main `deploy.sh`)
2. Create staff user accounts via Dashboard → Users
3. Share the `agent/` folder with staff (USB, network share, email, etc.)

### On Staff Machines

**Windows:**
```cmd
run-agent.bat 192.168.1.50 staff@acme.com Staff@123
```

**Mac/Linux:**
```bash
./run-agent.sh 192.168.1.50 staff@acme.com Staff@123
```

**Direct Node.js:**
```bash
node qs-discovery-agent.js --server http://192.168.1.50:4100 --user staff@acme.com --pass Staff@123
```

### Environment Variables (alternative)
```bash
export QS_AGENT_SERVER=http://192.168.1.50:4100
export QS_AGENT_USER=staff@acme.com
export QS_AGENT_PASS=Staff@123
export QS_AGENT_INTERVAL=60  # seconds between heartbeats
node qs-discovery-agent.js
```

## How It Works

```
┌─────────────────────────────────────────────┐
│            Staff Laptop (Agent)              │
│                                              │
│  qs-discovery-agent.js                       │
│  ├── Collects CPU, RAM, Disk, OS, Network   │
│  ├── Authenticates with server (JWT)         │
│  ├── Registers as agent                      │
│  └── Sends heartbeat every 60s              │
│           │                                  │
└───────────┼──────────────────────────────────┘
            │ HTTP POST (every 60s)
            ▼
┌─────────────────────────────────────────────┐
│         Admin Server (QS Asset)              │
│                                              │
│  /api/v1/discovery/agents/register          │
│  /api/v1/discovery/agents/:id/heartbeat     │
│           │                                  │
│  Dashboard → Discovery → Agents tab         │
│  Shows all connected machines in real-time  │
└─────────────────────────────────────────────┘
```

## Viewing Agent Data

On the admin dashboard:
1. Go to **Discovery** page
2. Click the **Agents** tab
3. See all registered agents with:
   - Hostname, IP, platform
   - Last heartbeat timestamp
   - Full system info (click to expand)
   - Online/Offline/Stale status

## Running as a Background Service (detail)

### Windows (real service)

```powershell
# From an elevated PowerShell, after extracting agent/ or from Program Files:
powershell -ExecutionPolicy Bypass -File packaging\windows\QS-Agent-Setup.ps1

# Or service-only if files are already in place:
powershell -ExecutionPolicy Bypass -File packaging\windows\install-windows-service.ps1 -InstallDir "C:\Program Files\QS-Discovery-Agent"

# Uninstall:
powershell -ExecutionPolicy Bypass -File packaging\windows\install-windows-service.ps1 -Uninstall
```

`install-service.bat` (Admin) calls the PowerShell installer for a boot-level service. If that fails, it falls back to a Task Scheduler logon task.

Optional: place `nssm.exe` on PATH (or next to the PS1) for the most reliable Node hosting.

### macOS (LaunchDaemon)

```bash
sudo ./install-service.sh
# or install the built package:
./packaging/macos/build-pkg.sh
sudo installer -pkg packaging/macos/dist/QS-Discovery-Agent-2.0.0.pkg -target /
```

Label: `com.qs.discovery-agent` → `/Library/LaunchDaemons/com.qs.discovery-agent.plist`  
Payload: `/Library/Application Support/QS-Discovery-Agent`  
Logs: `/Library/Logs/QS-Discovery-Agent/`

### Linux (systemd)

```bash
sudo ./install-service.sh
# or:
./packaging/linux/build-deb.sh
sudo dpkg -i packaging/linux/dist/qs-discovery-agent_2.0.0_amd64.deb
```

Unit: `qs-discovery-agent.service`  
Payload: `/opt/qs-discovery-agent`  
Logs: `/var/log/qs-discovery-agent/`
