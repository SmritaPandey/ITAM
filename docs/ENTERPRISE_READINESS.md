# QS Assets — Enterprise Readiness Status

Last verified: 2026-07-19 against production (Railway API + Vercel web).
This maps the certification/hardening roadmap phases to evidence in this repo
and live configuration. Honest status only — nothing is claimed without a
verifiable artifact.

## Phase 1 — Product freeze / hardening

| Item | Status | Evidence |
|---|---|---|
| Auth hardening (JWT, refresh, OAuth code exchange, MFA TOTP) | Done | `auth/`, `mfa.service.ts`, live MFA roundtrip verified |
| Secret redaction, credential vault | Done | `common/security/`, `VAULT_ENCRYPTION_KEY` live |
| Agent identity (enrollments, bound 7d JWTs, revocation) | Done | `AgentEnrollment`, `discovery.agent-auth.spec.ts` |
| License enforcement + offline challenge activation | Done, live-validated | Issue → download `.lic` → activate → fingerprint-bind rejection all verified in prod |
| Env validation (fail-fast on weak secrets) | Done | `config/env.validation.ts` + specs |
| Prod schema/migration reconciliation | Done | Migration history baselined; `prisma migrate status` clean |

## Phase 2 — Documentation

Present: `DEPLOY.md`, `ONPREM-INSTALL.md`, `docs/APPLIANCE-INSTALL.md`,
`docs/BCP_DR_RUNBOOK.md`, `docs/FEATURE_STATUS_MATRIX.md`,
`docs/LIVE_INTEGRATION_BLOCKERS.md`, OpenAPI (Swagger) served by the API.

Not yet written (needed for ISO/SOC audits): SRS, HLD/LLD, formal threat model
(STRIDE), data classification, secure coding standard, incident response plan.

## Phase 3 — Testing

- Unit/acceptance: 219 Jest tests green in CI (`ci.yml` with PostGIS + Redis services).
- Not yet: load testing (k6/JMeter), HA failover drills, chaos testing.
  `docker-compose.ha.yml` + `PROCESS_ROLE` split exist and are unit-tested,
  but multi-node failover has not been exercised.

## Phase 4 — Security testing

In place: npm audit gating (high), SBOM (CycloneDX) per build, committed-secret
CI guard, signed agent + platform release artifacts (Ed25519).
Not yet: SAST (Semgrep/Sonar), DAST (ZAP), container scan (Trivy), IaC scan
(Checkov), independent VAPT. VAPT requires a CERT-In empanelled auditor —
cannot be self-performed.

## Phases 5–6 — Certifications & compliance

No certification can be produced from code. Ready inputs: SBOM, signed
releases, audit logs, RLS tenancy, DPDP/retention features, Trust page.
Next external steps: gap assessment → CERT-In VAPT → ISO 27001 consultant.

## Phase 7 — Integrations (credential-gated)

Code + tests exist for: Entra ID/Google OAuth (live-configured), SAML/OIDC,
AD/LDAP, AWS/Azure/GCP connectors, Slack/Teams, SMTP (live-configured),
IMAP, RADIUS CoA, Traccar, ONVIF/HLS, NetFlow. Each stays "Blocked: awaiting
credential/hardware" in `docs/LIVE_INTEGRATION_BLOCKERS.md` until real tenant
credentials are supplied; creating third-party org accounts is an owner action.

## Phase 8 — DevSecOps

Done: CI typecheck/test/build gates, SBOM, signed agent/platform releases,
secret-commit guard, GitHub secrets for signing keys.
Not yet: branch protection + mandatory review, Semgrep/Trivy jobs,
reproducible builds attestation.

## Live production state (verified)

- Owner: `smrita@neurqai.com`, MFA (TOTP) enforced and verified end-to-end.
- Signing: `LICENSE_*` and `AGENT_UPDATE_*` Ed25519 keys live on Railway;
  `PLATFORM_UPDATE_PRIVATE_KEY` + `AGENT_UPDATE_PRIVATE_KEY` in GitHub secrets.
- Redis provisioned on Railway and wired (`REDIS_URL`) — MFA challenges,
  queues, and Socket.IO adapter now have distributed state.
- Validation license `QS-4RO6-WYOK-GMDD-K682` ACTIVE and fingerprint-bound;
  duplicate test licenses revoked.
- Owner console: license summary + module picker + status filter, system
  readiness panel — deployed and verified.
