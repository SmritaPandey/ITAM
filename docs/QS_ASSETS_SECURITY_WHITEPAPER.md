# QS Assets Security Overview

Version 1.0 — July 2026

## Platform scope

QS Assets provides multi-tenant IT asset management, discovery, monitoring, service management, and automation. This overview describes the security architecture of the managed SaaS offering; self-hosted customers remain responsible for their infrastructure, identity provider, backup, and network controls.

## Data protection and tenant isolation

- TLS protects supported web, API, and agent communications in transit.
- Hosting-provider encryption protects managed data stores at rest.
- Tenant-scoped authorization and PostgreSQL row-level security provide layered separation of customer records.
- Secrets and credentials use dedicated vault/encryption controls and are not intended to appear in ordinary API responses or logs.
- Retention and deletion controls are applied according to service configuration and contractual requirements.

## Identity and access management

QS Assets supports role-based access control, least-privilege administrative roles, TOTP MFA, API keys, and enterprise SAML/OIDC options. Administrative and sensitive actions are recorded for investigation and compliance evidence. Customers are responsible for lifecycle management of their users, SSO policies, and endpoint access.

## Application and software supply-chain security

The engineering lifecycle includes code review, automated type checks and tests, production-dependency vulnerability auditing, and CycloneDX SBOM generation. Discovery Agent updates use SHA-256 checksums and Ed25519 signatures; agents reject updates that cannot be validated with the configured trusted public key.

Security controls are risk-based and continually improved. An SBOM or control does not by itself certify that software is vulnerability-free.

## Infrastructure, resilience, and monitoring

The managed service uses Railway for API and data services and Vercel for the web application. Operational controls include health monitoring, structured logging, backup and restore procedures, deployment rollback, and a documented business continuity and disaster recovery runbook. Recovery objectives are tested through periodic restore drills and tracked corrective actions.

## Vulnerability management

Security reports are accepted at [security@qsasset.com](mailto:security@qsasset.com). Scope, safe-harbor terms, response targets, and coordinated disclosure guidance are published in the [vulnerability disclosure policy](https://www.qsasset.com/security) and [security.txt](https://www.qsasset.com/.well-known/security.txt).

## Shared responsibility

QS Assets secures the platform components it operates. Customers must secure their accounts, identity provider, networks, endpoints, credentials, integrations, and self-hosted infrastructure; configure least privilege; and promptly apply supported agent and platform updates.

## Assurance and limitations

Trust materials, subprocessors, and privacy documents are available through the QS Assets Trust Center. References to frameworks describe alignment goals and implemented practices, not certification unless accompanied by a current independent report. Detailed evidence may be provided under appropriate confidentiality terms.

For security or assurance questions, contact [security@qsasset.com](mailto:security@qsasset.com).
