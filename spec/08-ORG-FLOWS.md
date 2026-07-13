# QS Assets — Organization End-to-End Flows

| Field | Value |
|-------|-------|
| **Product** | QS Assets |
| **Last reviewed** | 2026-07-13 |
| **Status** | Living PRD |
| **Depends on** | [01](01-PRODUCT-OVERVIEW.md)–[06](06-DASHBOARDS-API-DELIVERABLES.md) |
| **Tracker** | [07](07-GAP-REMEDIATION-PLAN.md) |

Playbooks validate that modules work together at org scale. Each flow lists actors, steps, APIs/UI, and **pass criteria**. No mocks — missing infra shows operational errors.

---

## Flow A — Onboard 10,000 assets

**Actors:** IT Admin, Discovery Engine, Agents  
**Goal:** Populate CMDB from greenfield / migration without duplicates.

### Steps

1. Provision tenant (Enterprise plan); configure sites/departments; vault scan credentials.
2. Schedule subnet agentless scans (ICMP/Nmap/SNMP) off-peak; enable WMI/SSH enrich.
3. Deploy agent via GPO/MDM: MSI/PKG/DEB or service installer; register deploy token.
4. Optional: kick off AD computer OU sync; cloud connector sync for AWS/Azure/GCP.
5. Run correlation: serial/MAC/hostname merge; review `PENDING_REVIEW` queue.
6. Bulk tag cost centers; attestation campaign for owners.

### Surfaces

- `/dashboard/discovery`, `/dashboard/assets`, `/dashboard/cmdb`
- APIs: discovery jobs, agents, cloud-connectors, assets import

### Pass criteria

- [ ] ≥10k Asset rows for tenant with pagination &lt; 2s p95 on list
- [ ] Duplicate MAC/serial rate &lt; 0.1% after merge
- [ ] Agent heartbeats show online count; stale agents alerted
- [ ] Successful WMI/SSH rows have HardwareDetail/OsDetail
- [ ] No cross-tenant leakage under RLS

---

## Flow B — Non-IT labeling (facility)

**Actors:** Facility Manager, Technician  
**Goal:** Track chairs, HVAC, lab gear with labels and floor context.

### Steps

1. Create non-IT `AssetType`; create assets with site/floor/room.
2. Print QR/barcode labels (`PrintLabelModal`); optionally set RFID tag IDs.
3. Upload site floor plan; pin assets `{x,y}` on overlay.
4. Technician scans label on phone `/scan` → asset detail + open WO if damaged.
5. PM schedule on HVAC → auto WO; consume spare; stock alert if below min.

### Surfaces

- `/dashboard/non-it-assets`, `/dashboard/work-orders`, `/scan`, facility floor UI
- Procurement vendors for service contracts

### Pass criteria

- [ ] Scan by QR/barcode/RFID resolves correct asset
- [ ] Pin visible on floor plan for site
- [ ] PM creates WO; spare decrement; AlertEvent on min-stock
- [ ] Facility dashboard shows open WOs + low stock

---

## Flow C — Patch Tuesday

**Actors:** IT Admin, Security, Pilot users, Agents  
**Goal:** Staged patch rollout with rollback and evidence.

### Steps

1. Sync third-party/OS patch catalogs; review critical CVEs on `/dashboard/vulnerabilities`.
2. Create deploy policy: **pilot ring** (IT laptops) → staged → all; maintenance window.
3. Agents install; monitor failures; auto-ticket critical CVE still OPEN after window.
4. Rollback failed package via UI → agent uninstall/previous version.
5. Export CIS / patch compliance report PDF for audit.
6. Air-gap site: export bundle ZIP; import on offline tenant; deploy locally.

### Surfaces

- `/dashboard/patches`, `/dashboard/vulnerabilities`, `/dashboard/compliance`, `/dashboard/reports`

### Pass criteria

- [ ] Pilot succeeds before wide deploy unlock
- [ ] Rollback removes/reverts package on agent
- [ ] Critical CVE creates linked ticket
- [ ] Compliance PDF lists hosts pass/fail
- [ ] Air-gap bundle round-trips without cloud catalog

---

## Flow D — NOC incident

**Actors:** NOC analyst, Automation, Service Desk  
**Goal:** Detect network fault → alert → ticket → restore.

### Steps

1. SNMP poll marks core switch interface down / trap `linkDown` received.
2. Syslog correlation (if enabled) attaches context; AlertEvent CRITICAL.
3. Automation rule: device down &gt; N min → create Incident + notify Slack/Teams/email.
4. NOC dashboard shows red node on topology; analyst acknowledges alert.
5. Config drift check if change suspected; open Change if remediation needs CAB.
6. Resolve: interface up; alert resolved; ticket closed; CSAT optional for requester.

