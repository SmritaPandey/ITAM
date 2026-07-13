# QS Assets — Architecture & Tech Stack

| Field | Value |
|-------|-------|
| **Product** | QS Assets |
| **Last reviewed** | 2026-07-13 |
| **Status** | Living PRD |
| **Depends on** | [01](01-PRODUCT-OVERVIEW.md) |

---

## Philosophy

**Domain-driven modular monolith** with event-driven boundaries, designed for later microservice extraction. One deployable NestJS API owns domains (assets, discovery, tickets, monitoring, …) behind clean modules; the Next.js web and Node agent are separate clients.

**Rationale:** Enterprise ITAM/ITSM breadth needs shared transactions and a single CMDB more than a service mesh on day one. Interfaces (`EventBusService`, Prisma, Redis queues) keep extraction options open.

---

## As-built high-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Presentation                                                     │
│  Next.js App Router (apps/web)  ·  Electron tray (agent-desktop) │
│  Portal /scan PWA  ·  Swagger at API                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS + Socket.io
┌────────────────────────────▼────────────────────────────────────┐
│ NestJS API (apps/api)                                            │
│  Auth/SSO · Assets/CMDB · Discovery · Monitoring · Tickets       │
│  Patches · Vulns · Licenses · Automation · Alerts · Reports      │
│  Fleet · CCTV/HLS · VDI · Compliance · Admin · IoT/MQTT          │
│  Shared: EventBus · Audit interceptor · Tenant context · Vault   │
└──────────────┬─────────────────┬──────────────────┬─────────────┘
               │                 │                  │
        PostgreSQL+PostGIS    Redis/Bull      Meilisearch (search)
               │
        Node Discovery Agent (agent/) ←──── MSI/PKG/DEB / services
