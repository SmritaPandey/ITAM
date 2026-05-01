# System Architecture & Tech Stack

## Architecture Philosophy

**Approach:** Domain-Driven Modular Monolith with event-driven boundaries, designed for future microservice extraction.

**Rationale:** A modular monolith provides the structural discipline of microservices (bounded contexts, clean interfaces) without the operational complexity (service mesh, distributed tracing overhead). Each domain module can be independently extracted into a microservice when scaling demands it.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Web App      │  │  Mobile App  │  │  NOC Display │  │  API Docs  │  │
│  │  (Next.js)    │  │  (React      │  │  (Kiosk      │  │  (Swagger) │  │
│  │               │  │   Native)    │  │   Mode)      │  │            │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
└─────────┼──────────────────┼──────────────────┼───────────────┼─────────┘
          │                  │                  │               │
┌─────────▼──────────────────▼──────────────────▼───────────────▼─────────┐
│                          API GATEWAY LAYER                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  API Gateway (Kong / Custom Node.js Gateway)                     │   │
│  │  • Rate limiting  • JWT validation  • Tenant routing             │   │
│  │  • Request logging • API versioning • CORS                       │   │
│  └──────────────────────────────────┬───────────────────────────────┘   │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼──────────────────────────────────┐
│                        APPLICATION LAYER                               │
│                    (Node.js / TypeScript Backend)                       │
│                                                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │
│  │  ITAM        │ │  EAM        │ │  NMS         │ │  Fleet/GPS      │  │
│  │  Module      │ │  Module     │ │  Module      │ │  Module         │  │
│  ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────────┤  │
│  │  Patch Mgmt  │ │  License    │ │  VDI         │ │  CCTV           │  │
│  │  Module      │ │  Module     │ │  Module      │ │  Module         │  │
│  ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────────┤  │
│  │  ITSM/       │ │  CMDB       │ │  Discovery   │ │  Automation     │  │
│  │  Ticketing   │ │  Module     │ │  Engine      │ │  Engine         │  │
│  ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────────┤  │
│  │  Auth/IAM    │ │  Reporting  │ │  Notification│ │  Compliance     │  │
│  │  Module      │ │  Module     │ │  Engine      │ │  Module         │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  SHARED KERNEL: Event Bus, Audit Logger, Tenant Context,         │   │
│  │  Credential Vault, File Storage, Search Index                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│                         DATA & INFRASTRUCTURE LAYER                    │
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │PostgreSQL│  │  Redis   │  │  Kafka/  │  │  MinIO   │  │Elastic- │ │
│  │ + PostGIS│  │  Cache   │  │  NATS    │  │  (S3)    │  │search   │ │
│  │          │  │  + PubSub│  │  Events  │  │  Files   │  │Search   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                             │
│  │TimescaleDB│ │ InfluxDB │  │ClickHouse│  ← Time-series for metrics  │
│  │(GPS/IoT) │  │(alt)     │  │(analytics│                             │
│  └──────────┘  └──────────┘  └──────────┘                             │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Recommended Tech Stack

### Backend (Core Application)
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Runtime** | Node.js 20+ LTS with TypeScript 5+ | Massive ecosystem, excellent async I/O, rapid development, strong typing |
| **Framework** | NestJS | Enterprise-grade, modular architecture (DDD-friendly), built-in DI, guards, interceptors, microservice-ready |
| **ORM** | Prisma | Type-safe database access, excellent migration tooling, schema-first design |
| **API Style** | REST (primary) + GraphQL (dashboards) + WebSocket (real-time) | REST for CRUD, GraphQL for flexible dashboard queries, WS for live updates |
| **Validation** | Zod + class-validator | Runtime type safety and request validation |
| **Auth** | Passport.js + custom JWT + OIDC | Flexible auth strategies, SSO support |

### Backend (Performance-Critical Services)
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Discovery Engine** | Go (Golang) | High-concurrency network scanning (goroutines), efficient SNMP/SSH handling, low memory footprint |
| **SNMP Poller** | Go + gosnmp library | Native SNMP v1/v2c/v3 support, high throughput polling |
| **GPS Ingestion** | Go + Protocol Buffers | Handle thousands of concurrent GPS device connections via TCP/UDP |
| **Video Stream Proxy** | Go / FFmpeg integration | RTSP stream relay, thumbnail generation |

### Frontend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Framework** | Next.js 14+ (App Router) | SSR/SSG for SEO, API routes, excellent DX, React ecosystem |
| **State Management** | Zustand + TanStack Query | Lightweight global state + server state caching |
| **UI Library** | Shadcn/ui + Radix primitives | Accessible, customizable, enterprise-grade components |
| **Styling** | Tailwind CSS 4 | Utility-first, consistent design system, dark mode built-in |
| **Charts** | Recharts + D3.js (custom) | Standard charts via Recharts, complex visualizations via D3 |
| **Maps** | Leaflet + React-Leaflet | Open-source mapping for GPS/fleet tracking |
| **Tables** | TanStack Table | Virtualized, sortable, filterable data tables for asset lists |
| **Forms** | React Hook Form + Zod | Performant forms with schema validation |
| **Real-time** | Socket.io client | WebSocket for live dashboards, GPS, alerts |

### Data Layer
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Primary DB** | PostgreSQL 16+ with PostGIS | ACID transactions, JSONB for flexible attributes, PostGIS for geospatial (GPS, geofencing) |
| **Time-Series DB** | TimescaleDB (PostgreSQL extension) | Native PostgreSQL extension for metrics, GPS coordinates, sensor data — no separate DB to manage |
| **Cache** | Redis 7+ | Session store, rate limiting, real-time pub/sub for WebSocket, caching |
| **Message Broker** | NATS JetStream (primary) or Apache Kafka | Event-driven module communication, audit event streaming, scan job queuing. NATS for simplicity; Kafka if enterprise scale needed |
| **Search** | Meilisearch (or Elasticsearch) | Full-text search across all assets, tickets, knowledge base. Meilisearch for simpler ops; ES for enterprise scale |
| **Object Storage** | MinIO (self-hosted S3) / AWS S3 | Attachments, documents, firmware images, CCTV snapshots, report exports |
| **Vector DB** | pgvector (PostgreSQL extension) | AI-powered search, anomaly detection embeddings (future) |

### Infrastructure & DevOps
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Containerization** | Docker + Docker Compose | Consistent dev/staging/prod environments |
| **Orchestration** | Kubernetes (K8s) / Docker Swarm | Production scaling, self-healing, rolling updates |
| **CI/CD** | GitHub Actions / GitLab CI | Automated testing, SAST, building, deployment |
| **IaC** | Terraform + Helm Charts | Infrastructure as code for cloud and on-prem deployments |
| **Monitoring** | Prometheus + Grafana | Platform self-monitoring, alerting |
| **Logging** | Pino (structured) → Loki / ELK | Centralized log aggregation and analysis |
| **Tracing** | OpenTelemetry → Jaeger | Distributed tracing across modules |
| **Secrets** | HashiCorp Vault / Infisical | Credential vault for scan credentials, API keys, certificates |
| **Reverse Proxy** | Nginx / Traefik | TLS termination, load balancing, routing |

### Mobile (Phase 2)
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Framework** | React Native + Expo | Code sharing with web, single team capability |
| **QR/Barcode** | react-native-camera + ML Kit | Asset scanning, check-in/check-out |
| **Offline** | WatermelonDB | Offline-first with sync |
| **Push** | Firebase Cloud Messaging | Cross-platform push notifications |

---

## Multi-Tenant Architecture

### Strategy: Shared Database with Row-Level Security (RLS)

```
┌─────────────────────────────────────────────┐
│           PostgreSQL Database                │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  RLS Policy: tenant_id = current()  │    │
│  │                                     │    │
│  │  ┌─────────┐  ┌─────────┐          │    │
│  │  │Tenant A │  │Tenant B │  ...      │    │
│  │  │ data    │  │ data    │           │    │
│  │  └─────────┘  └─────────┘          │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Enterprise tier: Schema-per-tenant option  │
└─────────────────────────────────────────────┘
```

**Implementation:**
- Every table has `tenant_id` column (UUID, NOT NULL, indexed)
- PostgreSQL RLS policies enforce automatic data isolation
- Application sets `app.current_tenant` session variable on every connection
- Middleware extracts tenant from JWT and sets context
- Superuser/system operations use a bypass role for cross-tenant queries (admin, billing)
- Enterprise customers can opt for schema-per-tenant or database-per-tenant isolation

### Tenant Hierarchy
```
Super Admin (Platform Owner)
  └── Tenant (Organization)
        ├── Sites / Locations
        │     ├── Departments
        │     │     └── Teams
        │     └── Floors / Zones
        └── Users (with roles)
```

---

## Module Communication

### Internal (Intra-Process)
- Direct service injection via NestJS DI container
- Shared interfaces (ports) defined per module
- No direct database access across module boundaries
- Each module owns its database tables (logical schema separation)

### Async (Event-Driven)
- Module publishes domain events to NATS/Kafka
- Other modules subscribe to relevant events
- Event schema registry for versioning
- Dead letter queue for failed event processing

**Key Event Flows:**
```
Discovery → "asset.discovered" → CMDB (upsert CI)
Discovery → "device.new_unmanaged" → Automation Engine (evaluate rules)
CMDB → "asset.updated" → License Module (check compliance)
Ticket → "ticket.created" → Notification Engine (send alerts)
Patch Scanner → "patch.missing" → Automation Engine → Ticket (create remediation)
GPS Tracker → "vehicle.geofence_breach" → Automation Engine → Notification
NMS → "device.down" → Automation Engine → Ticket (create incident)
Agent → "security.av_disabled" → Automation Engine → Alert + Ticket
```

---

## Deployment Models

### SaaS (Cloud-Hosted)
```
┌─────────────────────────────────────────┐
│  Cloud Provider (AWS / Azure / GCP)      │
│                                         │
│  ┌───────────┐  ┌───────────────────┐   │
│  │ CDN       │  │ Load Balancer     │   │
│  │ (CloudFr) │  │ (ALB/NLB)        │   │
│  └─────┬─────┘  └────────┬──────────┘   │
│        │                 │              │
│  ┌─────▼─────────────────▼──────────┐   │
│  │  Kubernetes Cluster              │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐     │   │
│  │  │ App  │ │ App  │ │Workers│    │   │
│  │  │ Pod1 │ │ Pod2 │ │(Scan)│     │   │
│  │  └──────┘ └──────┘ └──────┘     │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ RDS  │ │Redis │ │ NATS │ │ S3   │  │
│  │(PG)  │ │Cloud │ │      │ │      │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
└─────────────────────────────────────────┘
```

**SaaS Features:**
- Multi-tenant with RLS
- Usage-based billing (assets managed, agents deployed, users)
- Subscription tiers: Starter, Professional, Enterprise
- API rate limiting per tenant
- Tenant onboarding wizard
- Data residency options (region selection)

### On-Premises
```
┌──────────────────────────────────────────┐
│  Customer Data Center / Private Cloud     │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Docker Compose / K8s Cluster     │  │
│  │  (Single-node or HA cluster)      │  │
│  │                                    │  │
│  │  All services + databases          │  │
│  │  packaged in containers            │  │
│  └────────────────────────────────────┘  │
│                                          │
│  • Offline mode (air-gapped support)     │
│  • Local PostgreSQL / Redis              │
│  • LDAP/AD integration                   │
│  • Backup/restore tooling               │
│  • Update packages (downloadable)        │
│  • License file activation               │
└──────────────────────────────────────────┘
```

---

## Authentication & Authorization

### Authentication Methods
| Method | Description |
|--------|------------|
| **Local Auth** | Email/password with bcrypt hashing, configurable password policy |
| **SSO - SAML 2.0** | Enterprise SSO via Okta, Azure AD, OneLogin, ADFS |
| **SSO - OIDC** | Google Workspace, Microsoft 365, custom OIDC providers |
| **LDAP/AD** | Direct bind authentication against Active Directory |
| **MFA** | TOTP (Google Authenticator), SMS (optional), Email OTP, WebAuthn/FIDO2 |
| **API Keys** | Scoped API keys for integrations, per-tenant |

### Role-Based Access Control (RBAC)
```
Super Admin (Platform)
  └── Tenant Admin (Organization)
        ├── IT Admin (Full IT module access)
        ├── IT Manager (IT oversight, approvals)
        ├── IT Technician (Ticket handling, patch deployment)
        ├── Network Admin (NMS full access)
        ├── Fleet Manager (GPS/fleet full access)
        ├── Security Admin (CCTV, security posture)
        ├── Facility Manager (EAM, maintenance)
        ├── Department Manager (Team assets, approvals)
        ├── Employee (Self-service portal, raise tickets)
        └── Auditor (Read-only, reports, compliance)
```

### Permission Matrix
- Granular permissions per module, per action (create, read, update, delete, approve, export)
- Custom role creation with permission cherry-picking
- Row-level permissions (e.g., "can only see assets in Department X")
- Time-based access (temporary elevated permissions)
- All permission changes logged in audit trail

---

## Project Structure

```
assetcommand/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/                      # App Router pages
│   │   ├── components/               # Shared UI components
│   │   ├── lib/                      # Client utilities
│   │   └── public/                   # Static assets
│   ├── api/                          # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # Authentication & authorization
│   │   │   │   ├── tenant/           # Multi-tenant management
│   │   │   │   ├── itam/             # IT Asset Management
│   │   │   │   ├── eam/              # Enterprise Asset Management
│   │   │   │   ├── nms/              # Network Management System
│   │   │   │   ├── fleet/            # Fleet & GPS tracking
│   │   │   │   ├── patch/            # Patch management
│   │   │   │   ├── license/          # License management
│   │   │   │   ├── vdi/              # VDI monitoring
│   │   │   │   ├── cctv/             # CCTV management
│   │   │   │   ├── itsm/             # Ticketing & ITSM
│   │   │   │   ├── cmdb/             # CMDB
│   │   │   │   ├── discovery/        # Discovery orchestration
│   │   │   │   ├── automation/       # Automation engine
│   │   │   │   ├── notification/     # Notification engine
│   │   │   │   ├── reporting/        # Reports & analytics
│   │   │   │   ├── compliance/       # Compliance & audit
│   │   │   │   └── billing/          # SaaS billing (optional)
│   │   │   ├── common/               # Shared kernel
│   │   │   │   ├── database/         # Prisma client, migrations
│   │   │   │   ├── events/           # Event bus, domain events
│   │   │   │   ├── guards/           # Auth, RBAC, tenant guards
│   │   │   │   ├── interceptors/     # Logging, transform, audit
│   │   │   │   ├── decorators/       # Custom decorators
│   │   │   │   ├── filters/          # Exception filters
│   │   │   │   └── utils/            # Shared utilities
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Database schema
│   │   │   └── migrations/
│   │   └── test/
│   ├── discovery-agent/              # Go-based discovery engine
│   │   ├── cmd/
│   │   ├── internal/
│   │   │   ├── scanner/              # SNMP, SSH, WMI scanners
│   │   │   ├── collector/            # Data collectors
│   │   │   └── reporter/             # Report back to API
│   │   └── go.mod
│   ├── endpoint-agent/               # Lightweight endpoint agent
│   │   ├── cmd/
│   │   ├── internal/
│   │   │   ├── inventory/            # HW/SW inventory
│   │   │   ├── patch/                # Patch status check
│   │   │   ├── security/             # Security posture
│   │   │   └── heartbeat/            # Health check
│   │   └── go.mod
│   └── gps-ingestion/                # GPS data ingestion service
│       ├── cmd/
│       ├── internal/
│       │   ├── protocols/            # Traccar, custom GPS protocols
│       │   ├── processor/            # Geofence evaluation
│       │   └── publisher/            # Publish to message queue
│       └── go.mod
├── packages/
│   ├── shared-types/                 # Shared TypeScript types
│   ├── ui/                           # Shared UI component library
│   └── config/                       # Shared configs (ESLint, TS)
├── infra/
│   ├── docker/                       # Dockerfiles
│   ├── docker-compose.yml            # Local dev environment
│   ├── docker-compose.prod.yml       # Production compose
│   ├── helm/                         # Kubernetes Helm charts
│   ├── terraform/                    # Infrastructure as code
│   └── scripts/                      # Setup, backup, restore scripts
├── docs/
│   ├── architecture/                 # Architecture decision records
│   ├── api/                          # API documentation
│   ├── srs/                          # IEEE 830 SRS document
│   ├── user-guide/                   # End-user documentation
│   └── compliance/                   # Compliance mapping documents
├── .github/
│   └── workflows/                    # CI/CD pipelines
├── turbo.json                        # Turborepo config
├── package.json                      # Root workspace
└── README.md
```
