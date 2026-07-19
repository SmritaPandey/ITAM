# Live integration blockers (M4)

Items that cannot be marked Shipped without credentials or hardware you supply.
Until provided, status remains **Blocked: awaiting credential/hardware**.

Drill date: 2026-07-18. No customer secrets were available in-session; drills are parked.

| Item | Blocker | Status | Notes |
|---|---|---|---|
| Google / MS OAuth | Client ID/secret + redirect URIs | Blocked | Code + unit coverage present |
| SAML / OIDC IdP | Metadata URL, certs, group claims | Blocked | `sso.service.spec.ts` / `sso.flow.spec.ts` green |
| AD / LDAP sync | Bind DN, password, base DNs | Blocked | `ad-sync.service.ts` present |
| Azure / GCP / AWS | Cloud credentials | Blocked | `cloud-connectors.service.ts` present |
| SMTP report delivery | — | **Shipped** | Hostinger SMTP live on prod API (`support@neurqai.com`); test send verified 2026-07-19 |
| IMAP ticket ingest | IMAP host + mailbox | Blocked | Requires `imapflow` + mailbox; see `/health/capabilities` |
| Slack / Teams | Webhook URLs | In progress | Slack signup pending human captcha; Teams needs M365 tenant |
| RADIUS CoA | Switch webhook or RADIUS secret | Blocked | Webhook proxy + agent firewall fallback |
| Traccar GPS | Device + protocol endpoint | Blocked | Ingest endpoint present |
| ONVIF / HLS | Camera + ffmpeg on API host | Blocked | Probe via `/health/capabilities` |
| NetFlow exporters | Lab exporter → collector port | Blocked | Collector + top-talkers UI present |
| Meilisearch | — | **Shipped** | Railway Meilisearch service live; `MEILI_HOST`/`MEILI_MASTER_KEY` on prod API (2026-07-19) |
| AI assistant | — | **Shipped** | Groq (`llama-3.3-70b-versatile`) live via `AI_*` vars on prod API (2026-07-19) |
| NVD rate limits | — | **Shipped** | `NVD_API_KEY` activated + verified live, set on prod API 2026-07-19 |

## What was validated without external secrets
- API Jest suite: 149 tests green (includes MFA/SSO unit flows, CVE→ticket, SLA, CSAT, geofence geometry, cron-parser).
- Optional capability probe endpoint: `GET /health/capabilities`.
- Prod health (when API reachable): use smoke in M6.

When you are ready for a drill, reply with the credential set for that row and we will re-run live acceptance.
