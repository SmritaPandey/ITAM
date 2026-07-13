# QS Assets — Gap Remediation & Execution Tracker

| Field | Value |
|-------|-------|
| **Product** | QS Assets |
| **Last reviewed** | 2026-07-13 |
| **Status** | Active execution tracker |
| **Owners** | Platform Eng · Product |
| **Related** | [00](00-SPEC-INDEX.md)–[06](06-DASHBOARDS-API-DELIVERABLES.md), [08](08-ORG-FLOWS.md) |

> **Do not confuse with historical plan.** The May 2026 five-phase gap plan is **complete** (archived below). Current work is **Phases 1–10** of the enterprise competitive build. Check boxes as acceptance tests pass; then flip capability rows in [01](01-PRODUCT-OVERVIEW.md) to **Shipped**.

---

## Historical — Phases 1–5 (DONE)

Completed foundation work from the prior remediation plan:

| Phase | Scope | Outcome |
|-------|-------|---------|
| **H1** | Socket.io gateway + email/Slack/Teams/webhook notifications | Done — EventBus → WS; Nodemailer path |
| **H2** | SNMP poll, topology, traps, NMS UI charts | Done — `net-snmp`, DeviceMetricsHistory, trap receiver |
| **H3** | ONVIF discovery, camera proxy/HLS, VDI hypervisor hooks | Done — monitoring cameras + VDI sync |
| **H4** | Report PDF/XLSX generator + schedules model | Done — pdfkit/exceljs paths |
| **H5** | GitHub Actions CI + critical tests | Done — `.github/workflows/ci.yml` |

Architectural decisions retained: Node SNMP (not Go); EventBus over Kafka; Socket.io over raw WS.

---

## Current wave — Phases 1–10

### Phase 1 — Platform foundation (Docker + data)

- [ ] `docker compose up`: PostGIS + Redis (+ Meilisearch) healthy
- [ ] `apps/api/.env` `DATABASE_URL` correct; `.env.example` covers vault, Redis, NVD, payments, SSO, MQTT, NetFlow, syslog
- [ ] `prisma migrate deploy` + `generate` + `db:seed` succeed
- [ ] Redis-backed Bull queues for scans, NVD ingest, AD sync, NetFlow rollups
- [ ] Postgres **RLS** policies + Prisma middleware `SET app.current_tenant`
- [ ] Smoke: API boot, login, create asset

**Exit:** Local stack green; RLS verified; seed demo tenant usable.

---

### Phase 2 — ITAM + EAM

**ITAM**

- [x] Mass depreciation job + finance report (straight-line / declining)
- [x] Checkout/check-in + attestation campaigns (bulk assign, remind, certify)
- [x] Software metering last-used from agent; harvest → ticket + reclaim
- [x] License blacklist/whitelist → agent enforce
- [x] CMDB impact analysis API + UI graph drilldown
- [x] `BusinessService` CSDM-lite + health rollup dashboard

**EAM**

- [x] Models: `MaintenanceSchedule`, `MaintenanceWorkOrder`, `SparePart`, `SparePartTransaction`, `Consumable`
- [x] Calendar + condition PM → auto work orders
- [x] Spare consume + min-stock → `AlertEvent`
- [x] Site `floorPlanUrl` + asset pin `{x,y}` facility UI
- [x] RFID/NFC tag field + `/scan` lookup
- [x] Facility Manager dashboard widgets live

**Exit:** [08](08-ORG-FLOWS.md) non-IT labeling + facility flows pass.

---

### Phase 3 — Discovery + UEM

- [x] AD/LDAP multi-OU sync (`ldapts`), vault creds, schedule, conflict merge
- [x] Azure Compute/Resource Graph + GCP Compute connectors (no stubs)
- [x] MQTT (exists) + Modbus TCP + BACnet/IP probes behind feature flags
- [x] Agent UEM: ScriptLibrary run, deploy rings, log file pull; RDP/SSH deep-link assist
- [x] Discovery UI tabs: Desktop App / Service Installer / ZIP with real downloads
- [x] Agentless WMI/SSH always fill Hardware/OS on success

**Exit:** [08](08-ORG-FLOWS.md) 10k onboard + multi-cloud playbooks pass smoke.

---

### Phase 4 — NMS (OpManager class)

- [x] Syslog UDP ingest → alerts + optional auto-ticket
- [x] NetFlow/sFlow/IPFIX UDP → `FlowRecord` / rollups; Top Talkers charts
- [x] Config backup versions, baseline diff, drift alerts, approve+push where possible
- [x] LLDP/CDP neighbor enrichment into topology
- [x] NOC dashboard: topology + alarms + top interfaces + trap/syslog stream

**Exit:** [08](08-ORG-FLOWS.md) NOC incident playbook pass.

---

### Phase 5 — Patch + Vulnerability

- [ ] Live catalogs: winget REST + apt/brew metadata sync
- [ ] Deploy policies: pilot → staged → all; windows; **rollback** UI
- [ ] Air-gap patch bundle ZIP export/import
- [ ] Agent authenticated inventory → CVE match; critical auto-ticket
- [ ] Risk score CVE-primary
- [ ] CIS evidence packs → compliance PDF/CSV

