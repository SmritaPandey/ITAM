# QS Assets — Product Overview

| Field | Value |
|-------|-------|
| **Product** | QS Assets |
| **Vendor** | NeurQ AI Labs |
| **Last reviewed** | 2026-07-13 |
| **Status** | Living PRD |
| **Competitors** | ManageEngine Suite · ServiceNow ITAM/EAM/CMDB/ITSM · Qualys CSAM/VMDR-lite · Ivanti Neurons · Asset Panda |

---

## Vision

A unified enterprise platform that consolidates **IT Asset Management**, **Non-IT / Enterprise Asset Management**, **Network Monitoring**, **Fleet/GPS**, **Patch & Vulnerability**, **CCTV**, **VDI**, **ITSM**, and **Compliance** into one pane of glass — with discovery that scales from a laptop agent to multi-cloud and OT/IoT.

**Lifecycle north star:** procure → discover → inventory → monitor → secure/patch → service → retire.

---

## Module catalog

### M1 — IT Asset Management (ITAM)

**Analog:** ManageEngine AssetExplorer · ServiceNow ITAM

| Capability | Status |
|------------|--------|
| Hardware / network / peripheral inventory | Shipped |
| Software inventory + versions | Shipped |
| OS / BIOS / security posture fields | Shipped |
| Lifecycle states + warranty / AMC / contracts | Shipped |
| Depreciation (straight-line, declining) mass job + finance report | In-build |
| Cost center / department tagging | Shipped |
| QR / barcode print + `/scan` lookup | Shipped |
| RFID / NFC tag ID field + same scan path | In-build |
| Checkout / check-in + attestation campaigns | Shipped (depth In-build) |
| License harvest actionable (ticket + reclaim) | In-build |

**Acceptance tests**

1. Create laptop asset with serial, site, department; status transitions ACTIVE → IN_MAINTENANCE → RETIRED.
2. Generate QR label; `/scan` resolves asset by tag/barcode/RFID when field populated.
3. Run depreciation job for N assets; finance report shows current vs purchase value.
4. Checkout asset to user; attestation campaign reminds and records certify.

---

### M2 — Non-IT / Enterprise Asset Management (EAM)

**Analog:** Asset Panda · ServiceNow EAM

| Capability | Status |
|------------|--------|
| Custom asset types (non-IT flag) | Shipped |
| Facility / furniture / HVAC / medical / lab classes | Shipped (types) |
| Preventive maintenance schedules (calendar + condition) | In-build |
| Spare parts + min-stock → AlertEvent | In-build |
| Consumables with reorder points | In-build |
| Work orders linked to maintenance | Shipped (WO); schedule link In-build |
| Floor plan URL + asset pin `{x,y}` overlay | In-build |
| Vendor / service provider on contracts | Shipped |

**Acceptance tests**

1. Create non-IT asset type; create HVAC unit; pin on facility floor plan.
2. PM schedule fires → work order auto-created; spare consumed → stock decrements.
3. Consumable below reorder → AlertEvent OPEN.
4. Facility dashboard shows open WOs + low stock.

---

### M3 — Network Management System (NMS)

**Analog:** ManageEngine OpManager

| Capability | Status |
|------------|--------|
| ICMP / port scan / auto-discover | Shipped |
| SNMP v1/v2c/v3 poll + metrics history | Shipped |
| SNMP trap receiver | Shipped |
| Topology (ARP/neighbor edges) | Shipped (LLDP enrich In-build) |
| Network config backup / hash diff | Shipped (approve+push In-build) |
| Syslog UDP ingest → alert / ticket | In-build |
| NetFlow/sFlow/IPFIX → FlowRecord + top talkers | In-build |
| NOC dashboard (topology + alarms + traps/syslog) | In-build |

**Acceptance tests**

1. SNMP poll stores DeviceMetricsHistory; UI chart uses real deltas.
2. Trap received → AlertEvent; optional auto-ticket via automation.
3. With exporter configured, FlowRecord rollups populate top talkers; empty state when no exporters.
4. Config drift vs baseline creates alert.

---

### M4 — Fleet & GPS

**Analog:** Fleet vendors / ME mobile asset tracking

| Capability | Status |
|------------|--------|
| GPS telemetry storage + map | Shipped |
| Trips | Shipped |
| Geofence entry/exit + speeding + idle alerts | In-build |
| Traccar-protocol ingest endpoint | In-build |
| Maintenance due from EAM schedules | In-build |

**Acceptance tests**

1. Ingest GPS point → asset lat/lng updates; map shows vehicle.
2. Breach geofence → AlertEvent to fleet role.
3. Traccar payload accepted when endpoint enabled.

---

### M5 — Patch & Vulnerability

**Analog:** Endpoint Central Patch Manager · Qualys VMDR-lite / CSAM

