 # AssetCommand — Enterprise Gap Analysis & Architecture

## Final Platform Metrics

| Metric | Initial | Phase 1-2 | Phase 3 | Phase 4 (Current) | Total Change |
|--------|---------|-----------|---------|-------------------|-------------|
| **API Routes** | 92 | 122 | 171 | **220** | +128 |
| **Prisma Models** | 29 | 39 | 40 | **49** | +20 |
| **Frontend Pages** | 16 | 22 | 26 | **29** | +13 |
| **Scan Types** | 1 (ping) | 4 | 10 | 10 | +9 |
| **Scanner Engines** | 0 | 0 | 6 | 6 | +6 |
| **Automation Rules** | 6 | 12 | 12 | 12 (+ cooldown/dedup/chains) | +6 |
| **Vendors/Procurement** | ❌ | ❌ | ❌ | **Full PO lifecycle** | New |
| **Contract Management** | ❌ | ❌ | ❌ | **CRUD + expiry alerts** | New |
| **Change Management** | ❌ | ❌ | ❌ | **Full ITIL lifecycle** | New |
| **Problem Management** | ❌ | ❌ | ❌ | **ITIL + Known Errors** | New |
| **Check-in/Check-out** | ❌ | ❌ | ❌ | **Full checkout flow** | New |
| **QR/Barcode** | ❌ | ❌ | ❌ | **Generate + lookup** | New |
| **Attestation** | ❌ | ❌ | ❌ | **Campaign + respond** | New |
| **Notification Channels** | ❌ | ❌ | ❌ | **Slack/Teams/Webhook** | New |
| **License Metering** | ❌ | ❌ | ❌ | **@Cron(6h) auto-meter** | New |
| **Bulk Operations** | ❌ | ❌ | ❌ | **Update + Retire** | New |
| **Warranty/Lease Alerts** | ❌ | ❌ | ❌ | **@Cron expiry check** | New |
| **Security Scanning** | ❌ | ❌ | Full multi-tool engine | Full multi-tool engine | New |
| **Patch Scanning** | ❌ | ❌ | Real OS-level scanning | Real OS-level scanning | New |
| **Network Probing** | ❌ | ❌ | ICMP + TCP + nmap | ICMP + TCP + nmap | New |

---

## Phase 3: Security Hardening (All Resolved ✅)

### Round 1: Active Scanning Engines

| # | Gap | Resolution | Status |
|---|-----|------------|--------|
| 1 | Patches: CRUD-only, no real scanning | Real OS-level: `softwareupdate`, `brew outdated`, `apt`, `yum`, PowerShell; `@Cron(6h)` | ✅ |
| 2 | No per-asset patch tracking | `PatchDeployment` model with per-asset status, `Deploy All Pending` bulk action | ✅ |
| 3 | Network: mock device status | Live ICMP `ping` + `net.Socket` TCP probes; `@Cron(5min)` health checks | ✅ |
| 4 | No network auto-discovery | `POST /monitoring/network/auto-discover` from existing asset inventory | ✅ |
| 5 | No compliance trend data | Real weekly compliance history from DB timestamps `GET /patches/compliance/history` | ✅ |

### Round 2: Enterprise Security Scanning Framework

| # | Gap | Resolution | Status |
|---|-----|------------|--------|
| 6 | No deep port scanning | **Nmap 7.99** integration — quick/standard/deep modes, OS fingerprinting, NSE scripts | ✅ |
| 7 | No SNMP device interrogation | **SNMP Walker** — sysDescr, interfaces, ARP table, device classification | ✅ |
| 8 | No agent-based endpoint audit | **SSH Scanner** — OS, disk, memory, CPU, patches, services, ports, logins, firewall | ✅ |
| 9 | No Layer 2 discovery | **ARP Scanner** — MAC→vendor OUI lookup, rogue device detection | ✅ |
| 10 | No network path analysis | **Traceroute Scanner** — hop-by-hop latency, routing anomaly detection | ✅ |
| 11 | No certificate auditing | **SSL/TLS Auditor** — cipher audit, chain depth, A+ to F grading (zero deps) | ✅ |
| 12 | No unified scan orchestration | **ScanEngine** — auto-detects tools, concurrency control (max 3), unified results | ✅ |
| 13 | No scan history/audit trail | **ScanResult** model — every scan persisted with type, target, results, triggered_by | ✅ |
| 14 | No scanning dashboard | **Security Scan** page — capabilities grid, run any scan, history table, detail panel | ✅ |

