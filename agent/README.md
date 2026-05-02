# ReconAPM Agent

A **zero-dependency** lightweight agent that runs on staff laptops/desktops and reports system information back to the main ReconAPM server.

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

- **Node.js 18+** (no other dependencies needed)
- Network access to the ReconAPM server

## Quick Start

### On the Admin Server
1. Deploy ReconAPM (see main `deploy.sh`)
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
node reconapm-agent.js --server http://192.168.1.50:4100 --user staff@acme.com --pass Staff@123
```

### Environment Variables (alternative)
```bash
export RECONAPM_SERVER=http://192.168.1.50:4100
export RECONAPM_USER=staff@acme.com
export RECONAPM_PASS=Staff@123
export RECONAPM_INTERVAL=60  # seconds between heartbeats
node reconapm-agent.js
```

## How It Works

```
┌─────────────────────────────────────────────┐
│            Staff Laptop (Agent)              │
│                                              │
│  reconapm-agent.js                           │
│  ├── Collects CPU, RAM, Disk, OS, Network   │
│  ├── Authenticates with server (JWT)         │
│  ├── Registers as agent                      │
│  └── Sends heartbeat every 60s              │
│           │                                  │
└───────────┼──────────────────────────────────┘
            │ HTTP POST (every 60s)
            ▼
┌─────────────────────────────────────────────┐
│         Admin Server (ReconAPM)              │
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

## Running as a Background Service

### macOS (launchd)
```bash
# Create a plist file
cat > ~/Library/LaunchAgents/com.reconapm.agent.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.reconapm.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/reconapm-agent.js</string>
    <string>--server</string><string>http://192.168.1.50:4100</string>
    <string>--user</string><string>staff@acme.com</string>
    <string>--pass</string><string>Staff@123</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
EOF
launchctl load ~/Library/LaunchAgents/com.reconapm.agent.plist
```

### Linux (systemd)
```bash
sudo cat > /etc/systemd/system/reconapm-agent.service << EOF
[Unit]
Description=ReconAPM Agent
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/reconapm/reconapm-agent.js --server http://192.168.1.50:4100 --user staff@acme.com --pass Staff@123
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable reconapm-agent
sudo systemctl start reconapm-agent
```

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task → "ReconAPM Agent"
3. Trigger: At logon
4. Action: Start a program
   - Program: `node.exe`
   - Arguments: `C:\path\to\reconapm-agent.js --server http://192.168.1.50:4100 --user staff@acme.com --pass Staff@123`
5. Check "Run whether user is logged on or not"
