# User Dashboards, API Design & Deliverables

---

## Dashboard Specifications

### 1. Executive Dashboard (Tenant Admin / C-Level)
- Total assets by category (donut chart)
- Asset health score (overall compliance gauge)
- Open tickets by priority (stacked bar)
- Patch compliance percentage (trend line)
- License utilization summary
- Cost overview (assets by cost center)
- Top 5 alerts (critical items requiring attention)
- Fleet utilization summary
- Network uptime SLA gauge

### 2. IT Admin Dashboard
- Discovered vs. managed assets count
- New devices in last 24h/7d (with "review" action)
- Patch compliance: % up-to-date, critical missing patches count
- Security posture: devices with AV disabled, encryption off, firewall off
- Software license compliance bar chart
- Top 10 vulnerable assets
- Agent health: online/offline/stale agents
- Recent scan results summary
- Active incidents by severity

### 3. Network Operations Center (NOC) Dashboard
- Network topology map (interactive, color-coded by health)
- Device health grid (green/yellow/red indicators)
- Active alarms list (sortable, filterable)
- Interface utilization (top 10 busiest links)
- WAN/VPN link status panel
- Recent SNMP traps and syslog events
- Bandwidth utilization trend (24h)
- Device uptime leaderboard

### 4. Fleet Manager Dashboard
- Live GPS map with all vehicles
- Vehicle status legend (moving, idle, parked, offline)
- Active geofence breach alerts
- Today's trips summary
- Driver assignments board
- Maintenance due vehicles list
- Speed violations log
- Fleet utilization percentage
- Fuel consumption trends (if integrated)

### 5. IT Service Desk Dashboard
- Ticket queue by status (new, open, in progress, pending)
- My assigned tickets
- SLA breach countdown (tickets at risk)
- Tickets created vs. resolved (trend)
- Average resolution time (by category)
- Customer satisfaction score (CSAT)
- Knowledge base top articles
- Pending approvals

### 6. Security Dashboard
- CCTV camera grid (live status)
- Security posture heatmap (by department/site)
- Vulnerability severity distribution
- Rogue device alerts
- Failed login attempts (last 24h)
- Compliance score by framework (ISO 27001, NIST CSF)
- Patch status by criticality
- Encryption compliance percentage

### 7. Employee Self-Service Portal
- My assigned assets list (with details)
- Raise new ticket / service request (forms from service catalog)
- My ticket history (with status tracking)
- Knowledge base search
- Announcements from IT
- Software request catalog
- Check-in/check-out for shared assets

### 8. Facility Manager Dashboard
- Non-IT asset inventory by location/floor
- Maintenance calendar (upcoming scheduled maintenance)
- Open work orders
- Spare parts inventory with low-stock alerts
- Vendor performance ratings
- Asset condition reports
- Floor plan view with asset pins

---

## API Design

### API Principles
- RESTful with consistent resource naming (`/api/v1/{module}/{resource}`)
- JSON request/response bodies
- HTTP status codes used correctly (200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500)
- Pagination: cursor-based for large datasets, offset for simple lists
- Filtering: query parameters (`?status=active&type=laptop`)
- Sorting: `?sort=created_at&order=desc`
- Field selection: `?fields=id,name,status`
- Rate limiting: per-tenant, per-API-key
- API versioning via URL path (`/api/v1/`, `/api/v2/`)
- All endpoints require authentication (except health check)
- Tenant context from JWT or API key