---

## Phase 1-2 Gap Analysis (22 Gaps → All Resolved ✅)

### Phase 1: Core Enterprise Features

| # | Gap | Resolution | Status |
|---|-----|------------|--------|
| 1 | Discovery: ping sweep only | Added TCP port scan, SNMP probe, FULL_SCAN mode, MAC OUI classification | ✅ |
| 2 | No scan scheduling | Cron-based scheduler (`@Cron(EVERY_MINUTE)`) + scan windows + 3 seed schedules | ✅ |
| 3 | No Credential Vault | AES-256 encrypted vault (`ScanCredential` model), CRUD API, 3 seed credentials | ✅ |
| 4 | No Agent management | `Agent` model + register/heartbeat/status endpoints, stale agent detection | ✅ |
| 5 | Automation rules never execute | EventBus service + `evaluateRules()` on every domain event, 5 action types | ✅ |
| 6 | CCTV: no stream/events | `/cameras/:id/stream` + `/cameras/:id/events` endpoints | ✅ |
| 7 | VDI: no pools/sessions | `/vdi/pools` + `/vdi/sessions` + `/vdi/metrics` endpoints | ✅ |
| 8 | Network: no topology | `/network/topology` + `/devices/:id/interfaces` + `/network/traps` | ✅ |
| 9 | No Knowledge Base | Full CRUD module with search, categories, view counts, helpful votes | ✅ |
| 10 | No Docker Compose | `docker-compose.prod.yml` + Dockerfiles + backup/restore scripts | ✅ |

### Phase 2: Enterprise Readiness

| # | Gap | Resolution | Status |
|---|-----|------------|--------|
| 1 | No WMI/SSH enrichment | `enrichmentData` JSON + `POST /discovery/devices/:id/enrich` with 30+ categories | ✅ |
| 2 | No SLA engine | `SlaPolicy` model; auto due dates; `@Cron(1min)` compliance checker | ✅ |
| 3 | No cooldown/dedup | `cooldownMinutes`, `dedupKey`, `chainedRuleId` with atomic execution | ✅ |
| 4 | No first-boot wizard | `GET /setup/status` + `POST /setup/initialize` with full seeding | ✅ |
| 5 | No employee self-service | `GET /users/me/assets`, `/me/tickets`, `/me/dashboard` + My Portal UI | ✅ |
| 6 | No CSV import | Multi-step import wizard: Upload → Map → Validate → Import | ✅ |
| 7 | No scheduled reports | `ScheduledReport` model with cron, format, recipients | ✅ |
| 8 | No work orders | Full lifecycle: CREATED → ASSIGNED → IN_PROGRESS → COMPLETED → VERIFIED | ✅ |
| 9 | No script execution | `ScriptLibrary` with approval gate (PENDING → APPROVED → REJECTED) | ✅ |
| 10 | No config backup | `NetworkConfig` with SHA256 hash, versioning, drift detection | ✅ |
| 11 | No depreciation calc | Straight-line + declining balance on Asset model | ✅ |
| 12 | No live GPS/trips | Trip history + waypoints + live position/telemetry | ✅ |

---

## Complete API Routes: 171 Endpoints

### Scanning (5 routes) — NEW
```
GET    /scanning/capabilities                     — List available tools + status
POST   /scanning/run                              — Run any scan (NMAP/SNMP/SSH/ARP/TRACEROUTE/SSL)
GET    /scanning/results                          — Scan history
GET    /scanning/results/:id                      — Detailed scan result
POST   /scanning/subnet-audit                     — Combined ARP + Nmap audit
```

