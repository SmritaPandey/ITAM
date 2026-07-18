# QS Assets — Control Mapping Matrix (Auditor Evidence Pack)

**Date:** 2026-07-18  
**Scope:** Existing QS Assets product controls mapped to ISO/IEC 27001 Annex A themes, SOC 2 Trust Services Criteria (CC), OWASP ASVS L2 themes, DPDP Act expectations, and CERT-In log-retention themes.  
**Status:** Technical evidence for readiness reviews — **not** a certificate and **not** a VAPT report.

## How to use

1. Pick a control ID in the left column.
2. Open the Evidence path(s) in the repo (or Trust Center / runbook).
3. Confirm Test / CI proof where listed.
4. Residual gaps are explicit — do not mark “certified” until an external auditor closes them.

## Executive readiness

| Domain | Technical readiness | External dependency |
|--------|---------------------|---------------------|
| OWASP ASVS L2 (app security) | Largely implemented | Formal pen test / VAPT engagement |
| SOC 2 Type II | Control design evidenced | Observation window + CPA firm |
| ISO 27001 / 27701 | Technical Annex A mapped | ISMS, SoA, internal audit, certification body |
| ISO 20000-1 | CAB / change gates in product | SMS processes + audit |
| DPDP Act | Privacy notice + DSR workflow + retention job | Legal review, consent ops, DPO |
| CERT-In | Audit export + retention ≥180d | Incident reporting SOP + mailbox ops |
| RBI CSF (themes) | Access, logging, change, crypto | Bank-specific assessment |

## Control matrix

| Framework / theme | Control intent | Evidence (code / docs) | Tests / CI | Residual gap |
|-------------------|----------------|------------------------|------------|--------------|
| ASVS / SOC CC6 — Secrets at rest & in transit | No plaintext secrets in API responses; vault seal | `apps/api/src/common/security/redact.ts`, `vault-crypto.ts`; settings/monitoring/SSO consumers | `redact.spec.ts`, `sso.service.spec.ts`, `settings.service.spec.ts` | Confirm prod `VAULT_ENCRYPTION_KEY` set |
| ASVS — Ticket IDOR / internal notes | Requester/assignee or privileged role; strip internal notes for employees | `apps/api/src/modules/tickets/tickets.service.ts` | `tickets.service.spec.ts` | Manual employee isolation checklist |
| ASVS — Remote execution | Free-form shell disabled; ScriptLibrary + dual approval | `discovery.service.ts` (`queueRemoteCommand`); `script-library.controller.ts`; migration `20260718165000_script_dual_approval` | Automation / script specs | Ops: approve high-risk scripts with two admins |
| ASVS — FILE_PULL path traversal | Absolute path + allowlisted roots + sensitive path block | `discovery.service.ts` FILE_PULL; agent `qs-discovery-agent.js` | Agent/API path tests (manual + unit where present) | Set `FILE_PULL_ALLOWED_ROOTS` in prod |
| ASVS — Supply chain agent updates | Ed25519 + checksum + same-origin HTTPS | `agent-update-crypto.ts`; `scripts/sign-agent-release.mjs`; CI security job | `verify-agent-release-signing.mjs` | GitHub secret `AGENT_UPDATE_PRIVATE_KEY` |
| ASVS — OAuth token leakage | One-time exchange code; no tokens in URL | `auth.controller.ts` oauth exchange; `sso.service.ts`; web `auth/callback` | SSO flow specs; web callback | Cookie-only cutover still dual-path (see risk acceptance) |
| ASVS / SOC CC6 — Session management | HttpOnly Secure cookies + Bearer dual path | `auth-cookies.ts`; `jwt.strategy.ts`; web `credentials: include` | Session risk doc | `docs/SESSION_AUTH_RISK_ACCEPTANCE.md` |
| ASVS / SOC CC6 — Multi-tenancy / RLS | `withTenant` + GUC clear | `prisma.service.ts`; tenant RLS middleware/interceptor; migrations `tenant_rls_*` | `with-tenant.spec.ts` | Expand `withTenant` beyond hot paths over time |
| ASVS — Abuse rate limits | IP + email/token/agent fingerprints | `api-throttler.guard.ts`; auth `@Throttle` | CI unit suite | Tune thresholds under load |
| ASVS — Password change SoD | Self change vs admin reset | `users.controller.ts` / `users.service.ts` | Users specs where present | — |
| SOC CC7 / CERT-In — Audit logging | Hash-chained export + retention | `audit-logs.service.ts` / controller export+verify; tenant `auditRetentionDays` | Audit specs | SIEM webhook ops |
| DPDP — Privacy & DSRs | Notice, DSR types, retention/deletion | `privacy/*`; web `/privacy`; `data-retention.service.ts`; migration `20260718171500_p1_compliance_governance` | Privacy module + retention | Legal review of notices |
| ISO 42001 light — AI governance | Metadata log, kill-switch, assistive disclaimer | `ai.service.ts`; `AiInteractionLog`; web `AiCopilot.tsx` | `ai.service.spec.ts` | Model vendor DPA |
| ISO 20000 / ITIL — Change CAB | CAB_REVIEW + approval gates | `changes.service.ts` | `changes.service.spec.ts` | CAB calendar operating procedure |
| Patch maturity | PILOT → STAGED → ALL rings | `patch-policy.service.ts` | `patches.service.spec.ts` | Air-gap bundle ops drill |
| CIS evidence | Compliance / CIS report endpoints | `compliance.service.ts`; `reports.controller.ts` | `compliance.service.spec.ts` | JSON evidence pack; PDF render still optional |
| MFA (SOC CC6) | TOTP enroll/verify/challenge; tenant enforce | `mfa.service.ts`; auth MFA routes | **`mfa.service.spec.ts`** | Live IdP/user E2E in staging |
| SAML / OIDC (SOC CC6) | Encrypted client secrets; Redis/in-mem state; ACS tenant bind | `sso.service.ts`; `sso.controller.ts` | **`sso.service.spec.ts`**, **`sso.flow.spec.ts`** | Live IdP integration test per customer |
| Trust Center / disclosure | Whitepaper, security.txt, SECURITY.md | `SECURITY.md`; `docs/QS_ASSETS_SECURITY_WHITEPAPER.md`; `apps/web/public/trust/`; `.well-known/security.txt` | Manual Trust Center URLs | Confirm `security@qsasset.com` routing; PDF whitepaper optional |
| BCP/DR | Runbook + restore checklist | `docs/BCP_DR_RUNBOOK.md` | Restore drill log (ops) | Execute and record restore drill |
| SBOM / dependency hygiene | CycloneDX + high audit gate | `.github/workflows/ci.yml` | CI `security` job | Two moderate transitive advisories accepted |
| WCAG 2.1 AA (critical paths) | Labels, alerts, skip link | login/register/dashboard layout TSX | Manual + lint | Full AA automated audit remaining |