### Core API Routes
```
# Auth
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/mfa/verify
GET    /api/v1/auth/sso/{provider}

# Assets (CMDB)
GET    /api/v1/assets                    # List with filters
POST   /api/v1/assets                    # Create
GET    /api/v1/assets/:id                # Get single
PATCH  /api/v1/assets/:id                # Update
DELETE /api/v1/assets/:id                # Soft delete
GET    /api/v1/assets/:id/history        # Lifecycle history
GET    /api/v1/assets/:id/relationships  # CI relationships
POST   /api/v1/assets/:id/relationships  # Create relationship
GET    /api/v1/assets/:id/tickets        # Related tickets
POST   /api/v1/assets/import             # Bulk CSV/Excel import
GET    /api/v1/assets/export             # Export filtered results

# Asset Types
GET    /api/v1/asset-types
POST   /api/v1/asset-types
PATCH  /api/v1/asset-types/:id

# Discovery
POST   /api/v1/discovery/scans           # Trigger scan
GET    /api/v1/discovery/scans           # List scan jobs
GET    /api/v1/discovery/scans/:id       # Scan results
POST   /api/v1/discovery/credentials     # Store scan credentials
GET    /api/v1/discovery/agents          # List registered agents
GET    /api/v1/discovery/agents/:id      # Agent details

# Network (NMS)
GET    /api/v1/network/devices           # All network devices
GET    /api/v1/network/devices/:id/interfaces
GET    /api/v1/network/topology          # Topology map data
GET    /api/v1/network/metrics           # Time-series metrics
GET    /api/v1/network/traps             # SNMP traps
GET    /api/v1/network/configs/:id       # Device config history

# Fleet / GPS
GET    /api/v1/fleet/vehicles            # All vehicles
GET    /api/v1/fleet/vehicles/:id/position  # Current position
GET    /api/v1/fleet/vehicles/:id/trips  # Trip history
WS     /api/v1/fleet/live                # WebSocket: live positions
GET    /api/v1/fleet/geofences           # Geofence definitions
POST   /api/v1/fleet/geofences           # Create geofence
GET    /api/v1/fleet/alerts              # Fleet alerts

# Patches
GET    /api/v1/patches                   # Available patches
GET    /api/v1/patches/missing           # Missing patches by asset
POST   /api/v1/patches/deploy            # Create deployment job
GET    /api/v1/patches/deployments/:id   # Deployment status
GET    /api/v1/patches/compliance        # Compliance report

# Licenses
GET    /api/v1/licenses                  # All licenses
GET    /api/v1/licenses/compliance       # Compliance overview
GET    /api/v1/licenses/:id/assignments  # Who is using this license

# Tickets (ITSM)
GET    /api/v1/tickets                   # List tickets
POST   /api/v1/tickets                   # Create ticket
GET    /api/v1/tickets/:id              # Get ticket
PATCH  /api/v1/tickets/:id              # Update ticket
POST   /api/v1/tickets/:id/comments     # Add comment
GET    /api/v1/tickets/:id/history      # Ticket timeline
POST   /api/v1/tickets/:id/assign      # Assign ticket
POST   /api/v1/tickets/:id/escalate    # Escalate

# Service Catalog
GET    /api/v1/service-catalog           # Available services
POST   /api/v1/service-catalog/:id/request  # Request a service

# CCTV
GET    /api/v1/cctv/cameras              # All cameras
GET    /api/v1/cctv/cameras/:id/stream   # Get stream URL
GET    /api/v1/cctv/cameras/:id/events   # Camera events

# VDI
GET    /api/v1/vdi/pools                 # VDI pool overview
GET    /api/v1/vdi/sessions              # Active sessions
GET    /api/v1/vdi/metrics               # Performance metrics

# Automation
GET    /api/v1/automation/rules          # All rules
POST   /api/v1/automation/rules          # Create rule
GET    /api/v1/automation/executions     # Execution history

# Reports
GET    /api/v1/reports                   # Available reports
POST   /api/v1/reports/:id/generate     # Generate report
GET    /api/v1/reports/exports/:id      # Download export

# Notifications
GET    /api/v1/notifications             # User notifications
PATCH  /api/v1/notifications/:id/read   # Mark as read

# Admin
GET    /api/v1/admin/users               # Manage users
GET    /api/v1/admin/roles               # Manage roles
GET    /api/v1/admin/audit-logs          # Audit trail
GET    /api/v1/admin/settings            # System settings

# Health
GET    /api/v1/health                    # System health (no auth)
GET    /api/v1/health/detailed           # Detailed health (admin only)
```

---

## CI/CD Pipeline

