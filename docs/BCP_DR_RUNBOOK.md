# QS Assets Business Continuity and Disaster Recovery Runbook

## Purpose and ownership

This runbook covers recovery of the managed QS Assets service: PostgreSQL, Redis, the Railway-hosted API, the Vercel-hosted web application, and QS Discovery Agent releases. The Incident Commander (IC) owns activation; the Infrastructure Lead executes recovery; the Security Lead preserves evidence and approves recovery where compromise is suspected; the Communications Lead updates customers and stakeholders.

Review this runbook quarterly and after every material architecture change or recovery event. Store current provider access, escalation contacts, and break-glass credentials in the approved password vault, not in this document.

## Recovery objectives

| Service | Target RTO | Target RPO | Recovery source |
| --- | ---: | ---: | --- |
| PostgreSQL customer data | 4 hours | 24 hours or better | Encrypted provider backup / point-in-time recovery |
| Railway API | 2 hours | Not applicable (stateless) | Last known-good deployment and configuration |
| Vercel web | 2 hours | Not applicable (stateless) | Last known-good deployment |
| Redis queues/cache | 4 hours | Best effort | Managed snapshot where enabled; otherwise rebuild |
| Agent release | 4 hours | Last signed release | Signed, checksummed release archive |

Provider plans and production configuration must be verified to support these targets. If they do not, record the exception, owner, and remediation date in the risk register.

## Activation criteria

Activate this runbook for a regional/provider outage, unrecoverable deployment, destructive data event, integrity compromise, or an outage expected to exceed 30 minutes. Open an incident record, assign roles, record all timestamps and decisions, freeze non-recovery changes, and preserve relevant logs.

Recovery priority is: contain compromise, restore PostgreSQL, restore API, validate Redis-backed workflows, restore web, then validate or roll back agent releases.

## Recovery procedures

### PostgreSQL

1. Confirm the incident scope and stop application writes when continued writes could worsen loss or corruption.
2. Record the desired recovery timestamp and identify the newest verified encrypted backup or point-in-time recovery point before the incident.
3. Restore into a new isolated database instance. Never overwrite the only production copy during a drill.
4. Apply required extensions and schema migrations only after confirming the restored schema version.
5. Validate row counts for critical tables, tenant isolation policies, recent audit events, and representative tenant records.
6. Run application smoke queries with a read-only credential, then switch the Railway `DATABASE_URL` during the approved change window.
7. Restart API instances, monitor errors and connection saturation, and retain the old database read-only until recovery acceptance and rollback expiry.

### Redis

1. Determine whether Redis is acting as cache, queue storage, rate-limit storage, or transient authentication state.
2. Restore the latest managed snapshot when available and integrity is trusted.
3. If no snapshot is available, provision a clean Redis instance, update `REDIS_URL`, and restart the API.
4. Treat in-flight jobs, cached values, OIDC state, and rate-limit counters as lost; reconcile scheduled jobs from PostgreSQL and requeue only idempotent work.
5. Verify queue workers, delayed jobs, WebSocket/event delivery, and authentication flows. Never replay a job whose side effects cannot be proven safe.

### Railway API

1. Confirm Railway service and regional status from an independent channel.
2. Select the last known-good deployment by commit SHA and confirm its image provenance.
3. Verify required variables and references (`DATABASE_URL`, `REDIS_URL`, JWT and vault keys) without copying secret values into the incident record.
4. Roll back or redeploy the known-good build. Do not rotate keys during ordinary rollback unless compromise is suspected.
5. Validate `/health`, authentication, tenant-scoped API access, agent heartbeat, queue workers, and error rates.
6. If Railway is unavailable beyond the RTO, invoke the approved alternate-host procedure and restore from the same immutable source revision and secret vault.

### Vercel web

1. Confirm Vercel status and isolate whether the failure is deployment, configuration, DNS, or upstream API availability.
2. Promote or redeploy the last known-good production deployment.
3. Verify `NEXT_PUBLIC_API_URL`, custom domains, TLS, and security headers.
4. Test login, registration policy, OAuth callback, dashboard load, and a representative API-backed page.
5. If API recovery is incomplete, publish the approved status communication instead of serving a misleading partially functional application.

### Discovery Agent rollback

1. Suspend the affected release/update command and preserve its checksum, signature, version, and deployment-ring history.
2. Select the last known-good artifact whose SHA-256 checksum and Ed25519 signature validate against the trusted public key.
3. Issue rollback through the narrowest affected deployment ring first; require normal change approval for broader rollout.
4. Confirm agent heartbeat, version, command execution, and update verification on canary devices before expansion.
5. Revoke and rotate the release signing key if private-key exposure is suspected. Do not distribute unsigned rollback artifacts.

## Communications and closure

- Post internal updates at least every 30 minutes during a Severity 1 incident.
- Notify affected customers through the approved status channel based on contractual and legal timelines.
- Preserve an evidence timeline, provider tickets, commands, approvals, and validation results.
- The IC closes recovery only after service owners approve integrity and availability checks.
- Complete a blameless post-incident review within 5 business days and track corrective actions to closure.

## Restore drill checklist

Run at least annually and after major persistence or hosting changes.

- [ ] Define drill scope, owner, observers, date, and success criteria.
- [ ] Record current backup retention, encryption, and last successful backup time.
- [ ] Restore PostgreSQL into an isolated environment without modifying production.
- [ ] Record measured restore duration and calculated data-loss window.
- [ ] Validate migrations, extensions, tenant RLS, critical row counts, and audit records.
- [ ] Restore Redis from snapshot or document clean-rebuild behavior.
- [ ] Reconcile queues and prove replayed jobs are idempotent.
- [ ] Redeploy the Railway API from a pinned known-good commit.
- [ ] Confirm `/health`, login, tenant isolation, agent heartbeat, and background jobs.
- [ ] Redeploy or promote the Vercel web application and test critical paths.
- [ ] Verify DNS, TLS, security headers, and web-to-API connectivity.
- [ ] Validate a signed agent artifact, canary rollback, and post-rollback heartbeat.
- [ ] Confirm monitoring and alerting detect both failure and recovery.
- [ ] Capture evidence links, timestamps, participants, RTO/RPO results, and exceptions.
- [ ] Create corrective actions with owners and due dates.
- [ ] Obtain Infrastructure, Security, and business-owner sign-off.

## On-prem appliance notes

For customer-hosted installs use the signed appliance path in [docs/APPLIANCE-INSTALL.md](APPLIANCE-INSTALL.md):

1. `qsassets backup` before any upgrade or recovery.
2. Restore with `qsassets restore <file> --no-confirm` after verifying the backup checksum.
3. Platform updates: verify Ed25519 manifest (`PLATFORM_UPDATE_PUBLIC_KEY`) via `scripts/onprem-updater.sh` before applying compose/image changes; roll back on `/api/v1/health/ready` failure.
4. HA profiles (`docker-compose.ha.yml`) require Redis AOF, sticky sessions for `/realtime`, and a single `collector` replica for UDP listeners.
5. Drill annually: backup → wipe → restore → license status → agent heartbeat.