**Exit:** [08](08-ORG-FLOWS.md) Patch Tuesday playbook pass.

---

### Phase 6 — ITSM

- [ ] Change multi-level approval + CAB calendar
- [ ] SSDLC 9-step change type with UAT/VAPT gates + attachments
- [ ] SLA escalation cron → notify + reassign
- [ ] CSAT survey on resolve (`TicketCsat`)
- [ ] Workflow rules builder UI over `AutomationRule` (complete form, not SN canvas)
- [ ] IMAP inbound email → ticket
- [ ] Service catalog approvals enforced; KB suggest on ticket

**Exit:** [08](08-ORG-FLOWS.md) CAB change + employee self-service pass.

---

### Phase 7 — Security, NAC, Auth

- [ ] MFA TOTP enroll + login challenge
- [ ] SAML 2.0 ACS + OIDC + Google/MS; group→role map
- [ ] Threat Approve/Quarantine/Block + WebSocket push
- [ ] NAC RADIUS CoA / switch webhook; agent firewall fallback
- [ ] Nightly audit hash-chain verify job; SIEM syslog/webhook export

**Exit:** Auth/NAC acceptance tests in [04](04-SSDLC-COMPLIANCE-SECURITY.md) green.

---

### Phase 8 — Fleet, CCTV, VDI, Reports

- [ ] Fleet geofence entry/exit, speeding, idle alerts
- [ ] Traccar protocol ingest endpoint
- [ ] Fleet maintenance due from EAM schedules
- [ ] CCTV multi-camera video wall; tamper/offline alerts
- [ ] VDI session metrics charts (Horizon/Proxmox)
- [ ] Parameterized reports + scheduled email PDF/XLSX
- [ ] Custom report from saved filters
- [ ] Meilisearch Cmd+K global search

**Exit:** Role dashboards 3/4/6/8 widgets fed by real data paths.

---

### Phase 9 — Full UI/UX audit & role dashboards

- [ ] Walk every route under `apps/web/src/app`; fix empty wiring
- [ ] Remove “Coming soon” where backend exists
- [ ] Implement all 8 role dashboards from [06](06-DASHBOARDS-API-DELIVERABLES.md)
- [ ] PageHeader / EmptyState consistency; module gating by plan
- [ ] PWA meta for `/scan`

**Exit:** UI audit checklist in [06](06-DASHBOARDS-API-DELIVERABLES.md) pass/fail complete.

---

### Phase 10 — Verify + live deploy

**Verify**

- [ ] `tsc` API + web clean
- [ ] Unit tests: discovery enrich, CVE match, NetFlow parse, MFA login
- [ ] E2E smoke: health, auth, asset CRUD, scan job, QR lookup, vuln dry-run, checkout

**Deploy**

- [ ] Railway login → env → `prisma migrate deploy` → redeploy API
- [ ] Vercel `NEXT_PUBLIC_API_URL`, CORS, OAuth redirects → prod web
- [ ] `DEPLOY.md` runbook (no secrets)
- [ ] Post-deploy: `/health`, login, agent download, one agentless scan

**Exit:** Production healthy; launch acceptance below met.

---

## Launch acceptance (wave complete)

- [ ] Specs accurate living PRDs; every Must-ship row has passing test or honest demo path
- [ ] Docker Postgres/Redis healthy; migrations + seed work
- [ ] Org can: discover (agentless+agent+AD+cloud), label non-IT (QR/RFID), run PM/spares, monitor (SNMP+syslog+flows when exporters exist), patch with rings, triage CVEs, ITSM with CAB, MFA/SAML, role dashboards
- [ ] No stubbed Azure/SAML/syslog/license-tab/automation defaults left
- [ ] Railway API + Vercel web redeployed with correct CORS/OAuth

### Enterprise on-prem + license hybrid

- [x] `DEPLOYMENT_MODE=onprem` gates public signup; first-boot seeds owner + tenant admin
- [x] `ProductLicense` + Ed25519 signed `.lic`; online activate + offline upload
- [x] SaaS `/admin` create tenant + `/admin/licenses` issue/revoke/renew/download
- [x] BYO `EXTERNAL_DATABASE_URL` / `EXTERNAL_REDIS_URL` documented in DEPLOY.md + compose
- [x] Settings → Product License UI; expired license blocks discovery/scans, allows admin renew
- [ ] Smoke: issue license on SaaS → apply on on-prem compose → modules/seats enforce

---

## Explicit non-goals

- Qualys proprietary vuln signature engine / ME full patch research lab
- ServiceNow IntegrationHub-class Flow Designer canvas
- App-store notarization without customer code-signing certs
- Rewriting agent in Go
- Kafka/NATS as primary bus (Future-only)
- Permanent remote SuperAdmin into customer on-prem databases

---

## How to update this tracker

1. Complete work → run module acceptance tests in specs 01–06 and playbooks in 08.
2. Check the box here.
3. Move capability status **In-build → Shipped** in [01](01-PRODUCT-OVERVIEW.md).
4. Bump **Last reviewed** on touched specs.
5. Never edit the Cursor plan file; this document is the living tracker.
