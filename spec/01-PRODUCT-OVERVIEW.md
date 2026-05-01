# AssetCommand — Enterprise Asset Monitoring & Management Platform

## Product Overview

**Inspired by:** ManageEngine Suite (ServiceDesk Plus, Endpoint Central, OpManager, AssetExplorer), Ivanti Neurons, ServiceNow ITAM/EAM, Asset Panda

**Product Name:** AssetCommand (working title)

**Vision:** A unified, enterprise-grade platform that consolidates IT Asset Management, Non-IT/Enterprise Asset Management, Network Monitoring, Fleet/GPS Tracking, Patch Management, CCTV Surveillance, VDI Monitoring, Ticketing/ITSM, and Compliance — into a single pane of glass.

---

## Platform Modules

### Module 1: IT Asset Management (ITAM)
- Hardware inventory: laptops, desktops, servers, workstations
- Network devices: switches, routers, firewalls, WiFi APs, load balancers
- Peripherals: printers, scanners, UPS, projectors
- Software inventory: installed applications, versions, usage metrics
- OS details: version, build, architecture, BIOS/UEFI
- Security posture: AV status, firewall state, encryption status, TPM
- Lifecycle: procurement → deployment → maintenance → retirement → disposal
- Warranty, AMC, service contract tracking
- Asset value depreciation (straight-line, declining balance)
- Cost center and department tagging
- QR/barcode/RFID label generation and scanning

### Module 2: Non-IT / Enterprise Asset Management (EAM)
- Machinery, tools, medical devices, lab equipment, industrial equipment
- Furniture, facility assets, HVAC, elevators, fire suppression systems
- Office inventory (stationery, consumables with reorder points)
- Custom asset type definitions (admin-configurable)
- Asset tracking via QR/RFID/barcode/NFC
- Preventive maintenance scheduling (calendar + condition-based)
- Maintenance lifecycle history with cost tracking
- Vendor/service provider management
- Spare parts inventory with min-stock alerts
- Work order automation linked to maintenance schedules
- Facility floor plans with asset pin mapping

### Module 3: Network Management System (NMS)
**Inspired by ManageEngine OpManager**
- **Supported Networks:** LAN, WAN, MPLS, IPSec/OpenVPN/SSL VPN, SD-WAN, Hybrid WAN, Cellular (4G/5G), Data center, Cloud networks
- **Discovery & Mapping:** SNMP v1/v2c/v3, LLDP/CDP, IP range scanning, ARP sweep, auto-detect switches/routers/firewalls/WiFi APs, auto-generate network topology maps (L2/L3), port mapping (physical + logical)
- **Monitoring:** Device health (CPU/RAM/disk/temp), interface utilization, errors/discards, latency, uptime/downtime, QoS, SD-WAN link health, VPN tunnel status
- **Traffic Analytics:** NetFlow/sFlow/JFlow, traffic patterns, anomaly detection, bandwidth monitoring, packet loss, jitter, top talkers, top applications
- **Configuration Management:** Backup/restore device configs, detect config drift, compliance against baseline, config versioning, automated deployment (with approval)
- **Alerts & Events:** SNMP trap collector, syslog ingestion, threshold-based alerts, AI anomaly detection, auto-ticket creation
- **Network Security:** Firewall policy monitoring, IDS/IPS integration hooks, VPN/brute-force alerts, rogue device detection, unmanaged device discovery
- **Dashboards:** Health dashboards, SLA/uptime, utilization heatmaps, NOC/plasma views, incident timelines

### Module 4: Fleet & GPS Asset Tracking
- Real-time GPS tracking on interactive map (Leaflet/OpenLayers)
- Route history playback with timeline slider
- Geo-fencing (circular + polygon zones) with entry/exit alerts
- Driver assignment and trip logging
- Vehicle health metrics and maintenance reminders
- Alerts: speeding, idling, unauthorized zone breach, tampering
- Fuel monitoring integration (OBD-II / telematics API)
- Route analytics and travel heatmaps
- Parking/idle duration tracking
- Integration layer for third-party GPS devices (Traccar protocol support)
- WebSocket real-time map updates

### Module 5: Patch & Vulnerability Management
**Inspired by ManageEngine Endpoint Central + Patch Manager Plus**
- Auto-scan endpoints for missing OS patches (Windows/macOS/Linux)
- Third-party application patch detection (350+ apps)
- NIST NVD CVE scoring and risk prioritization
- Patch deployment: scheduled, immediate, or policy-based
- Test & approve workflow (pilot group → wide deployment)
- Patch rollback capability
- Closed/air-gapped network patching support
- Patch compliance dashboard with drill-down
- Security bulletin tracking and correlation
- Automated compliance reports (NIST, ISO, CIS benchmarks)

### Module 6: Change Request & SSDLC Patch Lifecycle
Full change-request workflow for functional patches/upgrades:
1. **Request:** End user raises modification/addition/upgrade/feature request
2. **Review:** Developer/IT analyst reviews, clarifies scope, creates understanding document
3. **Approval:** End user approves understanding document
4. **Build:** Developer implements following SSDLC (secure coding, unit testing, functional testing)
5. **UAT:** User acceptance testing in staging environment
6. **VAPT:** Vulnerability Assessment & Penetration Testing (internal/external), fix findings, retest
7. **Patch-Fix Cycle:** Apply fixes from VAPT, revalidate, ensure zero critical/high findings
8. **Deployment:** Release management, change log, post-deployment monitoring
9. **Compliance Logging:** ISO/NIST patch cycle evidence, ITIL change management documentation

