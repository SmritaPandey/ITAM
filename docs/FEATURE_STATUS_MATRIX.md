# QS Assets — Feature Status Matrix (M0)

Reconciled against `qs_assets_features_list.html` and backend/frontend audits (2026-07-18).

**Classification legend**
- `Implemented-needs-tests` — code path exists; flip to Shipped only after acceptance tests / smoke
- `Needs-depth` — code present but UX/automation incomplete
- `Needs-live-creds` — requires external IdP / hardware / credentials for live drill
- `Blocked/non-goal` — catalogue explicit non-goal or permanently out of scope

Catalogue statuses below are the **current HTML labels** (not yet flipped). Target after M2+ tests is noted in Classification.

## Credential / hardware request list (for M4)

| Dependency | Needed for | Owner |
|---|---|---|
| Google / Microsoft OAuth client | Live SSO login | User |
| Customer SAML/OIDC IdP metadata | SAML/OIDC group→role drill | User |
| AD/LDAP bind + multi-OU | AD sync live | User |
| AWS / Azure / GCP keys | Cloud connector ingest | User |
| SMTP + IMAP mailbox | Report email + ticket ingest | User |
| Slack / Teams webhook | Notification channels | User |
| RADIUS / switch CoA webhook | NAC quarantine drill | User |
| Traccar / OsmAnd device | Fleet GPS ingest | User |
| ONVIF camera + ffmpeg host | CCTV HLS / video wall | User |
| NetFlow / sFlow exporter | Top talkers live | User |
| NVD API key | CVE ingest rate limits | User |
| Meilisearch URL + key | Global Cmd+K search | Ops |
| Ollama / vLLM endpoint | AI assistant live | User |
| Stripe / Razorpay (if billed) | Payments | User |

## Non-shipped rows (48)

