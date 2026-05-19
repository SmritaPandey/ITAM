# AssetCommand — Gap Remediation & Enhancement Plan

> **Date:** May 13, 2026 | **Status:** Implementation Plan | **Author:** AI Engineering

---

## Executive Summary

This plan addresses **all major gaps** between the 14-module product spec and the current implementation. Work is organized into **5 phases**, ordered by impact and dependency — each phase builds on the previous.

**Key principle:** No mocks. Every feature delivers **real, working functionality**.

---

## Phase 1: Real-Time Engine & Notification Delivery

**Impact: CRITICAL** — Foundation for everything else. Every module benefits from WebSocket push and real notification delivery.

### 1A. WebSocket Gateway (Socket.io)

**File:** `apps/api/src/common/websocket/events.gateway.ts`

Real-time push for:
- Dashboard stats auto-refresh (every 30s)
- Network device status changes (instant)
- Agent heartbeats (live online/offline)
- Automation rule executions (live feed)
- Scan progress updates (live %)
- Ticket assignments (instant notification)

**Implementation:**
- NestJS `@nestjs/websockets` + `socket.io` adapter
- JWT auth via handshake — only authenticated users receive events
- Room-based isolation: each tenant gets its own room (`tenant:<id>`)
- The existing `EventBusService` wildcards (`*`) will forward to WebSocket rooms
- Frontend: new `useRealtimeEvents()` hook using `socket.io-client`

**Key Innovation:** The EventBus already emits `*` events — we just bridge them to WebSocket. Zero changes to existing modules needed.

**New files:**
```
apps/api/src/common/websocket/
├── events.gateway.ts          # Socket.io gateway with JWT auth
├── websocket.module.ts        # NestJS module
└── websocket.adapter.ts       # IoAdapter for CORS handling

apps/web/src/lib/
├── useRealtimeEvents.ts       # React hook for WebSocket events
└── socket.ts                  # Socket.io client singleton
```

**Dependencies:** `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `socket.io-client`

---

### 1B. Email Notification Delivery (Nodemailer)

**File:** `apps/api/src/modules/notifications/email.service.ts`

Currently notifications are in-app only. Add real SMTP email delivery:
- Configurable SMTP per tenant (via Settings page)
- HTML email templates (ticket assigned, device down, license expiring, patch overdue)
- Fallback to `console.log` if SMTP not configured
- Rate limiting: max 100 emails/hour per tenant
- Queue-based: emails pushed to a Bull/Redis queue, processed async

**Wire into existing code:**
- `NotificationChannelsService.send()` — add `EMAIL` type handler
- `AutomationService.actionSendNotification()` — trigger email alongside in-app
- Settings page: add SMTP configuration form

**New files:**
```
apps/api/src/modules/notifications/
├── email.service.ts           # Nodemailer SMTP service
├── email-templates.ts         # HTML email templates
└── email-queue.service.ts     # Bull queue processor
```

**Dependencies:** `nodemailer`, `@types/nodemailer`, `bull` (optional, can use in-memory queue)

---

### 1C. Multi-Channel Notification Dispatch

Wire the existing `NotificationChannelsService` to actually dispatch on **all events** from the automation engine:

- **Slack:** Already implemented (webhook POST) ✅
- **Teams:** Already implemented (MessageCard POST) ✅ 
- **Webhook:** Already implemented ✅
- **Email:** NEW — via Nodemailer (Phase 1B)
- **SMS:** Stub with Twilio-ready interface (log only until API key provided)

**Enhancement:** Add digest mode — instead of instant notification per event, aggregate events into hourly/daily digest emails.

---

## Phase 2: Network Monitoring (Real SNMP + Advanced NMS)

**Impact: HIGH** — Transforms the NMS page from "ping + port scan" to real network monitoring.

### 2A. SNMP Polling Service

**File:** `apps/api/src/common/scanners/snmp.scanner.ts`

Using the `net-snmp` npm package (pure Node.js, no Go needed):

**What it polls:**
- **System info:** sysDescr, sysName, sysUpTime, sysContact, sysLocation (OIDs 1.3.6.1.2.1.1.*)
- **Interfaces:** ifIndex, ifDescr, ifType, ifSpeed, ifAdminStatus, ifOperStatus, ifInOctets, ifOutOctets (OIDs 1.3.6.1.2.1.2.2.1.*)
- **CPU load:** (vendor-specific: Cisco 1.3.6.1.4.1.9.9.109, generic HOST-MIB 1.3.6.1.2.1.25.3.3.1.2)
- **Memory:** hrStorageDescr, hrStorageUsed, hrStorageSize (OIDs 1.3.6.1.2.1.25.2.3.1.*)
- **ARP table:** for MAC→IP mapping

**Storage:** Results stored in `MonitoredDevice.metrics` JSON column — no schema changes needed.

**Scheduled polling:** 
- Cron every 5 minutes for all SNMP-enabled devices
- Store 24h of metrics history in a new `DeviceMetricsHistory` model (append-only)
- Frontend: real bandwidth charts from actual ifInOctets/ifOutOctets deltas

**New files:**
```
apps/api/src/common/scanners/
└── snmp.scanner.ts            # SNMP v1/v2c/v3 poller

