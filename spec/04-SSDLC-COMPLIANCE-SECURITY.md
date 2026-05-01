# SSDLC, Compliance, Security & Standards

## SSDLC (Secure Software Development Lifecycle)

Every feature, patch, and release of AssetCommand MUST follow this lifecycle:

### Phase 1: Requirements & Threat Analysis
- Gather functional + security requirements simultaneously
- Identify assets, data flows, trust boundaries
- Define security acceptance criteria for each feature
- Classify data sensitivity levels (Public, Internal, Confidential, Restricted)
- Compliance requirements mapping (which ISO/NIST controls does this feature touch?)

### Phase 2: Architecture & Threat Modeling
- Create data flow diagrams (DFDs) for new features
- Apply STRIDE threat model (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege)
- Document attack surfaces and trust boundaries
- Design mitigations for each identified threat
- Architecture review with security checklist
- Output: Threat Model Document + Mitigation Plan

### Phase 3: Secure Coding
- Follow OWASP Secure Coding Guidelines
- OWASP Top 10 prevention built into framework (NestJS guards, validators)
- Input validation on ALL user inputs (Zod schemas)
- Parameterized queries only (Prisma handles this)
- Output encoding for XSS prevention
- Authentication/authorization checks on every endpoint
- Secrets management (never hardcoded, always from Vault)
- Dependency scanning (npm audit, Snyk)
- Code review checklist includes security items
- Peer review mandatory for all PRs

### Phase 4: Security Testing
| Test Type | Tool | When |
|-----------|------|------|
| **SAST** | SonarQube / Semgrep | Every PR (CI pipeline) |
| **SCA** | Snyk / npm audit / Trivy | Every PR + daily scheduled |
| **DAST** | OWASP ZAP | Pre-release (staging environment) |
| **Secret Scanning** | GitLeaks / TruffleHog | Every commit (pre-commit hook + CI) |
| **Container Scanning** | Trivy | Every Docker build |
| **IaC Scanning** | Checkov / tfsec | Every infra change |
| **Penetration Testing** | Manual + automated | Quarterly + major releases |
| **Fuzzing** | Custom + AFL | Critical parsers (SNMP, GPS protocols) |

### Phase 5: Secure Deployment
- Signed container images (Docker Content Trust / Cosign)
- Immutable infrastructure (containers rebuilt, not patched in place)
- Least-privilege service accounts
- Network segmentation (pod-to-pod policies in K8s)
- TLS everywhere (even internal service communication)
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Environment-specific configs (no dev secrets in prod)
- Blue-green or canary deployment strategy
- Automated rollback on health check failure

### Phase 6: Monitoring & Incident Response
- Runtime Application Self-Protection (RASP) hooks
- Anomaly detection on API usage patterns
- Automated alerting on security events
- Incident response playbook for common scenarios
- Post-incident review and lessons learned
- CVE monitoring for all dependencies (automated)

---

## Compliance Framework Alignment

### ITIL 4 Practices Implementation

| ITIL Practice | AssetCommand Module | Implementation |
|---------------|-------------------|----------------|
| **Incident Management** | ITSM Ticketing | Auto-classification, SLA timers, escalation, Known Error linking |
| **Problem Management** | ITSM Ticketing | Root cause analysis tracking, Known Error Database (KEDB), trend analysis |
| **Change Enablement** | Change Request Module | Risk-based approval workflows (standard/normal/emergency), CAB integration, automated pre-approved changes |
| **Release Management** | Patch Management | Release calendar, deployment windows, rollback procedures, post-implementation review |
| **Service Request Management** | Self-Service Portal | Service catalog, request templates, automated fulfillment for standard requests |
| **Service Configuration Management** | CMDB | CI lifecycle, relationship mapping, automated discovery sync, impact analysis |
| **IT Asset Management** | ITAM + EAM | Full lifecycle tracking, financial management, compliance, depreciation |
| **Monitoring and Event Management** | NMS + Automation Engine | Threshold-based alerts, event correlation, auto-ticket creation |
| **Knowledge Management** | Knowledge Base | Searchable KB, article versioning, linked to tickets, self-service resolution |

### ISO Standards Mapping