| Capability | Status |
|------------|--------|
| Patch catalog + deployments model | Shipped |
| Agent reports missing patches / products | Shipped (depth In-build) |
| Live third-party catalogs (winget/apt/brew sync) | In-build |
| Pilot → staged → all deploy rings + windows | In-build |
| Rollback UI (uninstall / previous package) | In-build |
| Air-gap patch bundle ZIP | In-build |
| NVD CVE ingest + AssetVulnerability match | Shipped |
| Agent authenticated inventory → CVE match | In-build |
| Critical CVE → auto-ticket | In-build |
| CIS evidence pack export PDF/CSV | In-build |

**Acceptance tests**

1. Sync catalog; create deploy to pilot ring; promote to all.
2. Rollback deployment removes or reverts package via agent command.
3. NVD ingest + match marks OPEN vulns on assets with matching software.
4. Critical severity creates ticket linked to asset.

---

### M6 — Change / SSDLC patch lifecycle

**Analog:** ServiceNow Change · ITIL Change Enablement

| Capability | Status |
|------------|--------|
| ChangeRequest CRUD + states | Shipped |
| Multi-level approval + CAB calendar | In-build |
| SSDLC 9-step change type (UAT/VAPT gates + attachments) | In-build |
| Link to assets / problems / tickets | Shipped / In-build |

**Acceptance tests**

1. Normal change requires CAB approval before IMPLEMENT.
2. SSDLC type blocks close until UAT + VAPT evidence fields set.
3. Audit log records approve/reject with hash chain.

---

### M7 — License & Software Management

**Analog:** AssetExplorer SAM · Ivanti license ops

| Capability | Status |
|------------|--------|
| License entitlements + assignments | Shipped |
| Usage vs entitlement + expiry alerts | Shipped |
| Software metering (last-used from agent) | In-build |
| Blacklist/whitelist → agent enforce | In-build |
| Harvest recommendations | In-build |

**Acceptance tests**

1. Over-assign license → compliance warning.
2. Blacklisted process → agent KILL_PROCESS or block install when policy on.
3. Harvest creates reclaim ticket for unused seat > N days.

---

### M8 — VDI Monitoring

**Analog:** Horizon / AVD monitoring suites

| Capability | Status |
|------------|--------|
| Hypervisor connectors + session list | Shipped |
| Console launch deep-link | Shipped |
| Session metrics charts (Horizon/Proxmox poll) | In-build |

**Acceptance tests**

1. Sync pools/sessions from configured hypervisor.
2. Metrics appear only when connector succeeds; honest empty/error otherwise.

---

### M9 — CCTV

**Analog:** OpManager camera / ONVIF suites

| Capability | Status |
|------------|--------|
| ONVIF discovery | Shipped |
| Snapshot / HLS stream proxy | Shipped |
| Multi-camera video wall layouts | In-build |
| Tamper / offline alerts | In-build |

**Acceptance tests**

1. Discover camera → MonitoredDevice CAMERA with stream URL.
2. HLS playlist serves when ffmpeg available; otherwise operational message.
3. Offline camera → AlertEvent.

---

### M10 — ITSM Ticketing & Workflows

**Analog:** ServiceDesk Plus · ServiceNow ITSM

| Capability | Status |
|------------|--------|
| Incidents / requests + comments + asset link | Shipped |
| Problems + Known Error fields | Shipped |
| SLA policies + timers | Shipped |
| SLA escalation cron (notify + reassign) | In-build |
| Service catalog + fulfillment | Shipped (approval enforce In-build) |
| Knowledge base + ticket suggest | Shipped / In-build |
| CSAT on resolve | In-build |
| Omnichannel email ingest (IMAP) | In-build |
| AutomationRule workflow builder UI | Shipped (complete form In-build) |
| Work orders from tickets | Shipped |

**Acceptance tests**

1. Ticket SLA near breach → escalate + notify channel.
2. Resolve → CSAT survey recorded.
3. IMAP mail creates ticket with correct tenant.
4. Catalog item with approval blocks fulfillment until approved.

---

### M11 — CMDB

**Analog:** ServiceNow CMDB / CSDM-lite

| Capability | Status |
|------------|--------|
| Unified Asset CI + types hierarchy | Shipped |
| Relationships (DEPENDS_ON, CONNECTED_TO, …) | Shipped |
| Discovery auto-sync | Shipped |
| Impact analysis API + UI drilldown | In-build |
| BusinessService health rollup (CSDM-lite) | In-build |
| Data quality / attestation | Shipped / In-build |

**Acceptance tests**

1. Impact API returns transitive dependents for a CI.
2. BusinessService RED when any critical child down.
3. Discovery merge updates CI without duplicate serial/MAC.

---

### M12 — Automation Engine

**Analog:** Ivanti Neurons · ME workflow rules

| Capability | Status |
|------------|--------|
| IF condition THEN notify/ticket/script | Shipped |
| Channels: in-app, email, Slack, Teams, webhook | Shipped |
| Script library + approve + execute | Shipped |
| Cron + event triggers | Shipped |
| Visual-ish rules builder (not SN Flow canvas) | In-build polish |

**Acceptance tests**

1. Device offline > threshold → incident created.
2. Script execute requires APPROVED state.
3. Execution audit row written.

---

### M13 — Alerts & Notifications