```

**Not as-built (Future-only):** Kong gateway, Kafka/NATS primary bus, Timescale/Influx/ClickHouse as required stores, GraphQL layer, Go discovery rewrite.

---

## Monorepo layout

| Path | Role |
|------|------|
| `apps/api` | NestJS + Prisma |
| `apps/web` | Next.js dashboard + marketing + portal |
| `apps/agent-desktop` | Electron tray UI |
| `agent/` | Canonical zero-dep discovery agent + packaging |
| `packages/*` | Shared libs when present |
| `docker-compose.yml` | PostGIS :5434, Redis :6380, Meilisearch :7700, optional Ollama |
| `infra/` | DB init extensions (PostGIS) |

Workspaces: npm + Turborepo.

---

## Tech stack (authoritative)

### API

| Component | Choice | Notes |
|-----------|--------|-------|
| Runtime | Node.js 20+ / TypeScript | — |
| Framework | NestJS | Modules, guards, DI, websockets |
| ORM | **Prisma** | Schema is source of truth → [05](05-DATABASE-SCHEMA.md) |
| API | **REST** primary | OpenAPI/Swagger |
| Realtime | Socket.io + Nest gateway | JWT handshake; rooms `tenant:<id>` |
| Events | In-process `EventBusService` | Wildcard → WS bridge |
| Jobs | `@nestjs/schedule` + **Redis/Bull** when Redis configured | Scans, NVD, AD, NetFlow rollups |
| Validation | class-validator / Zod where used | All mutating endpoints validated |
| Auth | JWT + refresh · Passport Google/MS · SSO SAML/OIDC (In-build depth) · MFA TOTP In-build | — |

### Web

| Component | Choice |
|-----------|--------|
| Framework | Next.js App Router |
| Styling | Tailwind + existing design system (`PageHeader`, `EmptyState`) |
| Data | `apiFetch` / `safeFetch` in `lib/api.ts` |
| Realtime | `socket.io-client` + `useRealtimeEvents` |

### Agent

| Component | Choice |
|-----------|--------|
| Language | **Node.js** (permanent as-built) |
| Desktop | Electron tray |
| OS services | Windows Service, LaunchDaemon, systemd |
| Packages | MSI / PKG / DEB (+ RPM stage) |

### Data & infra

| Component | Choice | Status |
|-----------|--------|--------|
| Primary DB | PostgreSQL 16 + **PostGIS** image | Shipped |
| Cache / queue | Redis 7 | Shipped locally; required for enterprise jobs |
| Search | Meilisearch | In-build wiring for Cmd+K |
| Object storage | Local / S3-compatible as configured | Optional |
| RLS | Postgres RLS + `SET app.current_tenant` via Prisma middleware | **Required** In-build |
| GPS | lat/lng floats + raw PostGIS queries where needed | Shipped |

### Future-only (explicit)

| Item | Label |
|------|-------|
| Kafka / NATS as primary event bus | Future-only |
| GraphQL for dashboards | Future-only |
| Go SNMP/discovery rewrite | Future-only |
| Mobile React Native app | Future-only |
| Full ServiceNow-class Flow Designer canvas | Non-goal |

---

## Tenancy & security architecture

1. Every business row carries `tenant_id`.
2. Application layer filters by JWT tenant (as-built).
3. **Must-ship:** Postgres RLS policies deny cross-tenant reads even if a query omits filter; Prisma middleware sets `app.current_tenant` per request.
4. Audit interceptor writes hash-chained `AuditLog` ([04](04-SSDLC-COMPLIANCE-SECURITY.md)).
5. Secrets: env + encrypted credential columns (`ScanCredential`, `CloudConnector.encryptedCreds`); never in git.

---

## Realtime & jobs

```
Domain service → EventBus.emit(...)
                      ├→ in-process listeners (automation, alerts)
                      └→ Socket.io gateway → tenant rooms
Heavy work → Bull queue (scan, NVD ingest, AD sync, NetFlow rollup, email)
```

If Redis is down in production Enterprise, health check must surface degraded jobs — do not silently drop Must-ship batch work without alerting.

---

## Deployment

| Environment | Target |
|-------------|--------|
| Local | Docker PostGIS/Redis/Meili + `apps/api` + `apps/web` |
| API prod (SaaS) | Railway (`apps/api` Dockerfile / railway.json), `DEPLOYMENT_MODE=saas` |
| Web prod (SaaS) | Vercel (`apps/web`, `NEXT_PUBLIC_API_URL`) |
| On-prem / BYO | `docker-compose.prod.yml` or bare metal; customer `DATABASE_URL` / `REDIS_URL`; `DEPLOYMENT_MODE=onprem` |
| Agent | Customer endpoints via Discovery downloads |

### Product licensing hybrid

- SaaS SuperAdmin issues `ProductLicense` records and signed `.lic` files (`LICENSE_PRIVATE_KEY`).
- On-prem verifies with `LICENSE_PUBLIC_KEY`; stores `InstanceEntitlement`; enforces seats/modules/expiry via metering + module guard.
- Online activate: `POST /product-licenses/activate` on NeurQ SaaS; offline: upload `.lic` on customer Settings.

CORS must allow web origin; OAuth/SSO redirect URIs must match. Runbook: `DEPLOY.md` (no secrets). On-prem: `ONPREM-INSTALL.md`.

---

## Scalability defaults

- Indexed tenant composites on assets, tickets, vulns, metrics history.
- Cursor/offset pagination on list APIs.
- Batch upserts for discovery and metrics.
- SNMP poll interval ≥ 5 min; trap/syslog UDP collectors bounded.
- Agent inventory payload size capped; software list truncated then paginated if expanded.

---

## Acceptance tests — architecture

1. `docker compose up` → Postgres healthy; `prisma migrate deploy` + seed succeeds.
2. API `/health` and `/health/ready` pass with DB (+ Redis when configured).
3. Login → Socket.io connects to `tenant:<id>`; asset create pushes dashboard event.
4. With RLS enabled, raw SQL without tenant GUC returns zero rows for other tenants.
5. Bull job processes a scan when Redis up; documented fallback only in local STARTER/dev.
6. No GraphQL or Kafka required for any Must-ship acceptance path.