### Pipeline Stages
```yaml
stages:
  - lint          # ESLint, Prettier check
  - type-check    # TypeScript compilation
  - unit-test     # Jest unit tests
  - sast          # SonarQube / Semgrep static analysis
  - sca           # Snyk dependency vulnerability scan
  - secret-scan   # GitLeaks secret detection
  - build         # Build application + Docker images
  - container-scan # Trivy container vulnerability scan
  - integration-test # API integration tests
  - dast          # OWASP ZAP dynamic scan (staging)
  - deploy-staging # Deploy to staging
  - smoke-test    # Automated smoke tests on staging
  - approval      # Manual approval gate (production)
  - deploy-prod   # Blue-green deploy to production
  - post-deploy   # Health checks, rollback if unhealthy
```

### Quality Gates (Must Pass)
- 0 critical/high SAST findings
- 0 critical/high SCA vulnerabilities
- 0 secrets detected
- Code coverage > 80%
- All unit tests pass
- All integration tests pass
- Container scan: 0 critical vulnerabilities
- Lighthouse score > 90 (performance)
- API response time < 200ms (p95)

---

## Complete Deliverables Checklist

### Code Deliverables
| # | Deliverable | Tech |
|---|-------------|------|
| 1 | Backend API + Business Logic | NestJS / TypeScript |
| 2 | Frontend Web Application | Next.js / React |
| 3 | Discovery Engine (network scanner) | Go |
| 4 | Endpoint Agent | Go |
| 5 | GPS Ingestion Service | Go |
| 6 | Database Schema + Migrations | Prisma / PostgreSQL |
| 7 | CMDB Module | NestJS module |
| 8 | ITAM Module | NestJS module |
| 9 | EAM Module | NestJS module |
| 10 | NMS Module | NestJS + Go |
| 11 | Fleet/GPS Module | NestJS + Go |
| 12 | Patch Management Module | NestJS |
| 13 | License Management Module | NestJS |
| 14 | VDI Monitoring Module | NestJS |
| 15 | CCTV Management Module | NestJS |
| 16 | ITSM Ticketing Module | NestJS |
| 17 | Automation Engine | NestJS |
| 18 | Notification Engine | NestJS |
| 19 | Reporting Engine | NestJS |
| 20 | Auth + RBAC System | NestJS |
| 21 | Multi-tenant System | NestJS middleware |
| 22 | Audit Logging System | NestJS interceptor |
| 23 | API Gateway | NestJS / Kong |
| 24 | SaaS Billing Module (optional) | NestJS + Stripe |

### Infrastructure Deliverables
| # | Deliverable |
|---|-------------|
| 25 | Dockerfiles (all services) |
| 26 | docker-compose.yml (local dev) |
| 27 | docker-compose.prod.yml (production) |
| 28 | Kubernetes Helm charts |
| 29 | Terraform modules (AWS/Azure/GCP) |
| 30 | CI/CD pipeline configs (GitHub Actions) |
| 31 | Nginx/Traefik reverse proxy config |
| 32 | Prometheus + Grafana monitoring setup |

### Documentation Deliverables
| # | Deliverable |
|---|-------------|
| 33 | Software Requirements Specification (IEEE 830) |
| 34 | Architecture Decision Records (ADRs) |
| 35 | API Documentation (OpenAPI 3.0 / Swagger) |
| 36 | Database ERD diagrams |
| 37 | User guide / admin manual |
| 38 | Deployment guide (SaaS + On-Prem) |
| 39 | Compliance mapping document (ISO, NIST, ITIL) |
| 40 | SSDLC documentation (threat models, security controls) |

### Data & Testing
| # | Deliverable |
|---|-------------|
| 41 | Seed data (realistic mock data for demo) |
| 42 | Sample tenant configurations |
| 43 | Unit test suite (>80% coverage) |
| 44 | Integration test suite |
| 45 | E2E test suite (Playwright) |
| 46 | Performance/load test scripts (k6) |

---

## Implementation Phases

### Phase 1 — Foundation (Weeks 1-4)
- Project scaffolding (Turborepo monorepo)
- Database schema + Prisma setup
- Auth system (local + JWT + RBAC)
- Multi-tenant middleware + RLS
- Base UI (layout, navigation, dark/light theme)
- Audit logging interceptor
- Health checks + basic monitoring