| Domain | Feature | Catalogue status | Classification | Primary code |
|---|---|---|---|---|
| ITAM | Attestation campaigns | Shipped | Shipped (acceptance tests) | `assets.service.ts` AssetAttestation |
| ITAM | Depreciation jobs + finance reports | Partial / In-build | Implemented-needs-tests | `assets.service.ts` calculateDepreciation |
| ITAM | RFID / NFC tag + scan | Partial / In-build | Implemented-needs-tests | `findByRfid`, `/scan` |
| ITAM | License harvest → reclaim ticket | Shipped | Shipped (acceptance tests) | `software.service.ts` harvest/reclaim |
| EAM | Facility dashboard | Shipped | Shipped (acceptance tests) | `eam.service.ts` |
| EAM | PM schedules → auto WO | Shipped | Shipped (acceptance tests) | `MaintenanceSchedule` + cron |
| EAM | Spare parts min-stock alerts | Partial / In-build | Implemented-needs-tests | `SparePart` |
| EAM | Consumables reorder alerts | Partial / In-build | Implemented-needs-tests | `Consumable` |
| EAM | Floor plan URL + pin coords | Partial / In-build | Needs-depth | asset pin fields / facility UI |
| Discovery | Remote terminal / shell assist | Partial | Needs-depth | ScriptLibrary-only (security hardened) |
| Discovery | MQTT / Modbus / BACnet probes | Partial | Needs-live-creds | `iot/*` |
| Discovery | License blacklist/whitelist on endpoints | Partial / In-build | Implemented-needs-tests | `software.service.ts` enforceBlacklist |
| Discovery | Authenticated patch inventory for CVE | Partial / In-build | Needs-depth | agent inventory + patches |
| NMS | Config approve-and-push | Shipped | Shipped (acceptance tests) | `network-config.controller.ts` |
| NMS | Syslog UDP → alert/ticket | Shipped | Shipped (acceptance tests) | `syslog-receiver.service.ts` |
| NMS | NetFlow / sFlow / IPFIX | Partial / In-build | Needs-depth | `netflow-collector.service.ts` |
| NMS | LLDP / CDP enrichment | Partial / In-build | Needs-depth | `topology.service.ts` |
| NMS | NOC dashboard | Shipped | Shipped (acceptance tests) | `monitoring.controller.ts` NOC |
| Security | Agent-reported missing patches | Shipped | Shipped (acceptance tests) | `processAgentPatchReport` |
| Security | Live winget/apt/brew sync | In-build | Needs-depth | scans API host; agent path preferred |
| Security | Critical CVE → auto ticket | In-build | Implemented-needs-tests | `vulnerabilities.service.ts` |
| Security | RADIUS CoA / switch webhook | In-build | Needs-live-creds | `nac.service.ts` webhook proxy |
| Security | Threat Approve/Quarantine/Block + WS | Partial | Needs-depth | NAC + Socket.io |
| ITSM | SLA escalation cron | In-build | Implemented-needs-tests | `sla.service.ts` |
| ITSM | CSAT on resolve | In-build | Implemented-needs-tests | `tickets.service.ts` csat |
| ITSM | SSDLC 9-step change gates | In-build | Needs-depth | `changes.service.ts` |
| ITSM | IMAP email → ticket | In-build | Needs-live-creds | `email-ingest.service.ts` (imapflow) |
| ITSM | Catalog approval enforcement | Partial | Needs-depth | `service-catalog` |
| ITSM | KB suggestions on create | Partial | Needs-depth | `knowledge-base` |
| CMDB | CI data quality / attestation | Partial | Needs-depth | `cmdb` + attestation |
| CMDB | Impact analysis drilldown | Partial / In-build | Implemented-needs-tests | `getImpactAnalysis` BFS |
| CMDB | Business service health rollup | Shipped | Shipped (acceptance tests) | BusinessService cron |
| SAM | Software metering last-used | Shipped | Shipped (acceptance tests) | `software.service.ts` |
| SAM | Blacklist/whitelist on agents | In-build | Implemented-needs-tests | enforceBlacklistToAgents |
| SAM | Harvest + reclaim workflow | Shipped | Shipped (acceptance tests) | harvest/reclaim |
| Fleet | Geofence / speed / idle alerts | In-build | Implemented-needs-tests | `fleet.service.ts` (JSON→models in M1) |
| Fleet | Traccar GPS ingest | Shipped | Shipped (acceptance tests) | fleet ingest endpoint |
| Fleet | Maintenance due from EAM on fleet | In-build | Needs-depth | EAM + fleet linkage |
| CCTV | Multi-camera video wall | In-build | Needs-depth | `camera-hls` + UI |
| CCTV | Tamper / offline camera alerts | In-build | Needs-depth | monitoring + alerts |
| VDI | Session resource charts over time | In-build | Needs-depth | `vdi-hypervisor` + DeviceMetricsHistory |
| Automation | Notification digest / batched | In-build | Needs-depth | `notifications.service.ts` |
| Automation | Visual workflow builder polish | Partial | Needs-depth | automation UI |
| Reports | Scheduled report email delivery | Shipped | Shipped (acceptance tests) | `reports.service.ts` cron |
| Reports | Custom saved-filter reports | In-build | Needs-depth | reports module |
| Reports | Global search Cmd+K / Meilisearch | Partial | Needs-live-creds | `search.service.ts` |
| Reports | Role-specific dashboards (8 roles) | In-build | Needs-depth | web dashboards / spec/06 |
| Platform | MFA TOTP | Partial / In-build | Needs-live-creds | `mfa.service.ts` + specs |
| Platform | SAML 2.0 / OIDC SSO | Partial / In-build | Needs-live-creds | `sso.service.ts` + specs |
| Platform | Postgres RLS tenant isolation | Partial / In-build | Needs-depth | `withTenant` expand M1 |

## Counts (post M0–M6 execution, 2026-07-18)

| Classification | Count (approx) |
|---|---|
| Shipped (acceptance tests / depth verified) | majority of prior Partial rows — see HTML |
| Remaining Partial / In-build in HTML | ~18 feature rows |
| Needs-live-creds (blocked) | MFA/SSO live IdP, IMAP, RADIUS, Meilisearch, cloud/AD, cameras — see `LIVE_INTEGRATION_BLOCKERS.md` |
| Needs-depth (remaining) | floor plans, remote terminal polish, SSDLC gates depth, KB suggest, catalog approval, workflow builder polish, saved-filter reports, winget host-scan honesty |

## Working rule

Do **not** mark catalogue HTML/DOCX as Shipped until the corresponding acceptance test or M4 live drill passes. M1 hardening (RLS, models) does not by itself flip status.

## Deploy smoke (M6)

- API: `https://api-production-fe27.up.railway.app/api/v1/health` → healthy; `/health/ready` → database up
- Web: `https://www.qsasset.com` 200; `/login` 200; `/trust` → `/security`; `/status` 200
- Jest: 197 tests green; API + web `tsc --noEmit` clean