apps/api/src/modules/monitoring/
└── snmp-poller.service.ts     # Scheduled SNMP polling service
```

**Schema addition:**
```prisma
model DeviceMetricsHistory {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  deviceId    String   @map("device_id") @db.Uuid
  metrics     Json     // { cpu, ram, ifInOctets, ifOutOctets, latency, uptime }
  collectedAt DateTime @default(now()) @map("collected_at")

  @@index([deviceId, collectedAt])
  @@map("device_metrics_history")
}
```

**Dependencies:** `net-snmp`

---

### 2B. Network Topology Auto-Generation

Enhance the existing `getTopology()` to build **real** topology:
- Parse ARP tables from SNMP to identify neighbors
- Use LLDP/CDP data (if available via SNMP) for physical topology
- Store topology edges as `AssetRelationship` entries (type: `CONNECTED_TO`)
- Frontend: interactive D3.js or canvas-based topology map with drag-and-drop

---

### 2C. SNMP Trap Receiver

**File:** `apps/api/src/modules/monitoring/trap-receiver.service.ts`

Listen on UDP port 162 for SNMP traps:
- Parse trap OIDs and map to human-readable events
- Auto-create notifications for linkDown, authenticationFailure, etc.
- Feed into automation engine via `eventBus.emitMonitoringEvent()`
- Store trap history in audit log

---

### 2D. NMS Frontend Enhancements

Upgrade the network page with:
- **Real-time bandwidth chart** using WebSocket-pushed SNMP data (no more simulated curves)
- **Device detail drawer** showing SNMP-collected interfaces, CPU/RAM gauges, uptime
- **Topology view tab** with interactive SVG/Canvas map
- **Trap event stream** — live SNMP trap feed
- **Interface utilization heatmap** — color-coded by load

---

## Phase 3: CCTV & VDI Real Device Integration

**Impact: MEDIUM** — Converts demo pages into functional monitoring.

### 3A. ONVIF Camera Discovery

**File:** `apps/api/src/common/scanners/onvif.scanner.ts`

Using the `onvif` npm package:
- Auto-discover ONVIF cameras on the LAN
- Retrieve device info: manufacturer, model, firmware, serial
- Get RTSP stream URLs (main + sub stream)
- Get PTZ capabilities
- Probe for snapshot URLs
- Health check: periodic RTSP probe (connect + disconnect)

**Register discovered cameras as MonitoredDevice type=CAMERA** with real config data.

**Dependencies:** `onvif`

---

### 3B. RTSP Snapshot Proxy

**File:** `apps/api/src/modules/monitoring/camera-proxy.controller.ts`

Since browsers can't play RTSP directly, create an API endpoint that:
- Connects to camera RTSP URL
- Captures a JPEG snapshot (using ffmpeg or camera's HTTP snapshot URL)
- Returns it as `image/jpeg`
- Caches snapshots for 10s to avoid hammering cameras

**Frontend:** Replace the "LIVE FEED" placeholder with actual camera snapshot thumbnails, auto-refreshing every 10s.

---

### 3C. VDI Hypervisor Integration Stubs

Create integration interfaces for:
- **VMware Horizon:** REST API client (`/rest/monitor/sessions`)
- **Citrix:** OData API client
- **Azure Virtual Desktop:** Microsoft Graph API client

Initial implementation: VMware Horizon REST API (most common).

---

## Phase 4: Report Engine & Export

**Impact: MEDIUM** — Enterprise customers need export capabilities.

### 4A. Server-Side Report Generation

**File:** `apps/api/src/modules/reports/report-generator.service.ts`

Using `pdfkit` for PDF and `exceljs` for XLSX:

**Report types with real data:**
1. **Asset Inventory** — Full asset register with types, locations, values, depreciation
2. **Patch Compliance** — Missing patches per endpoint, CVE severity breakdown
3. **Ticket SLA Performance** — Response/resolution times vs SLA targets
4. **License Utilization** — Usage vs entitlement, cost analysis, renewal forecast
5. **Network Health** — Device uptime, SNMP metrics summary, top talkers
6. **Executive Dashboard** — Combined KPIs across all modules
7. **Audit Trail** — Full audit log with SHA-256 hash chain verification
8. **Compliance Report** — Endpoint policy violations, change detection summary

**API endpoints:**
```
GET  /reports/generate/:type?format=pdf|xlsx|csv
POST /reports/scheduled         # Create scheduled report
GET  /reports/scheduled         # List scheduled reports
```

**Scheduled delivery:** Use `@nestjs/schedule` cron + Nodemailer to email reports on schedule.

**Dependencies:** `pdfkit`, `exceljs`

---

### 4B. Frontend Report Builder

Enhance the reports page with:
- **Generate button** per report template that downloads PDF/XLSX
- **Schedule modal** — pick frequency (daily/weekly/monthly), format, recipients
- **Custom date range** filter for all reports
- **Preview mode** — render report as HTML before downloading

---

## Phase 5: DevOps, Testing & CI/CD

**Impact: MEDIUM** — Production hardening.

### 5A. GitHub Actions CI/CD

**File:** `.github/workflows/ci.yml`

```yaml
Pipeline:
  - Lint (ESLint)
  - Type check (tsc --noEmit)
  - Unit tests (Jest)
  - Build API (nest build)
  - Build Web (next build)
  - Deploy API to Railway (on main push)
  - Deploy Web to Vercel (on main push)
