# QS Assets Security Overview

Version 1.0 — July 2026

## Platform scope

QS Assets provides multi-tenant IT asset management, discovery, monitoring, service management, and automation. This overview describes the security architecture of the managed SaaS offering; self-hosted customers remain responsible for their infrastructure, identity provider, backup, and network controls.

## Data protection and tenant isolation

- TLS protects supported web, API, and agent communications in transit.
- Hosting-provider encryption protects managed data stores at rest.
- Tenant-scoped authorization and PostgreSQL row-level security provide layered separation of customer records.
- Secrets and credentials use dedicated vault/encryption controls and are not intended to appear in ordinary API responses or logs.

## Identity and access management

QS Assets supports role-based access control, least-privilege administrative roles, TOTP MFA, API keys, and enterprise SAML/OIDC options. Administrative and sensitive actions are recorded for investigation and compliance evidence.

## Application and supply-chain security

The engineering lifecycle includes code review, automated checks and tests, production-dependency vulnerability auditing, and CycloneDX SBOM generation. Discovery Agent updates use SHA-256 checksums and Ed25519 signatures; agents reject updates that cannot be validated with the configured trusted public key.

## Resilience and vulnerability management

Operational controls include health monitoring, structured logging, backups, restore drills, and deployment rollback. Security reports are accepted at [security@qsasset.com](mailto:security@qsasset.com); see the [Trust Center](https://www.qsasset.com/security) for disclosure guidance and current subprocessors.

## Shared responsibility and limitations

QS Assets secures the platform components it operates. Customers must secure their accounts, identity provider, networks, endpoints, integrations, and self-hosted infrastructure. Framework references describe alignment goals and implemented practices, not certification unless accompanied by a current independent report.
