# QS Assets — Gap-Closure Implementation Prompt
# Use with Cursor / coding agents. Scope: EXISTING SOLUTION ONLY.

## Mission
Close confirmed security and compliance gaps in the existing QS Assets codebase
(`/Users/smrita/Documents/Projects/Asset`) so the product is closer to ISO/IEC 27001,
ISO/IEC 27701, ISO/IEC 20000-1, SOC 2 Type II, OWASP ASVS L2, CERT-In, RBI CSF, and
DPDP Act expectations — WITHOUT adding new commercial modules or rewriting working features.

## Absolute constraints
1. Preserve all existing business logic, APIs, UI routes, and module behavior unless a
   change is required to close a listed gap.
2. Implement ONLY items in the Gap Backlog below (or items that are strict prerequisites).
3. Prefer additive, backward-compatible changes (migrations, feature flags, redaction layers).
4. Do not invent Qualys-class vuln signatures, ServiceNow Flow Designer, Kafka bus, or
   other explicit non-goals from the feature list.
5. Every change must include: code + tests (or clear manual test notes) + short security note.
6. Never commit secrets. Never weaken auth/throttles to “make demos easier.”

## Already completed (do not redo)
- Login outage: Railway zombie restart
- Auth: SAML ACS tenant binding, OIDC tenantIdHint, safer OAuth linking
- JWT: honor JWT_EXPIRATION (no 4h floor); agent role no longer elevates to Tenant Admin
- API key: removed tenant-UUID fallback
- Refresh: SHA-256 lookup; password reset hash + session revoke
- Webhooks: Stripe/Razorpay fail-closed in production if secret missing
- RLS interceptor: clear tenant GUC after request
- Agent command history / result writes: tenant-scoped
- OAuth: one-time exchange code (+ temporary dual-compat tokens during web rollout)
- Shutdown hard timeout; WebSocket CORS + status checks

## Gap backlog (priority order)

### P0 — Security (this sprint)
1. **Secret redaction:** Never return hypervisor passwords, SNMP communities, AD bind
   passwords, or vault material from settings / monitoring / discovery APIs. Store via
   credential vault; expose `hasPassword` / masked values only.
2. **Ticket IDOR / internal notes:** Enforce requester/assignee (or IT roles) on ticket
   read; strip `isInternal` comments for Employees; ignore `isInternal` unless agent/admin.
3. **Remote shell:** Prefer ScriptLibrary allowlist only; remove/disable free-form shell
   for agents; dual-control for high-risk scripts.
4. **FILE_PULL:** Canonicalize paths; allowlist roots; block SSH keys/home secrets;
   tenant-scope all history reads/writes.
5. **Agent AUTO_UPDATE:** Require Ed25519/HMAC signature + checksum; reject arbitrary
   downloadUrl hosts.
6. **OAuth URL tokens:** After web is on code-exchange everywhere, remove `token`/`refresh`
   query params from Google/MS/OIDC/SAML redirects.
7. **Sessions:** Plan HttpOnly Secure cookie auth (or document risk acceptance + CSP/XSS
   hardening if staying on localStorage).
8. **RLS:** Migrate hot paths to `prisma.withTenant()`; prove no cross-tenant leakage with tests.
9. **Contact / agent rate limits:** IP+email throttles; stop blanket `@SkipThrottle` on agent
   ingest — rate-limit per agentId/token instead.
10. **changePassword:** Split self-service vs admin reset; remove `*` role short-circuit abuse.

### P1 — Compliance evidence (productize existing)
11. Trust Center page: security whitepaper, subprocessors, status, responsible disclosure.
12. CIS evidence pack PDF export (feature list gap).
13. Immutable audit export + retention policy config (align CERT-In log retention).
14. DPDP: privacy notice, consent records where needed, data subject request workflow stub,
    retention/deletion job for telemetry.
15. AI (ISO 42001 light): log AI prompts/responses metadata, admin kill-switch, disclaimer
    that AI is assistive not authoritative.
16. MFA/SAML/OIDC: finish acceptance tests; encrypt SSO client secrets at rest with
    VAULT_ENCRYPTION_KEY; Redis-backed OIDC state when Redis available.
17. Patch maturity: deploy rings UI, rollback, air-gap bundle workflow (partial → shipped).
18. Change Mgmt: CAB calendar + approval gates (ISO 20000 / ITIL).

### P2 — Market readiness hygiene
19. SBOM generation in CI; signed release artifacts for agent packages.
20. WCAG 2.1 AA pass on login/register/dashboard critical paths.
21. Formal BCP/DR runbook + restore drill checklist committed under `docs/`.
22. Public vulnerability disclosure policy + security@ mailbox routing.

## Implementation rules
- Match existing NestJS / Next.js / Prisma patterns.
- Add OpenAPI notes for changed endpoints.
- Redaction helpers: centralize in one module (e.g. `common/security/redact.ts`).
- For every P0 fix: add a regression test that fails if secrets reappear in JSON.
- Deploy API to Railway and web to Vercel only after tests pass; verify `/health` healthy.

## Out of scope
New modules, marketing site redesign, purchasing ISO certificates, rewriting auth to a
new IdP product, or expanding beyond listed gaps.

## Definition of done
- All P0 items merged or explicitly risk-accepted with owner+date.
- `npx tsc --noEmit` clean in apps/api.
- Manual checklist: login, OAuth, agent heartbeat, ticket employee isolation, settings
  response contains no plaintext secrets.
- Update `qs_assets_features_list.html` statuses where Partial → Shipped for closed items.
