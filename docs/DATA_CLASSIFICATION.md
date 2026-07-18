# QS Assets — Data Classification

Applies to both SaaS and on-prem deployments. Last reviewed: 2026-07-19.

## Classes

| Class | Definition | Handling |
|---|---|---|
| **Restricted** | Compromise breaks the platform's trust model | Never logged or returned by APIs; env/secret-manager only; rotation runbook required |
| **Confidential** | Tenant business data; contractual/DPDP obligations | Tenant-scoped via RLS + guards; encrypted in transit; audit-logged access for admin surfaces |
| **Internal** | Operational data of low sensitivity outside the platform | Authenticated access only |
| **Public** | Intentionally published | No restriction |

## Inventory

### Restricted
- Signing keys: `LICENSE_PRIVATE_KEY`, `AGENT_UPDATE_PRIVATE_KEY`, `PLATFORM_UPDATE_PRIVATE_KEY`
- `JWT_SECRET`, `VAULT_ENCRYPTION_KEY`, `AGENT_ENROLLMENT_SECRET`
- Password hashes (`users.password`, bcrypt), MFA TOTP secrets, refresh-token hashes
- Vault-encrypted scan/integration credentials (SNMP/WMI/SSH, SMTP, cloud API keys)
- Database connection strings

### Confidential (tenant data)
- User PII: names, emails, phone, employment metadata
- Asset inventory: hostnames, serials, IPs, MACs, installed software, hardware specs
- Tickets and internal notes, attachments
- Network telemetry: SNMP/syslog/NetFlow records, discovered topology
- Vulnerability and patch-state data (attack-planning value)
- Agent-collected data: process lists, event logs, pulled files
- License records: customer name, entitlements, fingerprints
- CCTV/VDI/telematics records where enabled

### Internal
- Aggregated platform metrics, anonymized usage counters
- CI logs, SBOMs, scanner reports (after triage)
- Audit logs (confidential where they embed tenant identifiers — treat as tenant data for retention)

### Public
- Marketing site, docs published to customers, release notes, security policy (SECURITY.md)

## Controls mapping

- **In transit**: TLS everywhere (Vercel/Railway managed; Caddy on appliance).
- **At rest**: Railway managed-disk encryption (SaaS); on-prem customers must
  enable disk encryption (hardening guide). Vault rows AES-256-GCM app-layer
  encrypted.
- **Isolation**: Postgres RLS with per-request tenant GUC; guards at API layer.
- **Retention**: audit logs retained 180 days minimum (CERT-In); backups per
  BCP/DR runbook; tenant deletion cascades on offboarding.
- **DPDP/GDPR roles**: tenant is Data Fiduciary/Controller for its user and
  asset data; NeurQ AI Labs is Data Processor in SaaS mode; on-prem the
  customer holds all data.

Any new model/field storing credentials, personal data, or endpoint telemetry
must be classified here before merge.