```

### 5B. Critical Path Tests

**Test coverage targets:**

| Module | Test Type | Priority |
|--------|-----------|----------|
| Auth (login/register/refresh/logout) | E2E | 🔴 Critical |
| Asset CRUD + search | Unit + E2E | 🔴 Critical |
| Ticket lifecycle (create→assign→resolve→close) | E2E | 🔴 Critical |
| Automation rule evaluation | Unit | 🟡 High |
| Discovery scan flow | Unit | 🟡 High |
| WebSocket event delivery | Integration | 🟡 High |
| SNMP poller | Unit (mocked) | 🟢 Medium |

---

## Implementation Order & Timeline

| # | Phase | Estimated Effort | Files Changed | New Dependencies |
|---|-------|-----------------|---------------|------------------|
| 1A | WebSocket Gateway | ~4 hours | 5 new, 3 modified | socket.io, @nestjs/websockets |
| 1B | Email Notifications | ~3 hours | 4 new, 2 modified | nodemailer |
| 1C | Notification Dispatch | ~2 hours | 2 modified | — |
| 2A | SNMP Polling | ~5 hours | 3 new, 1 schema, 2 modified | net-snmp |
| 2B | Topology Auto-Gen | ~3 hours | 2 modified | — |
| 2C | SNMP Trap Receiver | ~3 hours | 1 new, 1 modified | — |
| 2D | NMS Frontend | ~4 hours | 1 modified (network page) | — |
| 3A | ONVIF Discovery | ~3 hours | 2 new, 1 modified | onvif |
| 3B | RTSP Snapshot Proxy | ~2 hours | 1 new, 1 modified | — |
| 3C | VDI Integration | ~3 hours | 2 new | — |
| 4A | Report Generator | ~4 hours | 2 new, 1 modified | pdfkit, exceljs |
| 4B | Report Frontend | ~3 hours | 1 modified | — |
| 5A | CI/CD Pipeline | ~2 hours | 1 new | — |
| 5B | Test Suite | ~4 hours | 8 new | — |

**Total estimated: ~45 hours across 5 phases**

---

## Architectural Decisions

### Why Node.js for SNMP (not Go)?
The spec recommended Go for SNMP polling, but:
1. `net-snmp` npm package handles v1/v2c/v3 efficiently
2. Keeps the codebase in one language — simpler ops, simpler deployment
3. NestJS `@Cron` + async/await handles polling elegantly
4. For <500 devices, Node.js performance is more than sufficient
5. Go can be extracted later if scale demands it (modular monolith principle)

### Why not Kafka/NATS for events?
The current `EventEmitter`-based EventBus is sufficient for single-process deployment. Adding Kafka/NATS adds operational complexity without benefit at current scale. The EventBus interface is already abstracted — swapping to NATS later requires only changing `EventBusService`, not any consumers.

### Why Socket.io (not raw WebSocket)?
- Auto-reconnection with exponential backoff
- Room-based broadcasting (tenant isolation)
- Fallback to HTTP long-polling
- Built-in NestJS adapter (`@nestjs/platform-socket.io`)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| SNMP polling overwhelms DB | Batch upserts, 5min interval, only store delta metrics |
| WebSocket memory leak | Heartbeat ping/pong, auto-disconnect stale clients, max 100 clients/tenant |
| ONVIF cameras vary widely | Graceful fallback: if ONVIF fails, fall back to basic ICMP health check |
| PDF generation memory | Stream PDFs (pdfkit supports streaming), don't buffer entire report in memory |
| Email delivery failures | Queue + retry with exponential backoff, dead letter after 3 attempts |
