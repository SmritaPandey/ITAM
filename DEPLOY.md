# QS Assets — Production Deploy Runbook

Product: **QS Assets** (NeurQ AI Labs)  
Stack: NestJS API (Railway) + Next.js web (Vercel) + Postgres/PostGIS + Redis (+ optional Meilisearch)

This runbook contains **no secrets**. Set real values in Railway / Vercel dashboards or CLI.

## Prerequisites

- Railway CLI (`railway`) — `railway whoami`
- Vercel CLI (`vercel`) — `vercel whoami`
- Docker Desktop for local PostGIS / Redis / Meilisearch
- Linked Railway project (prefer existing): `asset-command-api`, service `api`, env `production`

## Local platform

```bash
docker compose up -d postgres redis meilisearch
cp apps/api/.env.example apps/api/.env
# DATABASE_URL=postgresql://assetcommand:assetcommand_dev@localhost:5434/assetcommand?schema=public
# REDIS_URL=redis://localhost:6380
cd apps/api && npx prisma migrate deploy && npx prisma generate
# Seed only on empty DB: FORCE_SEED=true npx ts-node prisma/seed.ts
npm run start:dev   # API :4100
cd ../web && npm run dev
```

Optional collectors (local / prod — off by default):

| Env | Purpose |
|-----|---------|
| `ENABLE_SNMP_TRAPS=true` | SNMP trap UDP |
| `ENABLE_SYSLOG=true` | Syslog UDP (`SYSLOG_UDP_PORT`, default 5514) |
| `ENABLE_NETFLOW=true` | NetFlow UDP (`NETFLOW_UDP_PORT`, default 2055) |
| `MODBUS_PROBE_ENABLED=true` | Modbus TCP probes |
| `BACNET_PROBE_ENABLED=true` | BACnet/IP probes |

**Performance / reliability (production):**

| Env | Purpose |
|-----|---------|
| `REDIS_URL` | **Recommended on Railway** — MFA challenges, job queue, AI cache. Without it, those features run in-process only. |
| Healthcheck | Railway uses `/api/v1/health/live` (no DB). `/api/v1/health` includes a 2s DB ping. |

Prisma URL params are auto-appended if missing: `connection_limit=10`, `pool_timeout=10`, `connect_timeout=5`, `statement_timeout=15000`.

## Railway (API)

**Deploy from the monorepo root** (not `apps/api` alone). Service root directory is `apps/api`; the upload snapshot must include `apps/api/...`.

```bash
# From repo root
railway link   # project: asset-command-api, service: api, environment: production
railway up --service api -m "Phase 10 enterprise deploy"
```

Do **not** `railway up` from inside `apps/api` only — builds fail with `lstat .../apps: no such file or directory`.

Build uses `apps/api/Dockerfile` + `apps/api/railway.json` (`DOCKERFILE` builder).

### Prisma migrate on production

Migrations run automatically in `apps/api/docker-entrypoint.sh` via `prisma migrate deploy` (falls back to `db push` if needed).

Manual one-off (with linked service + `DATABASE_URL`):

```bash
cd apps/api
railway run --service api npx prisma migrate deploy
```

### Required / important API env vars (Railway → api → production)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Postgres (usually Railway reference to Postgres service) |
| `REDIS_URL` | Redis URL if job queues / cache enabled |
| `JWT_SECRET` | Strong random; required |
| `JWT_EXPIRATION` / `JWT_REFRESH_EXPIRATION` | e.g. `4h` / `7d` |
| `VAULT_ENCRYPTION_KEY` | 32+ byte secret for credential vault |
| `APP_URL` | Public **web** origin (Vercel URL), used for OAuth redirects |
| `CORS_ORIGIN` | Comma-separated web origins (must include Vercel production + preview if used) |
| `OAUTH_CALLBACK_URL` | Optional override for API OAuth callback base |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Optional Microsoft OAuth |
| `SSO_SAML_*` / `OIDC_*` | Optional enterprise SSO |
| `NVD_API_KEY` | Optional NVD rate-limit key |
| `MEILI_HOST` / `MEILI_MASTER_KEY` | Search (if provisioned) |
| `NODE_ENV` | `production` |
| `PORT` | Usually set by Railway |

Full template: [`apps/api/.env.example`](apps/api/.env.example).

### Production API URL

- Default service domain: `https://api-production-fe27.up.railway.app`
- Health: `GET /api/v1/health` → `curl -sS https://api-production-fe27.up.railway.app/api/v1/health`

## Vercel (Web)

