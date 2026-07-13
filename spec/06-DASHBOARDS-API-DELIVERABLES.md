# QS Assets — Dashboards, API & Deliverables

| Field | Value |
|-------|-------|
| **Product** | QS Assets |
| **Last reviewed** | 2026-07-13 |
| **Status** | Living PRD |
| **Depends on** | [01](01-PRODUCT-OVERVIEW.md)–[05](05-DATABASE-SCHEMA.md) |

---

## API principles

- REST under Nest controllers (global prefix as deployed; typically `/` or `/api`).
- JSON bodies; standard HTTP codes; tenant from JWT.
- Pagination + filters on list endpoints.
- Rate limits per tenant / API key.
- OpenAPI via Swagger in non-prod (and protected prod if enabled).
- **No mocks:** empty arrays and operational errors when deps missing.

---

## Eight role dashboards → routes

Compose existing APIs; dedicated widgets In-build where noted.

### 1. Executive / Tenant Admin

| Widget | API / source | Route |
|--------|--------------|-------|
| Assets by category | `GET /assets/stats`, reports executive | `/dashboard` |
| Open tickets by priority | `GET /tickets/stats` | `/dashboard` |
| Patch / vuln summary | patches + vulnerabilities | `/dashboard` |
| License utilization | `GET /licenses` / reports | `/dashboard/licenses` |
| Top alerts | `GET /alerts/dashboard` | `/dashboard/alerts` |
| Cost / depreciation | reports finance (In-build) | `/dashboard/reports` |

**Pass:** Executive sees live counts within 30s of Socket.io refresh; no placeholder charts with random data.

### 2. IT Admin

| Widget | Route |
|--------|-------|
| Discovered vs managed, agents health | `/dashboard/discovery` |
| New devices 24h/7d | `/dashboard/discovery` |
| Patch compliance + critical missing | `/dashboard/patches` |
| Security posture / vulns | `/dashboard/vulnerabilities`, `/dashboard/compliance` |
| Software / licenses | `/dashboard/software`, `/dashboard/licenses` |

**Pass:** Agent offline &gt; threshold surfaces alert; scan job progress via WS.

### 3. NOC

| Widget | Route |
|--------|-------|
| Topology map | `/dashboard/network` |
| Device health grid | `/dashboard/network` |
| Alarms + trap/syslog stream | `/dashboard/network`, `/dashboard/alerts` (In-build syslog) |
| Top interfaces / talkers | `/dashboard/network` (In-build NetFlow) |
| Config drift | `/dashboard/network/configs` |

**Pass:** SNMP metrics chart from `DeviceMetricsHistory`; traps live; empty NetFlow state until exporters configured.

### 4. Fleet Manager

| Widget | Route |
|--------|-------|
| Live map + trips | `/dashboard/fleet` |
| Geofence / speed / idle alerts | `/dashboard/fleet`, `/dashboard/alerts` (In-build) |
| Maintenance due | fleet + work-orders (In-build EAM link) |

**Pass:** Telemetry updates map; geofence breach creates AlertEvent.

### 5. IT Service Desk

| Widget | Route |
|--------|-------|
| Queue by status / mine | `/dashboard/tickets` |
| SLA at risk | `/dashboard/tickets` |
| Changes / problems | `/dashboard/changes`, `/dashboard/problems` |
| KB + catalog | `/dashboard/knowledge-base`, `/dashboard/service-catalog` |
| CSAT | tickets (In-build) |
| Work orders | `/dashboard/work-orders` |

**Pass:** SLA escalation fires; CSAT stored on resolve; catalog approval enforced.

### 6. Security

| Widget | Route |
|--------|-------|
| Vuln severity distribution | `/dashboard/vulnerabilities` |
| Compliance score | `/dashboard/compliance` |
| CCTV status / wall | `/dashboard/cctv` |
| NAC / rogue | `/dashboard/nac` |
| Audit integrity | `/dashboard/audit-logs` |
| Scanning capabilities | `/dashboard/scanning` |

**Pass:** Critical CVE auto-ticket path; audit verify; threat actions push WS.

### 7. Employee self-service

| Widget | Route |
|--------|-------|
| My assets | `/dashboard/my-portal`, `/portal/*` |
| Raise request / ticket | portal + service catalog |
| Ticket history | portal |
| KB search | portal / KB |
| Check-in/out | portal / assets |
| Mobile scan | `/scan` PWA |

**Pass:** Employee sees only assigned assets; request creates ticket; QR scan resolves asset.

### 8. Facility Manager

| Widget | Route |
|--------|-------|
| Non-IT inventory | `/dashboard/non-it-assets` |
| Floor pins | facility UI (In-build) |
| PM calendar + WOs | `/dashboard/work-orders` |
| Spares / consumables low stock | facility widgets (In-build) |
| Vendors | `/dashboard/procurement` |

**Pass:** Pin overlay; PM → WO; min-stock alert.

---

## REST catalog (as-built modules)

Representative groups — controllers under `apps/api/src/modules/*`. Expand as routes ship; keep Swagger accurate.

