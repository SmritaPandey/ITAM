# QS Assets — SSDLC, Compliance & Security

| Field | Value |
|-------|-------|
| **Product** | QS Assets |
| **Last reviewed** | 2026-07-13 |
| **Status** | Living PRD |
| **Depends on** | [03](03-ARCHITECTURE-AND-TECH-STACK.md) |

---

## SSDLC (mandatory for every feature / patch / release)

### 1. Requirements & threat analysis

- Capture functional + security acceptance criteria together.
- Classify data: Public / Internal / Confidential / Restricted.
- Map touched controls (ISO 27001, NIST CSF, CIS, ITIL evidence).

### 2. Architecture & threat modeling

- DFDs for new trust boundaries (agent, SSO, NAC, payment webhooks).
- STRIDE on auth, discovery credentials, SNMP/NetFlow UDP, script execution.
- Mitigations documented before merge of high-risk modules.

### 3. Secure coding

- OWASP ASVS-aligned practices via Nest guards + validators.
- Parameterized DB access only (Prisma).
- No secrets in repo; vault/env only.
- AuthZ check on every controller method (roles / module gates).
- Dependency hygiene: `npm audit` in CI; fix critical before release.

### 4. Security testing (CI gates)

| Gate | Tooling | When | Status |
|------|---------|------|--------|
| Lint + typecheck | ESLint, `tsc --noEmit` | Every PR | Shipped (`.github/workflows/ci.yml`) |
| Unit tests | Jest (API critical paths) | Every PR | Shipped / expand In-build |
| Build | `nest build`, `next build` | Every PR | Shipped |
| SCA | `npm audit` / advisory fail on critical | Every PR | In-build harden |
| Secret scan | gitleaks / equivalent | Every PR | In-build |
| SAST | Semgrep or Sonar | Pre-release | In-build |
| DAST | ZAP against staging | Pre-release | In-build |
| Container scan | Trivy on API image | Release | In-build |

**Release blocker:** open Critical CVE in direct deps; failing hash-chain verify; RLS regression; MFA bypass.

### 5. Secure deployment

- TLS to clients; Railway/Vercel managed certs.
- Least-privilege DB user; separate agent deploy tokens.
- Security headers on web (CSP, HSTS, frame deny).
- Immutable image deploys; migrate forward with Prisma.
- Rollback plan documented in `DEPLOY.md`.

### 6. Monitoring & IR

- Health endpoints: `/health`, `/ready`, `/live`, `/detailed`.
- Alert on auth anomalies, agent mass offline, trap storms.
- Incident playbook: revoke API keys, rotate SSO certs, quarantine via NAC/agent.
- Post-incident: audit export + lessons in change record.

---

## Authentication & identity

| Capability | Status |
|------------|--------|
| Email/password + bcrypt | Shipped |
| JWT access + refresh rotation | Shipped |
| Google / Microsoft OAuth | Shipped |
| `SsoConfig` per tenant (SAML, OIDC, Google, Microsoft) | Shipped model |
| OIDC authorization code + group→role map | In-build (service started) |
| SAML 2.0 ACS (real assertion consumer) | In-build |
| MFA TOTP enroll + login challenge | In-build (`User.mfaEnabled` / `mfaSecret` fields exist) |
| API keys with scopes | Shipped |
| Email verification / password reset | Shipped |

### Acceptance tests — auth

1. Password login issues access+refresh; refresh rotates; logout revokes.
2. MFA-enrolled user cannot complete login without valid TOTP.
3. SAML ACS with test IdP maps group to SUPER_ADMIN/IT_ADMIN role.
4. OIDC Google/MS with groupRoleMap applies role on first login.
5. Cross-tenant JWT rejected on resource access.

---

## Authorization & tenancy

- Role-based module gates in web + API.
- Tenant isolation: app filters **and** Postgres RLS (Required In-build).
- Script execution requires ScriptLibrary APPROVED.
- Threat actions Approve / Quarantine / Block audited + WS to admins.

### NAC

| Capability | Status |
|------------|--------|
| VLAN policies / segments / RADIUS config models | Shipped |
| Quarantine via agent firewall fallback | Shipped / In-build |
| RADIUS CoA / switch webhook when config enabled | In-build |

### Acceptance tests — authZ / NAC

1. USER role cannot call admin or other-tenant routes (403).
2. Quarantine sets policy; CoA called when RADIUS configured; else agent firewall rule applied.
3. RLS: SET wrong tenant GUC → zero rows.

---

## Audit hash chain

**As-built:** `AuditLog.hash` / `prevHash` SHA-256 chain via interceptor; `GET` verify endpoint.

| Requirement | Status |
|-------------|--------|
| Append-only audit rows with hash | Shipped |
| Verify API breaks on tamper | Shipped |
| Nightly verify job + alert on failure | In-build |
| SIEM export (syslog/webhook) | In-build |

### Acceptance tests — audit

1. Create asset → audit row with prevHash linking to prior.
2. Tamper hash in DB → verify reports FAIL.
3. Nightly job emits AlertEvent on FAIL.

---

## Compliance frameworks

### ITIL 4 mapping

| Practice | Module | Status |
|----------|--------|--------|
| Incident | Tickets | Shipped |
| Problem | Problems | Shipped |
| Change enablement | Changes + CAB/SSDLC | In-build depth |
| Release | Patches | In-build rings |
| Service request | Catalog + portal | Shipped / In-build approvals |
| Service configuration | CMDB | Shipped / impact In-build |
| IT asset mgmt | ITAM/EAM | Shipped / EAM In-build |
| Monitoring & event | NMS + Alerts + Automation | Shipped / syslog-NetFlow In-build |

### CIS / ISO / NIST evidence

| Deliverable | Status |
|-------------|--------|
| Endpoint policies + change detection | Shipped |
| CIS benchmark collectors (agent/SSH) | In-build |
| Evidence pack PDF/CSV export | In-build |
| Compliance dashboard scores | Shipped / deepen In-build |

### Acceptance tests — compliance

1. Export CIS evidence pack for a host with collector results.
2. Compliance report includes control IDs + pass/fail + asset refs.
3. Change SSDLC type stores UAT/VAPT evidence attachments.

---

## SSDLC 9-step change type (product feature)

Used when customers patch **their** systems via QS Assets change mgmt:

1. Request → 2. Review → 3. Approval → 4. Build → 5. UAT → 6. VAPT → 7. Patch-fix → 8. Deploy → 9. Compliance logging.

Gates: cannot close until mandatory checklist fields + attachments present ([01](01-PRODUCT-OVERVIEW.md) M6, [07](07-GAP-REMEDIATION-PLAN.md) Phase 6).

---

## Data protection

- Soft delete where applicable; hard delete audited.
- Encryption in transit (TLS); at rest via cloud provider volumes.
- PII minimization in logs (no passwords, truncate tokens).
- Payment webhooks signature-verified (Stripe/Razorpay as configured).

---

## Module acceptance checklist

- [ ] MFA TOTP enroll + challenge
- [ ] SAML ACS + OIDC group map
- [ ] RLS policies live on tenant tables
- [ ] Audit verify job nightly
- [ ] CI fails on critical audit/type/test regressions
- [ ] CIS evidence export
- [ ] NAC CoA or documented agent fallback
- [ ] Threat actions realtime to admins
