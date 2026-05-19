"use client";
import React, { useState } from "react";
import {
  BookOpen, Search, ChevronRight, ChevronDown, Package, Ticket, Radar,
  Shield, Network, Truck, Camera, MonitorPlay, Key, Wrench, BarChart3,
  Zap, Users, Settings, FileText, Monitor, Building2, Server, ShoppingCart,
  GitBranch, AlertOctagon, Scan, Headphones, HelpCircle, ExternalLink,
  Lightbulb, Terminal, Download
} from "lucide-react";

const SECTIONS = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <Lightbulb size={18} />,
    articles: [
      {
        id: "first-login",
        title: "First Login & Setup",
        content: `## Welcome to QS Asset

After deploying QS Asset, you'll start at the **Setup** page (\`/setup\`) or the **Login** page.

### Initial Setup (New Installation)
1. Navigate to \`http://YOUR_SERVER:3100/setup\`
2. Fill in your organization name
3. Create your admin account (email + password)
4. This creates your **tenant** and admin user

### Logging In
1. Go to \`http://YOUR_SERVER:3100/login\`
2. Enter your email and password
3. You'll be redirected to the **Dashboard**

### First Things to Do
1. **Add Users** — Go to Users and invite your team members
2. **Run a Discovery Scan** — Go to Discovery → New Scan → enter your subnet (e.g., \`192.168.1.0/24\`)
3. **Deploy Agents** — Share the agent script with staff to auto-collect asset info
4. **Create Asset Types** — Go to Settings → Asset Types to customize your categories`
      },
      {
        id: "navigation",
        title: "Navigating the Dashboard",
        content: `## Dashboard Navigation

The QS Asset dashboard is organized into 5 sections:

### Overview
- **Dashboard** — Real-time summary of all assets, tickets, and alerts
- **My Portal** — Your personal view with assigned tickets and tasks

### Asset Management
- **All Assets** — Complete asset register with search, filter, and export
- **IT Assets** — Computers, servers, network equipment
- **Non-IT Assets** — Furniture, vehicles, facility equipment
- **CMDB** — Configuration Management Database with relationship mapping

### Operations
- **Tickets** — IT helpdesk ticket management (create, assign, resolve)
- **Work Orders** — Maintenance, repair, and installation tasks
- **Discovery** — Network scanning to find new devices on your LAN
- **Patch Management** — Track and deploy security patches
- **Network (NMS)** — Monitor switches, routers, firewalls
- **Security Scan** — Run Nmap, SNMP, SSL, ARP scans
- **Procurement** — Purchase orders and vendor management
- **Changes / Problems** — ITIL change and problem management

### Monitoring
- **Fleet / GPS** — Vehicle tracking with map visualization
- **CCTV** — Camera surveillance monitoring
- **VDI** — Virtual Desktop Infrastructure management

### Management
- **Automation** — Rules engine for auto-actions
- **Licenses** — Software license compliance tracking
- **Reports** — Analytics dashboards and exportable reports
- **Users** — User management and role assignment
- **Settings** — System configuration`
      },
      {
        id: "roles",
        title: "User Roles & Permissions",
        content: `## User Roles

QS Asset supports role-based access control (RBAC):

| Role | Permissions |
|------|------------|
| **Tenant Admin** | Full access to all features, user management, settings |
| **IT Admin** | Access to all IT operations: scanning, monitoring, patches |
| **Manager** | View dashboards, reports, approve changes and procurements |
| **Technician** | Work on assigned tickets, work orders, and patches |
| **User** | Submit tickets via self-service portal, view own assets |

### Creating Users
1. Go to **Users** in the sidebar
2. Click **Add User**
3. Enter email, name, and select a role
4. The user receives their credentials

### Self-Service Portal
Regular users access the portal at \`/portal\` where they can:
- Submit new tickets
- Track existing tickets
- View assets assigned to them`
      }
    ]
  },
  {
    id: "asset-management",
    title: "Asset Management",
    icon: <Package size={18} />,
    articles: [
      {
        id: "adding-assets",
        title: "Adding & Managing Assets",
        content: `## Asset Management

### Adding Assets Manually
1. Go to **All Assets** → click **Add Asset**
2. Fill in: Name, Asset Type, Serial Number, Location
3. Optional: IP address, MAC, GPS coordinates, purchase info
4. Click **Save**

### Auto-Discovery (Recommended)
Instead of manually adding assets, let QS Asset discover them:
1. Go to **Discovery** → **New Scan**
2. Enter your subnet (e.g., \`192.168.1.0/24\`)
3. Select scan type (Ping Sweep, TCP Port Scan, or Full Scan)
4. Review discovered devices → click **Approve** to create assets

### Asset Lifecycle
Assets follow this lifecycle:
- **Active** → currently in use
- **In Maintenance** → under repair or servicing
- **Retired** → decommissioned
- **Disposed** → physically removed

### Bulk Import
Upload a CSV file with columns: Name, Type, Serial, IP Address, Location

### Asset Details
Click any asset to view:
- Hardware specs (CPU, RAM, Disk)
- Software inventory
- Ticket history
- Change history
- Network info
- Assigned user`
      },
      {
        id: "cmdb",
        title: "CMDB & Relationships",
        content: `## Configuration Management Database

The CMDB maps relationships between assets:

### Relationship Types
- **Depends On** — Asset A requires Asset B to function
- **Connected To** — Network or physical connection
- **Installed On** — Software on hardware
- **Backed Up By** — Backup/redundancy relationship

### Adding Relationships
1. Open an asset's detail page
2. Click **Relationships** tab
3. Click **Add Relationship**
4. Select the target asset and relationship type

### Impact Analysis
When an asset goes down, the CMDB shows:
- Which other assets are affected
- The blast radius of an outage
- Recommended remediation steps`
      }
    ]
  },
  {
    id: "discovery-scanning",
    title: "Discovery & Scanning",
    icon: <Radar size={18} />,
    articles: [
      {
        id: "network-discovery",
        title: "Network Discovery",
        content: `## Network Discovery

QS Asset can automatically discover all devices on your network.

### Scan Types
| Type | Speed | Details |
|------|-------|---------|
| **Ping Sweep** | Fast (~30s) | Finds alive hosts via ICMP ping |
| **TCP Port Scan** | Medium (~2min) | Identifies open ports and services |
| **SNMP Discovery** | Medium | Queries SNMP-enabled network devices |
| **Full Scan** | Slow (~5min) | Combines all methods for maximum coverage |

### Running a Scan
1. Go to **Discovery** → click **New Scan**
2. Enter the subnet to scan (e.g., \`192.168.1.0/24\`)
3. **Tip:** Click "Detect Subnets" to auto-detect your server's network
4. Select the scan type
5. Click **Start Scan**

### Reviewing Results
After a scan completes:
- **New devices** appear with status "Pending Review"
- Click **Approve** to add them as managed assets
- Click **Ignore** to skip them
- Click **Enrich** to collect detailed hardware/software info

### Scheduled Scans
Set up recurring scans:
1. Go to Discovery → **Schedules** tab
2. Click **New Schedule**
3. Set the cron expression (e.g., every day at 2 AM)
4. New devices are automatically flagged for review`
      },
      {
        id: "security-scanning",
        title: "Security Scanning",
        content: `## Security Scanning

The Security Scan page provides deep inspection using real tools:

### Available Scanners
| Scanner | What It Does |
|---------|-------------|
| **Nmap** | Port scanning, OS detection, service fingerprinting |
| **ARP Scanner** | Layer 2 MAC address discovery |
| **SNMP Scanner** | Query network device configs via SNMP |
| **SSL/TLS** | Certificate validation, expiry checks, cipher analysis |
| **Traceroute** | Network path and hop analysis |
| **SSH Banner** | SSH version detection and key fingerprinting |

### Running a Security Scan
1. Go to **Security Scan** from the sidebar
2. The system auto-detects available scanners
3. Select a scanner type
4. Enter the target IP or subnet
5. Click **Run Scan**
6. Results show open ports, vulnerabilities, and recommendations

### Prerequisites
- **Nmap** must be installed on the server for Nmap scans
- Other scanners use Node.js built-in modules (no extra install needed)`
      },
      {
        id: "agents",
        title: "QS Asset Agents",
        content: `## QS Asset Agent

The agent is a lightweight script that runs on staff machines and reports system info.

### What Agents Collect
- CPU model, cores, usage
- RAM total/used/free
- Disk drives and usage
- OS version, hostname, uptime
- Network interfaces with IPs
- Installed software list
- Firewall & encryption status
- Running processes

### Deploying Agents
1. Share the \`agent/\` folder from the QS Asset installation
2. Staff run the appropriate script:

**Windows:**
\`\`\`cmd
run-agent.bat SERVER_IP email password
\`\`\`

**Mac/Linux:**
\`\`\`bash
./run-agent.sh SERVER_IP email password
\`\`\`

3. The agent authenticates, registers, and sends heartbeats every 60s

### Viewing Agents
Go to **Discovery** → look for the agent entries showing:
- Hostname, IP, platform
- Last heartbeat timestamp
- Online/Offline status
- Full system info (expand to view)`
      }
    ]
  },
  {
    id: "tickets-workorders",
    title: "Tickets & Work Orders",
    icon: <Ticket size={18} />,
    articles: [
      {
        id: "ticket-management",
        title: "Ticket Management",
        content: `## Ticket Management

### Creating a Ticket
1. Go to **Tickets** → click **Create Ticket**
2. Fill in: Subject, Description, Priority, Category
3. Optionally assign to a technician
4. Click **Submit**

### Ticket Lifecycle
\`OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED\`

### Priority Levels
| Priority | Response Time | Resolution Time |
|----------|--------------|-----------------|
| **Critical** | 15 minutes | 4 hours |
| **High** | 1 hour | 8 hours |
| **Medium** | 4 hours | 24 hours |
| **Low** | 24 hours | 72 hours |

### SLA Tracking
QS Asset automatically tracks SLA compliance:
- **Response SLA** — time until first response
- **Resolution SLA** — time until resolved
- Red indicators show SLA breaches

### Self-Service Portal
End users can submit tickets at \`/portal/tickets/new\` without needing full dashboard access.`
      },
      {
        id: "work-orders",
        title: "Work Orders",
        content: `## Work Orders

Work orders are for physical tasks like maintenance, repairs, and installations.

### Creating a Work Order
1. Go to **Work Orders** → click **Create Work Order**
2. Enter: Title, Description, Type, Priority
3. Types: Maintenance, Repair, Installation, Inspection

### Work Order Flow
\`CREATED → ASSIGNED → IN_PROGRESS → COMPLETED → VERIFIED\`

### Tracking Costs
Each work order can track:
- **Labor hours** — time spent
- **Material cost** — parts and supplies
- **Scheduled dates** — planned start/end
- **Actual dates** — when work was done

### Linking to Assets
Work orders can be linked to specific assets so you have a complete maintenance history.`
      }
    ]
  },
  {
    id: "monitoring",
    title: "Monitoring & NMS",
    icon: <Network size={18} />,
    articles: [
      {
        id: "network-monitoring",
        title: "Network Monitoring (NMS)",
        content: `## Network Monitoring

QS Asset provides real-time monitoring of your network infrastructure.

### Adding Devices
1. Go to **Network (NMS)**
2. Click **Add Device** or use **Auto-Discover from Assets**
3. Enter: Name, IP address, device type

### Health Checks
Every 5 minutes, QS Asset automatically:
- Pings all monitored devices
- Checks for open ports
- Updates Online/Offline/Warning status
- Sends alerts when devices go down

### Topology Map
The topology view shows:
- Visual layout of all network devices
- Color-coded status (green = online, red = offline)
- Connection links between devices on the same subnet
- Latency-based utilization metrics

### Deep Scanning
Click **Deep Scan** on any device for:
- Nmap port enumeration
- OS fingerprinting
- Service version detection
- Interface details`
      },
      {
        id: "fleet-gps",
        title: "Fleet & GPS Tracking",
        content: `## Fleet & GPS Tracking

Track vehicles and mobile assets on a live map.

### Setup
1. Add assets with GPS coordinates (latitude/longitude fields)
2. They appear automatically in Fleet → Map view

### Features
- **Live Map** — See all vehicles with current positions
- **Trip History** — View past trips with route replay
- **Geofencing** — Set geographic boundaries and get alerts
- **Status Tracking** — Active, In Maintenance, or Offline

### Map Controls
- Zoom in/out to see clusters or individual vehicles
- Click a vehicle marker for quick details
- Click "Details" for full trip history`
      }
    ]
  },
  {
    id: "reports-automation",
    title: "Reports & Automation",
    icon: <BarChart3 size={18} />,
    articles: [
      {
        id: "reports",
        title: "Reports & Analytics",
        content: `## Reports & Analytics

### Live Dashboards
The Reports page shows real-time analytics:
- **Asset Lifecycle** — assets created per month (from live data)
- **Assets by Category** — pie chart of asset types
- **Ticket Volume** — opened vs resolved trend

### Report Templates
Export pre-built reports:
| Report | Format | Schedule |
|--------|--------|----------|
| Asset Inventory | PDF | Weekly |
| Patch Compliance | XLSX | Monthly |
| Ticket SLA | PDF | On-demand |
| License Utilization | PDF | Quarterly |
| Fleet Telemetry | PDF | On-demand |
| Audit Trail | CSV | On-demand |

### Executive Dashboard
The executive summary at the top shows:
- Total assets and their value
- Open ticket count
- Average resolution time`
      },
      {
        id: "automation",
        title: "Automation Rules",
        content: `## Automation Rules Engine

Create rules that automatically perform actions based on triggers.

### Creating a Rule
1. Go to **Automation**
2. Click **Create Rule**
3. Configure:
   - **Trigger** — What event starts the rule (e.g., "asset created", "ticket opened")
   - **Conditions** — Optional filters (e.g., "priority = Critical")
   - **Action** — What happens (e.g., "send notification", "assign to team")

### Example Rules
- **Auto-assign critical tickets** to the on-call technician
- **Send email** when a license is about to expire
- **Create a ticket** when a monitored device goes offline
- **Notify admin** when a new device is discovered on the network`
      }
    ]
  },
  {
    id: "deployment",
    title: "Deployment Guide",
    icon: <Terminal size={18} />,
    articles: [
      {
        id: "docker-deploy",
        title: "Docker Deployment",
        content: `## Docker Deployment

### Prerequisites
- Docker & Docker Compose installed
- Server connected to the LAN you want to monitor

### One-Command Deploy
\`\`\`bash
./deploy.sh --seed
\`\`\`

This automatically:
1. Detects your server's LAN IP
2. Builds 3 containers (Database, API, Web)
3. Seeds demo data
4. Prints access URLs

### Manual Deploy
\`\`\`bash
# Set your server's LAN IP
export SERVER_IP=192.168.1.50

# First time (with demo data):
SEED_DB=true docker compose -f docker-compose.prod.yml up -d --build

# Subsequent times:
docker compose -f docker-compose.prod.yml up -d --build
\`\`\`

### Ports Used
| Service | Port | Purpose |
|---------|------|---------|
| Web UI | 3100 | Dashboard |
| API | 4100 | Backend (host network) |
| Database | 5434 | PostgreSQL |

### Managing
\`\`\`bash
# View logs
docker compose -f docker-compose.prod.yml logs -f api

# Stop
docker compose -f docker-compose.prod.yml down

# Stop and wipe database
docker compose -f docker-compose.prod.yml down -v
\`\`\``
      },
      {
        id: "agent-deploy",
        title: "Deploying Agents to Staff",
        content: `## Deploying Agents to Staff Machines

### Overview
The QS Asset Agent is a lightweight Node.js script that staff run on their laptops. It reports hardware, software, and security info back to the server.

### Requirements
- **Node.js 18+** on the staff machine
- Network access to the QS Asset server

### Setup Steps
1. Copy the \`agent/\` folder to each staff machine
2. Run the appropriate launcher:

**Windows:** \`run-agent.bat SERVER_IP email password\`
**Mac/Linux:** \`./run-agent.sh SERVER_IP email password\`

### Running as a Background Service

**macOS:** Use \`launchd\` — see agent/README.md
**Linux:** Use \`systemd\` — see agent/README.md
**Windows:** Use Task Scheduler — see agent/README.md

### What Gets Collected
CPU, RAM, disk, OS, network interfaces, installed software, firewall status, running processes — all sent every 60 seconds.`
      }
    ]
  }
];

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [expandedSection, setExpandedSection] = useState("getting-started");
  const [activeArticle, setActiveArticle] = useState("first-login");

  const filteredSections = search
    ? SECTIONS.map(s => ({
        ...s,
        articles: s.articles.filter(a =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.content.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(s => s.articles.length > 0)
    : SECTIONS;

  const currentArticle = SECTIONS.flatMap(s => s.articles).find(a => a.id === activeArticle);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Help & Documentation</h1>
          <p className="page-subtitle">Guides, walkthroughs, and feature reference</p>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 16, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={16} style={{ color: "var(--text-tertiary)" }} />
        <input
          placeholder="Search documentation..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit",
          }}
        />
        {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 11 }}>Clear</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, minHeight: "70vh" }}>
        {/* Sidebar */}
        <div className="card" style={{ padding: "12px 0", alignSelf: "start", position: "sticky", top: 80 }}>
          {filteredSections.map(section => (
            <div key={section.id}>
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? "" : section.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", background: "transparent", border: "none",
                  color: expandedSection === section.id ? "var(--brand-400)" : "var(--text-primary)",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                  textAlign: "left",
                }}
              >
                {section.icon}
                <span style={{ flex: 1 }}>{section.title}</span>
                {expandedSection === section.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {expandedSection === section.id && (
                <div style={{ paddingLeft: 16 }}>
                  {section.articles.map(article => (
                    <button
                      key={article.id}
                      onClick={() => setActiveArticle(article.id)}
                      style={{
                        width: "100%", display: "block", padding: "6px 16px",
                        background: activeArticle === article.id ? "rgba(6,182,212,0.08)" : "transparent",
                        border: "none", borderLeft: activeArticle === article.id ? "2px solid var(--brand-400)" : "2px solid transparent",
                        color: activeArticle === article.id ? "var(--brand-400)" : "var(--text-secondary)",
                        cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                        textAlign: "left",
                      }}
                    >
                      {article.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="card" style={{ padding: "24px 32px" }}>
          {currentArticle ? (
            <div className="help-content">
              <MarkdownRenderer content={currentArticle.content} />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
              <HelpCircle size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Select a topic</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Choose from the menu on the left</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .help-content h2 { font-size: 20px; font-weight: 700; margin: 0 0 16px; color: var(--text-primary); }
        .help-content h3 { font-size: 15px; font-weight: 700; margin: 24px 0 8px; color: var(--text-primary); }
        .help-content p { font-size: 13px; line-height: 1.7; color: var(--text-secondary); margin: 0 0 12px; }
        .help-content ul, .help-content ol { font-size: 13px; color: var(--text-secondary); padding-left: 20px; margin: 0 0 12px; line-height: 1.7; }
        .help-content li { margin-bottom: 4px; }
        .help-content strong { color: var(--text-primary); }
        .help-content code { background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; font-size: 12px; color: var(--brand-400); }
        .help-content pre { background: var(--bg-elevated); padding: 14px 18px; border-radius: 8px; overflow-x: auto; margin: 0 0 16px; }
        .help-content pre code { background: none; padding: 0; color: var(--text-primary); font-size: 12px; }
        .help-content table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 0 0 16px; }
        .help-content th { text-align: left; padding: 8px 12px; background: var(--bg-elevated); color: var(--text-primary); font-weight: 600; border-bottom: 1px solid var(--border-primary); }
        .help-content td { padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); }
        @media (max-width: 768px) {
          .help-content h2 { font-size: 17px; }
          .help-content pre { padding: 10px 12px; }
        }
      `}</style>
    </>
  );
}

// Simple markdown renderer
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.JSX.Element[] = [];
  let inCodeBlock = false;
  let codeContent = "";
  let inTable = false;
  let tableRows: string[][] = [];
  let listItems: string[] = [];
  let listType = "";

  function flushList() {
    if (listItems.length === 0) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    elements.push(<Tag key={elements.length}>{listItems.map((li, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(li) }} />)}</Tag>);
    listItems = [];
    listType = "";
  }

  function flushTable() {
    if (tableRows.length === 0) return;
    const header = tableRows[0];
    const body = tableRows.slice(1);
    elements.push(
      <table key={elements.length}>
        <thead><tr>{header.map((h, i) => <th key={i}>{h.trim()}</th>)}</tr></thead>
        <tbody>{body.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />)}</tr>)}</tbody>
      </table>
    );
    tableRows = [];
    inTable = false;
  }

  function inlineFormat(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:var(--brand-400)">$1</a>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(<pre key={elements.length}><code>{codeContent}</code></pre>);
        codeContent = "";
        inCodeBlock = false;
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeContent += (codeContent ? "\n" : "") + line; continue; }

    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) { flushList(); inTable = true; }
      const cells = line.split("|").slice(1, -1);
      if (cells.every(c => /^[\s-:]+$/.test(c))) continue; // separator row
      tableRows.push(cells);
      continue;
    } else if (inTable) { flushTable(); }

    if (/^- /.test(line)) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(line.replace(/^- /, ""));
      continue;
    } else if (/^\d+\. /.test(line)) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(line.replace(/^\d+\. /, ""));
      continue;
    } else { flushList(); }

    if (line.startsWith("## ")) {
      elements.push(<h2 key={elements.length}>{line.replace("## ", "")}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={elements.length}>{line.replace("### ", "")}</h3>);
    } else if (line.trim() === "") {
      continue;
    } else {
      elements.push(<p key={elements.length} dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />);
    }
  }
  flushList();
  flushTable();

  return <>{elements}</>;
}