#### ISO 27001 (Information Security Management)
| Annex A Control | AssetCommand Feature |
|----------------|---------------------|
| A.5 — Organizational Controls | RBAC, policies, tenant isolation |
| A.6 — People Controls | User management, access reviews, MFA enforcement |
| A.7 — Physical Controls | Facility asset tracking (EAM), CCTV management |
| A.8.1 — Asset Inventory | CMDB + ITAM + EAM (complete asset registry) |
| A.8.2 — Asset Classification | Asset tagging, sensitivity classification |
| A.8.7 — Malware Protection | Security posture monitoring via agent |
| A.8.8 — Vulnerability Management | Patch management + vulnerability scanning |
| A.8.9 — Configuration Management | CMDB + config baseline compliance |
| A.8.15 — Logging | Comprehensive audit logging (every action) |
| A.8.16 — Monitoring | NMS + VDI monitoring + automation alerts |

#### ISO 20000 (IT Service Management)
- Service catalog and request management
- Incident, problem, change management workflows
- SLA management and reporting
- Capacity and availability monitoring
- Supplier/vendor management
- Continual improvement tracking

#### ISO 22301 (Business Continuity)
- Asset criticality classification
- Disaster recovery asset tracking
- Backup/restore verification for on-prem
- Redundancy mapping in CMDB

#### ISO 31000 (Risk Management)
- Risk scoring for vulnerabilities
- Asset risk classification
- Compliance risk dashboards
- Risk treatment tracking

### NIST Framework Mapping

#### NIST Cybersecurity Framework (CSF)
| Function | AssetCommand Coverage |
|----------|---------------------|
| **Identify** | Asset inventory (CMDB), risk assessment, vulnerability scanning |
| **Protect** | Patch management, access control (RBAC), encryption monitoring, security posture |
| **Detect** | Network monitoring (NMS), anomaly detection, rogue device detection, CCTV |
| **Respond** | Incident ticketing (ITSM), automation engine (auto-remediation), notification engine |
| **Recover** | Asset lifecycle management, backup monitoring, disaster recovery tracking |

#### NIST SP 800-53 Controls
- AC (Access Control): RBAC, MFA, session management
- AU (Audit): Comprehensive audit logging with tamper protection
- CM (Configuration Management): CMDB, baseline compliance
- IA (Identification & Authentication): SSO, LDAP, MFA, API keys
- IR (Incident Response): Ticketing, automation, escalation
- RA (Risk Assessment): Vulnerability scoring, compliance dashboards
- SA (System & Services Acquisition): License management, vendor tracking
- SC (System & Communications Protection): TLS, encryption, network segmentation
- SI (System & Information Integrity): Patch management, malware monitoring

### IEEE Standards Compliance

| Standard | Application |
|----------|------------|
| **IEEE 830** | Software Requirements Specification (SRS) document structure |
| **IEEE 1471** | Architecture description (views, viewpoints, concerns) |
| **IEEE 12207** | Software lifecycle processes (development, maintenance, retirement) |
| **IEEE 29148** | Requirements engineering lifecycle |

---

## Audit Logging System

### What Gets Logged (Everything)
Every user action, system event, and data change is captured:

```typescript
interface AuditLogEntry {
  id: string;                    // UUID
  tenantId: string;              // Tenant context
  timestamp: Date;               // UTC, millisecond precision
  actor: {
    userId: string;              // Who performed the action
    username: string;
    role: string;
    ipAddress: string;
    userAgent: string;
    sessionId: string;
  };
  action: string;                // e.g., "asset.create", "ticket.update", "user.login"
  resource: {
    type: string;                // e.g., "Asset", "Ticket", "User"
    id: string;                  // Resource identifier
    name: string;                // Human-readable name
  };
  details: {
    before: object | null;       // Previous state (for updates)
    after: object | null;        // New state (for creates/updates)
    metadata: object;            // Additional context
  };
  outcome: 'success' | 'failure';
  severity: 'info' | 'warning' | 'critical';
  module: string;                // Source module
}
```

### Log Protection
- Append-only storage (no update/delete operations)
- Cryptographic hash chain (each entry references previous hash)
- Separate database/table with restricted access
- Log integrity verification job (daily)
- Retention policy: configurable (default 7 years for compliance)
- Export capability for external SIEM ingestion

### Audited Actions Include
- All CRUD operations on any entity
- Authentication events (login, logout, failed login, MFA)
- Authorization events (permission denied, role changes)
- Configuration changes (system settings, automation rules)
- Discovery scan executions and results
- Patch deployment actions
- Ticket lifecycle events
- Report generation and export
- Data export/download actions
- API key creation/revocation
- Credential vault access
- CCTV viewing sessions

