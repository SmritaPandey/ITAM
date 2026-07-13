# QS Assets — Discovery & Scanning

| Field | Value |
|-------|-------|
| **Product** | QS Assets |
| **Last reviewed** | 2026-07-13 |
| **Status** | Living PRD |
| **Depends on** | [01](01-PRODUCT-OVERVIEW.md), [03](03-ARCHITECTURE-AND-TECH-STACK.md) |
| **Analog** | ME AssetExplorer / Endpoint Central · Qualys CSAM · OpManager SNMP |

---

## Overview

Discovery keeps the CMDB current across endpoints, network gear, directory, cloud, cameras, and IoT/OT. All paths converge on `Asset` / `DiscoveredDevice` with `DiscoverySource` and correlation rules that prevent duplicates.

**As-built agent stack (permanent):** Node.js agent — **not** Go. Packaging: Electron tray app, native Windows Service / LaunchDaemon / systemd, MSI/PKG/DEB build scripts.

---

## 1. Agent-based discovery

### Runtime & packaging

| Path | Location / artifact | Status |
|------|---------------------|--------|
| Canonical agent | `agent/qs-discovery-agent.js` (monorepo root `agent/` only) | Shipped |
| Electron desktop tray | `apps/agent-desktop` (online / offline / paused tray icons) | Shipped |
| Windows service | `packaging/windows/` + NSSM/`sc.exe`; `build-msi.ps1` | Shipped |
| macOS | LaunchDaemon plist + `build-pkg.sh` | Shipped |
| Linux | systemd unit + `build-deb.sh` / RPM staging | Shipped |
| ZIP / USB | Extract + `setup.html` → `config.json` | Shipped |
| Discovery UI download tabs | Desktop / Service / ZIP with real endpoints or artifacts | In-build polish |

**Requirements:** Node 18+, HTTPS to API, deploy token / agent JWT. Footprint target: &lt;50MB RAM, &lt;1% CPU average.

### Data collected

| Category | Fields | Status |
|----------|--------|--------|
| Hardware | CPU, RAM, disk, serial, BIOS | Shipped |
| OS | Platform, version, arch, hostname, uptime | Shipped |
| Network | Interfaces IP/MAC/DNS/gateway | Shipped |
| Software | Installed apps/packages (bounded list + expand) | Shipped |
| Security | Firewall, disk encryption, AV when available | Shipped |
| Performance | Load, RAM %, top processes | Shipped |
| Patch / product inventory for CVE match | Authenticated product versions | In-build |
| CIS checks evidence | Benchmark collectors | In-build |

### Agent UEM capabilities

| Capability | Status |
|------------|--------|
| Heartbeat + online/stale | Shipped |
| Inventory POST / baseline | Shipped |
| ScriptLibrary remote run (approved) | Shipped |
| Software deploy rings (pilot → prod) | In-build |
| File pull agent logs | In-build |
| License blacklist enforce (KILL_PROCESS) | In-build |
| Remote assist | Documented RDP/SSH deep-link (no fake WebRTC) | In-build |
| Pause / resume from tray | Shipped |

### Acceptance tests — agent

1. Install service on Windows/macOS/Linux; agent appears in Agents list; heartbeat &lt; 2× poll interval.
2. Inventory upserts Asset with `discoverySource=AGENT`; hardware/OS detail rows populated.
3. Electron tray reflects ONLINE / OFFLINE / PAUSED.
4. Approved script executes once; rejected script refused.
5. MSI/PKG/DEB build scripts produce installable artifacts on supported hosts (notarization optional).

---

## 2. Agentless discovery

| Method | Use | Status |
|--------|-----|--------|
| ICMP / TCP port scan | Host + service discovery | Shipped |
| Nmap integration | Advanced ports / OS guess when binary present | Shipped |
| SNMP v1/v2c/v3 | Network devices + printers / UPS | Shipped |
| WMI | Windows hardware/software enrich | Shipped |
| SSH | Linux/Unix inventory enrich | Shipped |
| WinRM | Windows remote (when enabled) | In-build / optional |
| ARP / LLDP/CDP neighbor | L2 topology | ARP Shipped; LLDP enrich In-build |

**Credentials:** `ScanCredential` vaulted; never returned in API plaintext. Scheduled via `ScheduledScan` / cron.

**Rule:** Successful WMI/SSH **must** fill HardwareDetail / OsDetail — no empty CMDB after success.

### Acceptance tests — agentless

