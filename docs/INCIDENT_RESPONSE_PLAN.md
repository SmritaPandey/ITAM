# QS Assets — Incident Response Plan

Owner: NeurQ AI Labs security lead (currently: platform owner).
Report channel: security@qsasset.com (see SECURITY.md for disclosure SLAs).
Last reviewed: 2026-07-19.

## Severity levels

| Sev | Definition | Response start | Examples |
|---|---|---|---|
| SEV1 | Active breach, cross-tenant exposure, license-issuer key compromise | Immediate | Attacker with owner JWT; leaked `LICENSE_PRIVATE_KEY` |
| SEV2 | Exploitable vuln in prod, single-tenant exposure, agent-channel compromise | < 4h | IDOR proven in prod; forged agent token accepted |
| SEV3 | Vuln without confirmed exploitation; suspicious activity | < 24h | Dependency CVE (critical) in runtime path |
| SEV4 | Hardening gap, scanner finding | Next sprint | CI scanner report |

## Phases

### 1. Detect & triage
- Sources: audit logs (owner console → System), Railway/Vercel logs, CI scans,
  security@ reports, tenant complaints.
- Assign severity; open a private tracking issue; start a timeline log
  (UTC timestamps, every action).

### 2. Contain
- Compromised user: revoke refresh tokens (`refresh_tokens.revoked_at`),
  reset password, disable account if needed.
- Compromised agent: revoke enrollment (owner console → Enrollments, or
  `POST /admin/agent-enrollments/:id/revoke`); agent must re-authenticate.
- Compromised license key: revoke in owner console → Licenses (blocks future
  online activation).
- Key compromise: rotate the affected keypair (see Key rotation below),
  redeploy, then re-issue affected artifacts.
- Platform-wide: Railway service can be paused; Vercel deployment rolled back
  to a prior immutable deployment.

### 3. Eradicate & recover
- Patch root cause with a regression test; deploy via CI (all gates green).
- Restore data from backups if integrity affected
  (`scripts/backup.sh` / `restore.sh`; appliance: `qsassets restore`).
- Verify: `/health`, `/health/ready`, login+MFA, tenant isolation spot-check,
  agent heartbeat.

### 4. Notify
- DPDP Act 2023: notify the Data Protection Board and affected principals on
  personal-data breach — without undue delay.
- CERT-In: report applicable incidents within 6 hours of noticing
  (cyber incidents listed in the 2022 directions).
- Enterprise customers: per contract; default within 72h with scope, impact,
  and remediation.

### 5. Post-incident
- Blameless postmortem within 5 business days: timeline, root cause,
  detection gap, action items with owners/dates.
- Update `docs/THREAT_MODEL.md` if a new threat class emerged.

## Key rotation quick reference

| Key | Rotate by | Blast radius |
|---|---|---|
| `JWT_SECRET` | Set new value on Railway/appliance env; all sessions invalidate | All users re-login |
| `LICENSE_PRIVATE_KEY` | Generate Ed25519 pair; update Railway + issue path | Old `.lic` files still verify against old public key on installs; new installs need new public key |
| `AGENT_UPDATE_PRIVATE_KEY` | Rotate in GH secrets + Railway | Agents verify next update against configured public key — push public key first |
| `PLATFORM_UPDATE_PRIVATE_KEY` | Rotate in GH secrets; ship new public key in appliance env | On-prem updaters reject manifests until public key updated |
| `VAULT_ENCRYPTION_KEY` | Requires re-encryption migration of vault rows — do NOT rotate blind | Stored scan credentials unreadable if lost |

## Evidence handling
Preserve logs and DB snapshots before remediation where feasible; store in a
restricted location; record chain of custody in the incident timeline.
