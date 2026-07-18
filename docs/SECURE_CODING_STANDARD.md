# QS Assets — Secure Coding Standard

Binding for all code merged to `main`. Aligned to OWASP ASVS L2 intent.
Last reviewed: 2026-07-19.

## Authentication & sessions
- All new API routes require an auth guard by default. Public routes need an
  explicit justification comment and rate limiting.
- Never mint long-lived tokens for humans; agent tokens are 7-day,
  `agentId`-bound, and enrollment-revocable.
- Passwords: bcrypt only; never log, never return, never store plaintext.
- MFA paths must never expose the TOTP secret after enrollment.

## Authorization & tenancy
- Every Prisma query touching tenant data goes through the tenant-scoped
  context (`withTenant` / RLS GUC). No raw cross-tenant queries outside
  SuperAdmin modules.
- Owner-only endpoints use `SuperAdminGuard`; tenant-admin endpoints use
  `RolesGuard` with explicit role lists. Do not rely on frontend hiding.
- Object access must verify ownership (id + tenantId), not just role
  (IDOR prevention). Add a tenant-isolation spec for new resource types.

## Input & output
- Validate all DTOs with class-validator; enable whitelist/forbidNonWhitelisted
  semantics for new controllers.
- File paths from any external source: canonicalize (`realpath`), enforce
  allowlist roots, reject traversal (see agent FILE_PULL implementation).
- Never interpolate user input into shell commands, raw SQL, or LDAP filters.
  Use Prisma parameterization; for `$queryRaw` use tagged templates only.
- API responses: strip secrets centrally; expose `has*` booleans instead of
  values. Add a redaction spec when introducing stored credentials.

## Secrets & crypto
- No secrets in code, tests, fixtures, or docs — CI gitleaks gate enforces.
  Local operational secrets live in gitignored `.secrets/`.
- Use Node `crypto` Ed25519 for signing, AES-256-GCM for at-rest encryption.
  No home-grown crypto, no MD5/SHA1 for security purposes.
- New signing/verification flows must verify over a canonical serialization
  (sorted keys) and bind context (installId/fingerprint/nonce) to prevent
  replay.

## Agent & remote execution
- Remote execution only through ScriptLibrary allowlist; high-risk scripts
  require dual approval. No free-form command channels.
- Agent-facing endpoints must bind the path/body `agentId` to the token's
  `agentId`.

## Logging & errors
- Log security-relevant events to AuditLog (actor, IP, action, resource,
  outcome). Never log tokens, passwords, or license payloads.
- Return generic error messages to clients; details go to server logs only.

## Dependencies & supply chain
- Add dependencies via package manager at latest stable; no pinned-by-hand
  hashes of unknown provenance.
- CI runs Semgrep, gitleaks, Trivy, Checkov, and SBOM generation — do not
  bypass with `continue-on-error` for new blocking findings; fix or document
  an accepted risk in `docs/ENTERPRISE_READINESS.md`.
- Release artifacts (agent binaries, appliance bundles, update manifests) must
  be signed with the appropriate channel key.

## Frontend
- No `dangerouslySetInnerHTML` with unsanitized input.
- Never put secrets in `NEXT_PUBLIC_*`.
- New owner/admin pages must call guarded endpoints and handle 401/403 by
  redirecting to login, not by silently rendering empty state.

## Review checklist (PR gate)
1. New endpoint guarded? Correct roles?
2. Tenant scoping applied? Isolation spec added?
3. Any secret handled? Redacted in responses and logs?
4. Input validated? Paths canonicalized?
5. Tests added for the security property, not just the happy path?