```bash
cd apps/web
vercel link          # existing QS Assets / asset web project
vercel env add NEXT_PUBLIC_API_URL production
# value must be: https://api-production-fe27.up.railway.app/api/v1
# (or your custom API domain + /api/v1)
vercel --prod
```

Also set any server-only web env from [`apps/web/.env.example`](apps/web/.env.example) as needed.

### Canonical host & Search Console

1. **Canonical domain** is `https://www.qsasset.com` (Vercel production alias). Point apex `qsasset.com` → `www.qsasset.com` in the Vercel Domains UI (do **not** add a conflicting www→apex redirect in `vercel.json` — that creates a loop).
2. Set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in Vercel to your Google Search Console meta token (omit the env var until you have a real token — the app will not emit a placeholder).
3. After deploy, confirm `https://www.qsasset.com/sitemap.xml` and `https://www.qsasset.com/robots.txt` return 200, then submit the sitemap in Search Console.

### CORS / OAuth alignment

1. **CORS**: On Railway API, `CORS_ORIGIN` must include the exact Vercel production URL (and `www` / preview domains you use), e.g. `https://your-app.vercel.app`.
2. **APP_URL**: Set to the same primary web origin so email/OAuth return links stay on the product UI.
3. **OAuth IdP console**: Google / Microsoft redirect URIs must match the API callback routes (typically under `https://<api-host>/api/v1/auth/...`). SAML ACS / OIDC redirect URIs likewise must match deployed API paths.
4. After changing `CORS_ORIGIN` or OAuth secrets, **redeploy the API** so the running process picks them up.

## Post-deploy checklist

- [ ] `GET /api/v1/health` returns 200
- [ ] Web loads against `NEXT_PUBLIC_API_URL`
- [ ] Browser login works (password; MFA if enforced)
- [ ] CORS: browser network tab shows no blocked origin on API calls
- [ ] `https://qsasset.com/sitemap.xml` returns 200
- [ ] `https://qsasset.com/pricing`, `/security`, `/dpa`, `/sla`, `/status` return 200
- [ ] Agent download endpoints reachable
- [ ] One agentless scan against an **allowed** lab range only
- [ ] Discovery → cloud connectors list
- [ ] Vulnerabilities page loads (NVD empty until ingest is fine)

## Rollback

- Railway: redeploy previous successful deployment from dashboard
- Vercel: promote previous production deployment
- DB: do **not** reset production; forward-fix migrations only

## Notes

- Prisma RLS uses `app.current_tenant` GUC (set per request). Table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is enabled for a non-owner app role.
- Seed refuses to run when real users exist unless `FORCE_SEED=true`.
- Prefer the existing Railway project `asset-command-api`; do not create a duplicate unless intentionally migrating.

---

## Enterprise BYO / on-prem (customer-hosted)

QS Assets supports a **Quick Heal–style** hybrid: the customer hosts API/web + their own Postgres/Redis (LAN or their cloud). NeurQ controls entitlement via signed product licenses (online activation or offline `.lic`). NeurQ SaaS `/admin` issues licenses and manages cloud tenants — it does **not** remotely SuperAdmin customer databases.

### Deploy with bundled DB

```bash
cp .env.onprem.example .env   # set SERVER_IP, secrets, LICENSE_PUBLIC_KEY
SERVER_IP=192.168.1.50 docker compose -f docker-compose.prod.yml up -d --build
```

### Bring-your-own Postgres / Redis

```bash
export EXTERNAL_DATABASE_URL="postgresql://user:pass@dbhost:5432/qsassets?schema=public"
export EXTERNAL_REDIS_URL="redis://redishost:6379"
export DEPLOYMENT_MODE=onprem
export LICENSE_PUBLIC_KEY="..."
export LICENSE_SERVER_URL="https://api.qsasset.com/api/v1"   # optional if offline .lic only
SERVER_IP=192.168.1.50 docker compose -f docker-compose.prod.yml up -d --build api web
```

Migrations run in `apps/api` docker-entrypoint (`prisma migrate deploy`). First empty DB bootstraps org + `OWNER_EMAIL` SuperAdmin + Tenant Admin.

### Activate license

1. NeurQ owner: SaaS `/admin/licenses` → Issue → download `.lic` or copy key.
2. Customer: Settings → **Product License** → upload `.lic` or activate key online.
3. Expired license: admins can still log in to renew; discovery/scans/agent enroll blocked.

### Air-gap

- Offline `.lic` only (no `LICENSE_SERVER_URL`).
- Load images from tar if no registry: `docker load < qsasset-api.tar` etc.
- See [ONPREM-INSTALL.md](ONPREM-INSTALL.md) for bare-metal Node path.