---

## Data Security

### Encryption
| Layer | Method |
|-------|--------|
| **In Transit** | TLS 1.3 (all communications) |
| **At Rest** | AES-256 (database, file storage) |
| **Sensitive Fields** | Application-level encryption (credentials, API keys, personal data) |
| **Backups** | Encrypted with separate key |
| **Search Index** | Encrypted at rest |

### Data Classification
| Level | Examples | Handling |
|-------|---------|---------|
| **Restricted** | Scan credentials, API secrets, encryption keys | Vault storage, HSM-backed, no logging of values |
| **Confidential** | User PII, financial data, vulnerability details | Encrypted fields, access-logged, role-restricted |
| **Internal** | Asset inventory, ticket details, configs | Standard RLS, audit logged |
| **Public** | Knowledge base articles, service catalog | No special handling |

### Privacy
- GDPR/DPDP Act compliance: data subject access, right to deletion
- Data minimization: collect only necessary information
- Consent management for tracking features
- Data anonymization for analytics
- Configurable data retention policies per data class
- PII masking in logs and reports

---

## Integrations

### Native Integrations
| System | Integration Type | Purpose |
|--------|-----------------|---------|
| **Active Directory / Azure AD** | LDAP/LDAPS, Graph API | User sync, computer import, SSO |
| **Microsoft 365** | Graph API | License tracking, user provisioning |
| **Google Workspace** | Admin SDK | User sync, device management |
| **Slack** | Webhooks + Bot API | Ticket notifications, approval workflows |
| **Microsoft Teams** | Bot Framework + Webhooks | Notifications, ticket creation from chat |
| **Email (SMTP/IMAP)** | SMTP for sending, IMAP for ticket creation | Email notifications, email-to-ticket |
| **AWS / Azure / GCP** | Cloud APIs | Cloud asset discovery |
| **VMware vCenter** | REST API | VM inventory, VDI monitoring |
| **Citrix** | OData/REST API | VDI session monitoring |
| **JIRA** | REST API | Bi-directional ticket sync |
| **PagerDuty** | Events API | Incident escalation |

### Generic Integration Layer
- **Webhooks:** Outgoing webhooks for any event (configurable)
- **REST API:** Full CRUD API for all modules (OpenAPI 3.0 documented)
- **GraphQL API:** Flexible queries for dashboard and reporting integrations
- **SNMP Trap Forwarding:** Forward processed traps to external NMS
- **Syslog Forwarding:** Forward events to external SIEM
- **CSV/Excel Scheduled Export:** Automated data exports
- **Custom Connectors:** Plugin architecture for building custom integrations

---

## User Experience Requirements

### Design Principles (ManageEngine-Inspired)
- Clean, professional enterprise UI (not consumer-flashy)
- Information density: show maximum useful data without clutter
- Consistent navigation: left sidebar + top bar + breadcrumbs
- Context-sensitive actions: right-click menus, bulk action bars
- Keyboard shortcuts for power users
- Responsive: works on 1280px+ screens, graceful degradation on tablets

### Dashboard System
- Role-based default dashboards (IT Admin sees different view than Fleet Manager)
- Drag-and-drop widget customization
- 50+ pre-built widgets (counters, charts, tables, maps, gauges)
- Real-time auto-refresh (configurable interval)
- Full-screen NOC/kiosk mode
- Dark and light themes
- Dashboard sharing and cloning
- Print-optimized views for reports

### Search
- Global search bar (Cmd/Ctrl+K) searching across ALL modules
- Asset search with filters (type, status, location, department, tags)
- Ticket search with status/priority/assignee filters
- Saved search queries
- Recent items quick access
- Natural language search (Phase 2 — AI-powered)

### Bulk Operations
- Multi-select with checkboxes on all list views
- Bulk update (change status, assign, tag, move department)
- Bulk delete with confirmation
- Bulk export (selected items to CSV/Excel)
- Bulk import with validation preview

### Multi-Language Support (Phase 2)
- i18n framework built-in from day 1
- Default: English
- Phase 2: Hindi, Spanish, French, German, Japanese, Arabic
- RTL layout support for Arabic
- Date/time/number format localization