### Module 7: License & Software Management
- Track purchased licenses (per-seat, per-device, site, enterprise, subscription)
- Auto-detect software installations via agent/agentless scans
- License compliance: usage vs. entitlement comparison
- Alerts for overuse, underuse, and expiry
- Vendor-wise spending reports and renewal forecasts
- Software metering (usage frequency, last-used date)
- Blacklist/whitelist enforcement
- License harvesting recommendations (reclaim unused)
- Contract and PO linking

### Module 8: VDI Monitoring & Management
- Support: VMware Horizon, Citrix, Azure Virtual Desktop, Amazon WorkSpaces, generic VDI via APIs
- Track VDI sessions: login, logout, duration, connection quality
- Per-session metrics: CPU/RAM/disk/network utilization
- Session freeze/hang detection
- Resource exhaustion alerts and auto-scaling recommendations
- VDI pool utilization dashboards
- Abnormal behavior detection (unusual login times, locations)
- Profile disk (FSLogix) health monitoring
- Logon duration tracking and optimization insights
- Audit logs for all VDI activities

### Module 9: CCTV Management System
- Add camera endpoints via ONVIF/RTSP
- ONVIF auto-discovery on network
- Live video wall (grid view, customizable layouts)
- Camera health monitoring (online/offline, stream quality)
- Recording status tracking (NVR/DVR integration)
- Motion detection event logging
- Tamper detection alerts
- Storage utilization monitoring
- Incident flagging and annotation
- Audit log for camera access/viewing
- Snapshot and clip export

### Module 10: ITSM Ticketing & Workflows
**Inspired by ManageEngine ServiceDesk Plus**
- **ITIL Processes:** Incident, Problem, Change, Release, Service Request management
- **Omnichannel:** Email, web portal, mobile app, chat, API
- **Self-Service Portal:** Knowledge base, FAQ, service catalog
- **Ticket Types:** IT issues, asset requests ("need new laptop"), facility requests ("chair replacement"), fleet requests ("tire replacement"), maintenance requests
- **Auto-classification:** Category, priority, assignment based on rules
- **SLA Management:** Response time, resolution time, escalation tiers
- **Multi-level Approval:** Manager → IT → Admin → Super Admin chains
- **Visual Workflow Builder:** No-code drag-and-drop workflow designer
- **Asset Linking:** Every ticket can be linked to specific asset(s) from CMDB
- **Work Order Creation:** Convert tickets to work orders for maintenance teams
- **Escalation Engine:** Time-based, condition-based, hierarchical escalation
- **Satisfaction Surveys:** Post-resolution CSAT scoring

### Module 11: CMDB (Configuration Management Database)
- Unified repository for ALL asset types (IT, Non-IT, Network, Fleet, CCTV, VDI)
- CI classes with inheritance (Hardware > Server > Linux Server)
- Relationship mapping: dependency, composition, association
- Visual relationship canvas (drag-and-drop)
- Impact analysis for change management
- Auto-sync from discovery engines
- Cost center and business service mapping
- CI lifecycle state tracking
- Data quality scoring and certification workflows
- Common Service Data Model (CSDM) alignment

### Module 12: Automation Engine
Rule-based automation system:
```
IF [condition/sensor/log/event/alert]
THEN [action/ticket/notify/scan/run-script/workflow]
```
**Example Rules:**
- Device offline > 24h → create incident ticket
- Patch missing > 7 days → create remediation workflow + notify IT
- CCTV tamper detected → alert security + escalate
- SD-WAN jitter > threshold → alert NOC team
- License expiring < 30 days → notify procurement
- New unmanaged device on network → flag + create investigation ticket
- Vehicle outside geo-fence → alert fleet manager + log event
- VDI session CPU > 90% for 10min → alert + recommend scaling
- Temperature sensor anomaly → raise maintenance ticket

**Capabilities:**
- Visual rule builder (no-code)
- Scheduled automation (cron-based)
- Event-driven triggers (real-time)
- Webhook actions (external system integration)
- Script execution (PowerShell, Bash, Python)
- Chained actions (multi-step workflows)
- Audit trail for all automation executions

### Module 13: Alerts, Flags & Notifications
- Asset health alerts (hardware failure prediction, SMART disk status)
- Fleet GPS alerts (speed, geofence, idle, tamper)
- Network alerts (device down, high utilization, config change)
- Patch overdue alerts
- Ticket SLA breach alerts
- License expiry alerts
- CCTV tamper/offline alerts
- VDI resource exhaustion alerts
- Unauthorized/rogue device alerts
- High-risk vulnerability alerts
- Custom user-defined alert rules
- **Channels:** Email, SMS, push notification, Slack, Teams, webhook, in-app toast
- **Digest modes:** Instant, hourly digest, daily digest
- **Escalation chains:** Multi-tier notification escalation

### Module 14: Reports & Analytics
- Pre-built report library (100+ reports across all modules)
- Custom report builder (drag-and-drop)
- Scheduled report delivery (email/SFTP)
- Export: PDF, Excel, CSV, JSON
- Executive dashboards with KPIs
- Asset utilization analytics
- Cost analysis and TCO reports
- Patch & vulnerability statistics
- Fleet travel heatmaps and route analytics
- License compliance scorecards
- Network uptime and SLA reports
- Trend analysis and forecasting
- Compliance audit reports (ISO, NIST, ITIL evidence)