## Explicit non-evidence (do not claim)

| Claim | Reality |
|-------|---------|
| “VAPT done” | **No** VAPT/pen-test report in repo. Product supports attaching VAPT evidence to changes (`vaptEvidence` fields) — that is a workflow, not an assessment. |
| “SOC 2 certified” | Trust Center may show readiness materials; certificate requires CPA firm + Type II period. |
| “ISO certified” | Requires accredited certification body and organizational ISMS. |

## Suggested auditor walkthrough (90 minutes)

1. Read this matrix + `SECURITY.md` + whitepaper.  
2. Trace one P0 control end-to-end (e.g. secret redaction → settings API → test).  
3. Run `cd apps/api && npx jest --ci mfa.service.spec.ts sso.flow.spec.ts sso.service.spec.ts`.  
4. Open Trust Center + `/security` + privacy pages on production web.  
5. `GET /api/v1/health` and `/health/live` on production API.  
6. Review CI SBOM artifacts and `npm audit --omit=dev --audit-level=high` for api/web workspaces.  
7. Schedule external VAPT and SOC 2 readiness kickoff.

## Related documents

- `docs/QS_ASSETS_GAP_CLOSURE_PROMPT.md` — implementation backlog  
- `docs/SESSION_AUTH_RISK_ACCEPTANCE.md` — cookie cutover risk  
- `docs/BCP_DR_RUNBOOK.md` — DR  
- `DEPLOY.md` — Railway / Vercel  
- `spec/04-SSDLC-COMPLIANCE-SECURITY.md` — SSDLC narrative  