| Area | Prefix / examples |
|------|-------------------|
| Auth | `POST /auth/login`, `refresh`, `logout`, `register`, OAuth |
| SSO | `sso/*` (SAML ACS, OIDC) |
| Users / tenants | `users/*`, `tenants/me`, settings |
| Assets | `assets/*`, `asset-types/*`, checkout, attestation, import |
| Discovery | `discovery/*` (jobs, agents, credentials, schedules, downloads) |
| Cloud | `cloud-connectors/*` |
| IoT | MQTT config/telemetry controllers |
| Monitoring | `monitoring/network`, SNMP, traps, nmap, cameras, HLS, VDI |
| Network configs | `monitoring` network-config routes |
| Scanning | `scanning/*` |
| NAC | discovery NAC routes |
| Tickets / WO | `tickets/*`, work-orders |
| Changes / problems | `changes/*`, `problems/*` |
| Patches | `patches/*` |
| Vulnerabilities | `vulnerabilities/*` |
| Licenses / software | `licenses/*`, `software/*` |
| Automation / scripts | `automation/*`, `automation/scripts/*` |
| Alerts | `alerts/*` |
| Notifications | `notifications/*` |
| Reports | `reports/*`, generate/download/schedules |
| Compliance | `compliance/*` |
| Procurement | `procurement/*` |
| Fleet | fleet / GPS routes |
| Knowledge / catalog | `knowledge-base/*`, `service-catalog/*` |
| Audit | `audit-logs/*` (+ verify) |
| Admin | `admin/*` |
| Health | `health`, `ready`, `live`, `detailed` |
| Risk / analytics | `risk/*`, `analytics/*` |
| Setup / contact / payments | setup, contact, payment webhooks |

**In-build additions:** MFA challenge endpoints; NetFlow/syslog ingest; CAB/CSAT; EAM spares/PM; BusinessService impact; Traccar ingest; global search.

---

## Frontend route inventory (dashboard)

| Route | Module |
|-------|--------|
| `/dashboard` | Home / executive compose |
| `/dashboard/my-portal` | Employee |
| `/dashboard/assets`, `it-assets`, `non-it-assets`, `assets/[id]`, `import` | ITAM/EAM |
| `/dashboard/cmdb` | CMDB |
| `/dashboard/tickets`, `tickets/[id]` | ITSM |
| `/dashboard/work-orders` | WO |
| `/dashboard/discovery` | Discovery |
| `/dashboard/patches` | Patch |
| `/dashboard/vulnerabilities` | Vuln |
| `/dashboard/network`, `network/configs` | NMS |
| `/dashboard/scanning` | Security scan |
| `/dashboard/compliance` | Compliance |
| `/dashboard/nac` | NAC |
| `/dashboard/procurement` | Procurement |
| `/dashboard/changes`, `problems` | ITIL |
| `/dashboard/fleet`, `cctv`, `vdi` | Ops |
| `/dashboard/automation` | Automation |
| `/dashboard/licenses`, `software`, `software-deploy` | SAM |
| `/dashboard/knowledge-base`, `service-catalog` | Self-service |
| `/dashboard/reports`, `alerts`, `users`, `audit-logs`, `settings`, `help` | Platform |
| `/dashboard/intelligence`, `remote-terminal` | Advanced |
| `/scan` | Label scan PWA |
| `/portal/*` | Employee portal |
| `/admin/*` | Platform admin |

---

## Deliverables pass/fail checklist

### Platform

- [ ] Docker PostGIS + Redis healthy; migrate + seed
- [ ] API health green; web login works against API
- [ ] Socket.io tenant rooms deliver events
- [ ] RLS enabled on tenant tables
- [ ] CI lint/typecheck/test/build green

### Discovery / UEM

- [ ] Agent Desktop / Service / ZIP paths work
- [ ] WMI/SSH/SNMP enrich real data
- [ ] AWS sync; Azure + GCP non-stub
- [ ] AD sync merge-safe
- [ ] MQTT + ONVIF; Modbus/BACnet flagged honestly

### ITAM / EAM

- [ ] Depreciation mass run + report
- [ ] Checkout + attestation campaigns
- [ ] PM + spares + consumables + floor pins + RFID scan

### NMS / security

- [ ] Traps + syslog → alert/ticket
- [ ] NetFlow top talkers when exporter present
- [ ] Vuln match + critical ticket
- [ ] Patch rings + rollback
- [ ] CIS evidence export
- [ ] MFA + SAML + NAC CoA/fallback

### ITSM / UX

- [ ] CAB + SSDLC gates + CSAT + email ingest
- [ ] All 8 role dashboards usable
- [ ] No “Coming soon” where backend exists
- [ ] `/scan` installable PWA meta
- [ ] Production Railway + Vercel healthy (CORS/OAuth)

---

## Acceptance tests — dashboards & API

1. Each of the 8 roles can complete primary job on mapped routes with seeded data.
2. `GET /reports/generate/executive?format=pdf` returns non-empty PDF.
3. Unauthorized role receives 403 on admin routes.
4. OpenAPI lists new Must-ship endpoints when shipped.
5. Pass/fail checklist items checked in [07](07-GAP-REMEDIATION-PLAN.md) as phases complete.