### Phase 2 — Core Asset Management (Weeks 5-8)
- CMDB + Asset CRUD (unified asset model)
- Asset types + custom fields
- IT asset details (hardware, OS, software)
- Non-IT asset management (EAM)
- Manual entry forms + CSV/Excel import
- Asset lifecycle management
- Asset search + filtering + bulk operations

### Phase 3 — Discovery & Scanning (Weeks 9-12)
- Go-based discovery engine
- Agent-based scanning (Go agent)
- Agentless: SNMP, WMI, SSH scanning
- Active Directory import
- Cloud discovery (AWS/Azure/GCP)
- Auto-classification + correlation
- Credential vault

### Phase 4 — ITSM & Ticketing (Weeks 13-16)
- Full ticketing system (incident, problem, change, request)
- Self-service portal + service catalog
- SLA management + escalations
- Workflow builder (visual, no-code)
- Knowledge base
- Email-to-ticket integration
- Work order management

### Phase 5 — Network & Patch Management (Weeks 17-20)
- NMS: SNMP polling, topology mapping
- NMS: alerts, traps, syslog
- NMS: config management
- Patch scanning + deployment engine
- Patch approval workflows
- Vulnerability assessment dashboard
- License management + compliance

### Phase 6 — Fleet, CCTV & VDI (Weeks 21-24)
- GPS ingestion service (Go)
- Fleet dashboard + live map
- Geofencing engine (PostGIS)
- CCTV: ONVIF discovery + camera management
- CCTV: live view proxy (RTSP → HLS/WebRTC)
- VDI monitoring (VMware/Citrix/Azure API integration)

### Phase 7 — Automation, Reports & Polish (Weeks 25-28)
- Automation engine (rule builder + execution)
- Notification engine (multi-channel)
- Reporting engine (custom reports + scheduled delivery)
- Change request lifecycle (SSDLC workflow)
- Dashboard customization (drag-and-drop widgets)
- Global search (Meilisearch integration)
- Performance optimization

### Phase 8 — Production Readiness (Weeks 29-32)
- Security hardening + penetration testing
- CI/CD pipeline finalization
- Docker/K8s production configs
- On-prem installation packaging
- SaaS billing integration (optional)
- Load testing + optimization
- Documentation completion
- End-to-end test suite
- Demo environment with mock data

---

## Things You Specified That Are Preserved

✅ IT + Non-IT asset management
✅ GPS fleet tracking with geofencing
✅ Ticket raising from user dashboards
✅ Admin dashboard with alerts/notifications
✅ Ticket status management
✅ Patch management for software updates
✅ License management
✅ SaaS + On-Premise deployment
✅ Agent + Agentless + SNMP + Cloud scanning
✅ Auto-discovery of network devices
✅ Manual entry + CSV/Excel import
✅ CMDB with relationships
✅ Automation engine
✅ Role-based access with SSO/MFA
✅ NMS (network monitoring)
✅ VDI monitoring
✅ CCTV management
✅ ITIL/ISO/NIST/SSDLC compliance
✅ Change request lifecycle (full SSDLC)
✅ ManageEngine-inspired design
✅ Production-ready architecture
✅ Full documentation
✅ Mock data

## Additional Items Added From Research

✅ PostGIS for spatial queries (geofencing, asset location)
✅ TimescaleDB for time-series metrics (network, GPS, VDI)
✅ Hash-chained audit logs (tamper-proof compliance)
✅ Transactional outbox pattern for event consistency
✅ Row-Level Security for tenant isolation
✅ IoT/OT protocol support (MQTT, Modbus, BACnet)
✅ Known Error Database (KEDB) for problem management
✅ Service catalog with approval workflows
✅ Asset correlation engine (deduplicate multi-source discoveries)
✅ Spare parts inventory management
✅ Floor plan views with asset pins
✅ NOC/Kiosk display mode
✅ CIS benchmark compliance checking
✅ Data classification levels
✅ GDPR/DPDP Act privacy compliance
✅ Lighthouse performance targets
✅ k6 load testing
✅ Playwright E2E tests