### Surfaces

- `/dashboard/network`, `/dashboard/alerts`, `/dashboard/tickets`, `/dashboard/automation`

### Pass criteria

- [ ] Trap/syslog/poll produces real AlertEvent (not simulated)
- [ ] Auto-ticket linked to MonitoredDevice/Asset
- [ ] Topology color updates via WS within poll interval
- [ ] Top talkers empty-state honest when no NetFlow; populated when exporter sends

---

## Flow E — CAB change (SSDLC)

**Actors:** Requester, IT Analyst, CAB, Implementer, Security (VAPT)  
**Goal:** Controlled production change with evidence.

### Steps

1. User opens Change (normal/SSDLC type) linked to CIs; impact analysis shows dependents.
2. Analyst attaches understanding doc; multi-level approval starts.
3. CAB calendar decision → `CabApproval` APPROVED/REJECTED.
4. Implement in window; SSDLC gates: UAT checklist + VAPT evidence attachments required.
5. Deploy; post-implementation review; compliance logging in audit hash chain.
6. Emergency path: documented break-glass with retroactive CAB within SLA.

### Surfaces

- `/dashboard/changes`, `/dashboard/cmdb`, `/dashboard/audit-logs`

### Pass criteria

- [ ] IMPLEMENT blocked without CAB approve for normal/SSDLC
- [ ] Close blocked without UAT+VAPT fields on SSDLC type
- [ ] Impact API lists transitive DEPENDS_ON children
- [ ] Audit verify still PASS after approvals

---

## Flow F — Employee self-service

**Actors:** Employee, Approver, Service Desk  
**Goal:** Request laptop / software / facilities without IT email chaos.

### Steps

1. Employee logs into `/portal` or `/dashboard/my-portal`; sees assigned assets.
2. Browses service catalog; submits “New laptop” — approval required.
3. Manager approves; fulfillment creates Ticket + optional Procurement PO line / Asset reserved.
4. Employee tracks status; uses KB suggest; rates CSAT on resolve.
5. Shared asset check-out/in; scan label if picking from stockroom.

### Surfaces

- `/portal/*`, `/dashboard/my-portal`, `/dashboard/service-catalog`, `/dashboard/tickets`, `/scan`

### Pass criteria

- [ ] Employee cannot see other users’ assets
- [ ] Fulfillment blocked until approval
- [ ] CSAT score stored on ticket
- [ ] Check-out updates AssetCheckout + asset status

---

## Flow G — Multi-cloud inventory

**Actors:** Cloud Admin, IT Admin, FinOps (read reports)  
**Goal:** Single CMDB view of AWS + Azure + GCP compute.

### Steps

1. Configure `CloudConnector` per provider with least-privilege read roles; regions list.
2. Manual sync then schedule (Bull); assets tagged `CLOUD_AWS` / `CLOUD_AZURE` / `CLOUD_GCP`.
3. Correlate with agents where hybrid (same hostname/instance id).
4. BusinessService “Checkout API” links critical cloud CIs; health rollup.
5. Report: cloud inventory + missing agent coverage; alerts on public exposure tags if posture checks on.

### Surfaces

- Discovery / Settings cloud connectors UI, `/dashboard/cmdb`, `/dashboard/reports`, `/dashboard/assets`

### Pass criteria

- [ ] Each provider syncs real instances or shows auth error — never fake VMs
- [ ] Re-sync idempotent (no duplicate instance ids)
- [ ] BusinessService goes RED when critical cloud CI down/missing
- [ ] Disable connector stops jobs

---

## Cross-flow regression pack (Phase 10)

Run after major merges:

| # | Check |
|---|-------|
| 1 | Login + MFA challenge (when enrolled) |
| 2 | Create asset + QR scan |
| 3 | Start agentless scan job; observe WS progress |
| 4 | SNMP poll one device; chart updates |
| 5 | Open ticket; link asset; resolve + CSAT |
| 6 | Trigger automation from alert |
| 7 | Generate executive PDF |
| 8 | Audit hash verify PASS |
| 9 | Agent heartbeat from packaged install |
| 10 | Cloud sync dry-run |

---

## Mapping to tracker phases

| Flow | Primary phases in [07](07-GAP-REMEDIATION-PLAN.md) |
|------|------------------------------------------------------|
| A 10k onboard | 1, 3, 10 |
| B Non-IT | 2, 9 |
| C Patch Tuesday | 5, 7 |
| D NOC | 4, 8, 9 |
| E CAB | 6, 7 |
| F Self-service | 6, 9 |
| G Multi-cloud | 3, 2 (BusinessService), 10 |