1. Subnet scan creates DiscoveredDevice rows; promote creates Asset.
2. WMI with valid creds populates CPU/RAM/OS; failure returns honest error, no fake inventory.
3. SNMP poll updates MonitoredDevice.metrics + DeviceMetricsHistory.
4. Nmap absent → capability endpoint reports unavailable; UI does not invent ports.

---

## 3. Active Directory / LDAP

| Capability | Status |
|------------|--------|
| Multi-OU computer/user sync (`ldapts`) | In-build |
| Vaulted bind credentials | In-build |
| Schedule + conflict merge (serial/hostname) | In-build |
| `DiscoverySource.ACTIVE_DIRECTORY` assets | Enum Shipped; sync In-build |
| LDAPS | In-build |

### Acceptance tests — AD

1. Sync creates users + computer assets for test OU.
2. Re-sync merges without duplicate hostnames.
3. Disabled AD computer → asset flagged PENDING_REVIEW or retired per policy.

---

## 4. Cloud asset discovery

| Provider | Assets | Status |
|----------|--------|--------|
| AWS | EC2 (+ expand RDS/S3 later as needed) | Shipped (`CloudConnector` / CLOUD_AWS) |
| Azure | Compute / Resource Graph VMs | In-build (no stubs) |
| GCP | Compute Engine list | In-build (no stubs) |

Multi-account, regions JSON, encrypted creds, `lastSyncAt` / status. Tag → classification. Default interval 4h via job queue.

### Acceptance tests — cloud

1. AWS sync with valid keys creates/updates CLOUD_AWS assets.
2. Azure/GCP connectors sync real inventories or show config/auth error — never mock VMs.
3. Disable connector stops scheduled sync.

---

## 5. IoT / OT / physical sensors

| Protocol | Status |
|----------|--------|
| MQTT broker config + telemetry topics | Shipped |
| ONVIF camera discovery | Shipped |
| Modbus TCP probe | In-build (feature flag) |
| BACnet/IP probe | In-build (feature flag) |

Discovered devices register as assets with `DiscoverySource.IOT` / `ONVIF`.

### Acceptance tests — IoT

1. MQTT message on configured topic creates/updates telemetry-linked asset.
2. ONVIF discover registers CAMERA monitored device.
3. Modbus/BACnet behind flag; when off, UI shows disabled — no fake PLC inventory.

---

## 6. Correlation & CMDB merge

**Match keys (priority):** serial → MAC → hostname+domain → cloud instance id → agentId.

| Rule | Behavior |
|------|----------|
| Exact serial/MAC match | Update existing Asset; merge discoverySource history |
| Conflict (two live agents same serial) | Flag PENDING_REVIEW + AlertEvent |
| Unmanaged new MAC on scanned subnet | DiscoveredDevice + optional investigation ticket |
| Soft-deleted asset rediscovered | Undelete or new PENDING_REVIEW per tenant setting |

### Acceptance tests — correlation

1. Agent then WMI on same host → one Asset, both sources reflected.
2. Duplicate MAC from two scans → single CI.
3. 10k import/scan job batch completes with pagination; no tenant bleed.

---

## 7. API & UI surfaces

| Surface | Notes |
|---------|-------|
| `/dashboard/discovery` | Jobs, credentials, schedules, agent downloads |
| `/dashboard/scanning` | Security scan capabilities |
| `/dashboard/nac` | VLAN / RADIUS / quarantine |
| `/scan` | PWA barcode/QR/RFID lookup |
| REST | `discovery/*`, `scanning/*`, `cloud-connectors/*`, `iot/mqtt/*`, `monitoring/*` |

---

## 8. Scale & ops requirements

- Scan jobs via Redis/Bull when Redis up; in-process fallback only for dev.
- Rate-limit agent posts per tenant.
- Pagination on discovered devices and assets.
- Indexes on `tenantId+ipAddress`, `macAddress`, `serialNumber`, `hostname` (Prisma as-built).

---

## Module acceptance checklist

- [ ] Agent Desktop + Service + ZIP paths documented and downloadable from Discovery UI
- [ ] Agentless WMI/SSH/SNMP/Nmap paths honest about deps
- [ ] AD sync scheduled and merge-safe
- [ ] AWS + Azure + GCP connectors non-stub
- [ ] MQTT + ONVIF live; Modbus/BACnet flagged
- [ ] Correlation prevents duplicate CIs at 10k scale smoke
- [ ] NAC policy can quarantine via CoA or agent firewall fallback ([04](04-SSDLC-COMPLIANCE-SECURITY.md))