### Monitoring (26 routes, +8 new)
```
GET    /monitoring/network                        — Network dashboard
GET    /monitoring/network/topology               — Topology data
GET    /monitoring/network/devices                — Monitored devices
GET    /monitoring/network/devices/:id            — Device detail
GET    /monitoring/network/devices/:id/interfaces — Device interfaces
POST   /monitoring/network/devices/:id/probe      — Real ICMP+TCP probe
POST   /monitoring/network/scan                   — Bulk network scan (ping all)
POST   /monitoring/network/auto-discover          — Create devices from assets
GET    /monitoring/nmap/status                    — Check if nmap is installed
POST   /monitoring/nmap/scan                      — Deep nmap scan (subnet)
POST   /monitoring/nmap/devices/:id/scan          — Deep nmap scan (device)
GET    /monitoring/network/traps                  — SNMP traps
GET    /monitoring/network/configs                — Config backups
GET    /monitoring/network/configs/:id/history    — Config history
GET    /monitoring/network/configs/:id/latest     — Latest config
POST   /monitoring/network/configs/:id/backup     — Trigger backup
GET    /monitoring/network/configs/:id/diff       — Drift detection
POST   /monitoring/network/configs/:id/set-baseline — Set compliance baseline
GET    /monitoring/cameras                        — CCTV cameras
GET    /monitoring/cameras/:id/stream             — Camera stream URL
GET    /monitoring/cameras/:id/events             — Camera events
GET    /monitoring/vdi                            — VDI overview
GET    /monitoring/vdi/pools                      — VDI pools
GET    /monitoring/vdi/sessions                   — VDI sessions
GET    /monitoring/vdi/metrics                    — VDI metrics
POST/PATCH/DELETE /monitoring/devices             — CRUD
```

### Patches (10 routes, +4 new)
```
GET    /patches                                   — List patches
POST   /patches                                   — Create patch
PATCH  /patches/:id                               — Update patch
GET    /patches/compliance                        — Compliance stats
GET    /patches/compliance/history                — Real 8-week trend
GET    /patches/missing                           — Missing critical patches
POST   /patches/scan                              — Real OS-level scan
POST   /patches/:id/deploy                        — Deploy single patch
POST   /patches/deploy-all                        — Bulk deploy pending
GET    /patches/:id/deployments                   — Per-asset deployment status
```

### Discovery (20 routes)
```
GET    /discovery/pending                         — List discovered devices
GET    /discovery/subnets                         — Scanned subnets
POST   /discovery/scans                           — Trigger manual scan
GET    /discovery/scans/:id                       — Scan results
POST   /discovery/devices/:id/approve             — Approve → create Asset
POST   /discovery/devices/:id/ignore              — Ignore device
POST   /discovery/devices/:id/enrich              — WMI/SSH enrichment
GET    /discovery/credentials                     — Vault entries
POST   /discovery/credentials                     — Create credential
PATCH  /discovery/credentials/:id                 — Update credential
DELETE /discovery/credentials/:id                 — Revoke credential
GET    /discovery/agents                          — Registered agents
GET    /discovery/agents/:id                      — Agent details
POST   /discovery/agents/register                 — Agent registration
POST   /discovery/agents/:id/heartbeat            — Agent heartbeat
GET    /discovery/schedules                       — Scan schedules
POST   /discovery/schedules                       — Create schedule
PATCH  /discovery/schedules/:id                   — Update schedule
DELETE /discovery/schedules/:id                   — Remove schedule
POST   /discovery/scans/:id/stop                  — Stop running scan
```

### Automation (15 routes)
```
GET    /automation/rules                          — List rules
POST   /automation/rules                          — Create rule
PATCH  /automation/rules/:id                      — Update rule
DELETE /automation/rules/:id                      — Delete rule
GET    /automation/executions                     — Execution history
GET    /automation/scripts                        — List scripts
GET    /automation/scripts/:id                    — Script detail
POST   /automation/scripts                        — Create script
PATCH  /automation/scripts/:id                    — Update (resets approval)
DELETE /automation/scripts/:id                    — Delete script
POST   /automation/scripts/:id/approve            — Approve script
POST   /automation/scripts/:id/reject             — Reject script
POST   /automation/scripts/:id/execute            — Execute on agent
GET    /automation/webhooks                       — Webhook destinations
POST   /automation/webhooks                       — Create webhook
```

---

## Security Scanning Architecture

```
┌──────────────────────────────────────────────────┐
│              ScanEngine (Orchestrator)             │
│  • Auto-detects available tools at startup         │
│  • Routes scan requests to appropriate scanner     │
│  • Queues + rate-limits (max 3 concurrent)         │
│  • Stores results in ScanResult model              │
├──────────────────────────────────────────────────┤
│  Agentless Scanners        │  Agent-Based         │
│  ├── NmapScanner (v7.99)   │  └── SshScanner      │
│  ├── SnmpScanner           │     ├── OS info       │
│  ├── ArpScanner            │     ├── Disk/Memory   │
│  ├── TracerouteScanner     │     ├── Patches       │
│  └── SslScanner            │     ├── Services      │
│     (zero deps)            │     ├── Open ports    │
│                            │     ├── Login history │
│                            │     └── Firewall      │
└──────────────────────────────────────────────────┘
```