| Capability | Status |
|------------|--------|
| AlertRule / AlertEvent CRUD + ack/resolve | Shipped |
| Multi-channel dispatch | Shipped |
| Digest modes | In-build |
| Threat Approve / Quarantine / Block + WS push | Shipped / In-build |

**Acceptance tests**

1. Critical alert appears in `/dashboard/alerts` and Socket.io room.
2. Acknowledge-all updates status for tenant only.

---

### M14 — Reports & Analytics

| Capability | Status |
|------------|--------|
| Template reports (assets, tickets, licenses, executive, audit) | Shipped |
| PDF / XLSX / CSV generate + download | Shipped |
| Scheduled report email | In-build (model Shipped) |
| Custom saved-filter reports | In-build |
| Meilisearch Cmd+K global search | In-build |

**Acceptance tests**

1. Generate patch compliance PDF with real counts.
2. Schedule weekly executive XLSX to SMTP recipient.
3. Global search returns asset + ticket + user hits.

---

### M15 — Discovery (see [02](02-DISCOVERY-AND-SCANNING.md))

Cross-cutting: agent, agentless, AD, cloud, IoT/OT, correlation.

### M16 — Auth, NAC, Compliance (see [04](04-SSDLC-COMPLIANCE-SECURITY.md))

MFA TOTP, SAML/OIDC, RLS, CIS evidence, NAC CoA.

---

## Competitive capability matrix

Status legend: **S** = Shipped · **B** = In-build (Must-ship) · **F** = Future-only / non-goal.

| Capability | ME | SN | Qualys | Ivanti | AssetPanda | QS Assets |
|------------|----|----|--------|--------|------------|-----------|
| CMDB + lifecycle + finance | ● | ● | ○ | ● | ● | S + B (depreciation/BS) |
| Non-IT PM + spares + floor pins | ○ | ● | ○ | ○ | ● | B |
| Agent + agentless + AD + cloud | ● | ● | ● | ● | ○ | S + B (AD/Azure/GCP depth) |
| Patch rings + rollback + catalogs | ● | ○ | ○ | ● | ○ | B |
| CVE risk + tickets | ○ | ○ | ● | ● | ○ | S + B |
| SNMP + syslog + NetFlow | ● | ○ | ○ | ○ | ○ | S + B |
| Tickets + CAB + SLA + catalog | ● | ● | ○ | ● | ○ | S + B |
| MFA + SAML + RLS | ● | ● | ● | ● | ● | B (SSO model S) |
| Fleet GPS + geofence | ○ | ○ | ○ | ○ | ● | S + B |
| CCTV wall | ● | ○ | ○ | ○ | ○ | S + B |
| Always-on agent packaging | ● | ○ | ● | ● | ○ | S |
| Proprietary vuln signatures | ○ | ○ | ● | ○ | ○ | F |
| Full Flow Designer canvas | ○ | ● | ○ | ● | ○ | F |

---

## Role → primary surfaces

| Role | Primary routes | Spec |
|------|----------------|------|
| Executive / Tenant Admin | `/dashboard`, `/dashboard/reports` | [06](06-DASHBOARDS-API-DELIVERABLES.md) |
| IT Admin | `/dashboard/discovery`, assets, patches, vulns | 06 |
| NOC | `/dashboard/network`, `/dashboard/alerts` | 06 |
| Fleet Manager | `/dashboard/fleet` | 06 |
| Service Desk | `/dashboard/tickets`, changes, KB, catalog | 06 |
| Security | `/dashboard/vulnerabilities`, compliance, CCTV, NAC | 06 |
| Facility Manager | `/dashboard/non-it-assets`, work-orders | 06 |
| Employee | `/dashboard/my-portal`, `/portal/*`, `/scan` | 06 · [08](08-ORG-FLOWS.md) |

---

## Plans / packaging (commercial)

| Plan | Intent |
|------|--------|
| Starter | Core ITAM + tickets + basic discovery |
| Professional | CMDB, NMS, patch, automation, reports |
| Enterprise | Full Must-ship matrix (SSO, NAC, cloud, EAM, NetFlow, CAB) |
| On-Premise | Same Enterprise capabilities, customer-hosted |

### Deployment modes

| Mode | `DEPLOYMENT_MODE` | Who hosts | Owner control |
|------|-------------------|-----------|---------------|
| SaaS | `saas` (default) | NeurQ (Railway/Vercel) | SuperAdmin `/admin` — tenants, billing, **product license issuance** |
| On-prem / BYO | `onprem` | Customer (compose or bare metal + BYO Postgres/Redis) | Signed product license (online/offline); local support SuperAdmin for break-glass only |

**Non-goal:** permanent remote SuperAdmin into customer on-prem databases.

Module gating in web layout must match `Tenant.plan` (+ on-prem entitlement modules) — no fake unlocks.

---

## Non-goals (this wave)

Documented in [00-SPEC-INDEX.md](00-SPEC-INDEX.md). Must-ship items are never deferred with vague “roadmap” language — they are **In-build** until Shipped.
Explicit packaging non-goal: remote control plane over customer asset data.