---

## Event-Driven Automation Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────────┐
│  Discovery   │────▶│   EventBus   │────▶│  AutomationService │
│  Module      │     │  (in-proc)   │     │  evaluateRules()   │
└─────────────┘     │              │     └─────────┬──────────┘
                    │  Events:     │               │
┌─────────────┐     │  discovery.* │     ┌─────────▼──────────┐
│  Monitoring  │────▶│  asset.*     │     │  Action Executor   │
│  Module      │     │  monitoring.*│     │  ┌─ Notification   │
└─────────────┘     │  ticket.*    │     │  ├─ Create Ticket  │
                    │  patch.*     │     │  ├─ Update Asset   │
┌─────────────┐     │  license.*   │     │  ├─ Send Webhook   │
│  Scanning    │────▶│  scan.*      │     │  ├─ Send Email     │
│  Module      │     │  work_order.*│     │  └─ Run Script     │
└─────────────┘     └──────────────┘     └────────────────────┘
```

---

## SLA Engine

```
Default SLA Policies:
  CRITICAL  →  1h response /  4h resolution
  HIGH      →  4h response /  8h resolution
  MEDIUM    →  8h response / 24h resolution
  LOW       → 24h response / 72h resolution
```

---

## Prisma Models: 40 Total

```
Tenant, User, Role, Department, Site, Asset, AssetType, AssetHistory,
HardwareDetail, OsDetail, SecurityPosture, SoftwareInstallation,
AssetRelationship, Ticket, TicketComment, TicketAsset, WorkOrder,
DiscoveredDevice, ScanJob, ScheduledScan, ScanCredential, DiscoveryAgent,
License, LicenseAssignment, Notification, AutomationRule,
AutomationExecution, SlaPolicy, ScheduledReport, ScriptLibrary,
NetworkConfig, KnowledgeArticle, ServiceCatalogItem, AuditLog,
FleetGeofence, MonitoringDevice, PatchRecord, PatchDeployment,
CameraDevice, ScanResult
```

---

## Frontend Pages: 26 Total

```
Dashboard         — Executive KPI overview
My Portal         — Employee self-service (assets, tickets, stats)
All Assets        — Full asset inventory
IT Assets         — IT-specific assets
Non-IT Assets     — Non-IT assets
Asset Detail      — Single asset drill-down
Asset Import      — CSV import wizard
CMDB              — Configuration management database
Tickets           — Ticket management
Ticket Detail     — Single ticket drill-down
Work Orders       — Work order lifecycle
Discovery         — Network discovery
Patch Mgmt        — OS-level patch management + compliance
Network (NMS)     — Network monitoring + topology
Security Scan     — Multi-tool scanning dashboard     ← NEW
Automation        — Rules engine
Licenses          — License management
CCTV              — Camera monitoring
VDI               — Virtual desktop infrastructure
Fleet / GPS       — Vehicle tracking
Reports           — Analytics + scheduled reports
Knowledge Base    — Self-service articles
Users             — User management
Settings          — Tenant settings
Audit Logs        — System audit trail
Network Configs   — Config backup + drift detection
```

---

## On-Premise Deployment

```bash
# One-command deploy
docker compose -f docker-compose.prod.yml up -d

# First-boot setup wizard (auto-redirects on empty DB)
open http://localhost:3100/setup

# Database backup (auto-keeps last 30)
./scripts/backup.sh

# Database restore
./scripts/restore.sh [backup_file.sql.gz]
```

---

## Credential Vault

All scan credentials are **AES-256 encrypted** at rest:
- Never exposes raw secrets in API list responses
- Tracks last usage timestamps for rotation reminders
- Scopes credentials to specific subnets
- Supports: SSH_PASSWORD, SSH_KEY, SNMP_V2C, SNMP_V3, WMI, WINRM

---

## Device Classification Logic

```
Port 22 open           → Linux/Unix Server
Port 3389 open         → Windows Workstation/Server
Port 631/9100 open     → Printer
Port 161 (SNMP only)   → Network Device (switch/router)
Port 554/8554 open     → Camera
Port 80+443            → Web Server
VMware OUI MAC         → Virtual Machine
Apple OUI MAC          → Apple Device
Cisco OUI/SNMP         → Cisco Router/Switch
Fortinet SNMP          → Firewall
```
