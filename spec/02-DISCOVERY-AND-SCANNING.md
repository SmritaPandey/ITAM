# Discovery & Scanning Engine Specification

## Overview
The Discovery Engine is responsible for automatically detecting, inventorying, and maintaining awareness of all assets across the organization's IT infrastructure, physical facilities, cloud environments, and IoT/OT networks.

**Inspired by:** ManageEngine AssetExplorer Discovery, Endpoint Central Agent, OpManager SNMP Discovery

---

## 1. Agent-Based Discovery

### Lightweight Agent (AssetCommand Agent)
- **Platforms:** Windows (7+), macOS (10.14+), Linux (Ubuntu, RHEL, CentOS, Debian, SUSE, Fedora)
- **Footprint:** < 50MB RAM, < 1% CPU average
- **Installation Methods:** MSI/EXE (Windows), DMG/PKG (macOS), DEB/RPM (Linux), GPO deployment, logon scripts, manual install, remote push from console
- **Communication:** HTTPS/TLS 1.3 to server, configurable polling interval (default 15 min)
- **Heartbeat:** Periodic check-in to confirm device is online and managed

### Data Collected by Agent
| Category | Details |
|----------|---------|
| **Hardware** | CPU, RAM, disk (model, capacity, health/SMART), GPU, motherboard, serial numbers, BIOS/UEFI version, battery health (laptops), connected peripherals (USB, monitors) |
| **Operating System** | Name, version, build, architecture, install date, last boot time, uptime |
| **Software Inventory** | Installed applications (name, version, publisher, install date, size), Windows Store/Snap/Flatpak apps, browser extensions |
| **Patch Status** | Missing OS patches, missing third-party patches, installed update history, reboot pending status |
| **Security Posture** | Antivirus (installed, version, definitions date, real-time protection), Firewall (on/off, rules count), Disk encryption (BitLocker/FileVault/LUKS status), TPM presence and version |
| **Network** | IP address(es), MAC address(es), DNS, gateway, DHCP/static, WiFi SSID, network adapter details |
| **User Info** | Logged-in user(s), last login time, domain membership |
| **Performance** | Real-time CPU/RAM/disk usage, process list, startup items |
| **Compliance** | CIS benchmark checks, custom compliance rules evaluation |

### Agent Capabilities Beyond Discovery
- Remote script execution (PowerShell, Bash, Python) — with approval workflow
- Patch installation (silent deployment)
- Software installation/uninstallation
- Remote desktop/assist initiation
- File transfer
- Registry/config manipulation
- VDI session telemetry collection

---

## 2. Agentless Discovery

### Protocols & Methods
| Method | Use Case | Requirements |
|--------|----------|-------------|
| **WMI (Windows Management Instrumentation)** | Windows devices — hardware, software, services | Admin credentials, WMI enabled, DCOM ports |
| **SSH** | Linux/macOS/Unix — full system inventory | SSH credentials (key or password), sudo access |
| **SNMP v1/v2c/v3** | Network devices — switches, routers, firewalls, printers, UPS | Community string (v1/v2c) or auth/priv credentials (v3) |
| **WinRM** | Windows remote management | WinRM enabled, HTTPS preferred |
| **Telnet** | Legacy network devices (fallback only) | Credentials, insecure — use only for legacy |
| **ICMP/Ping Sweep** | Host discovery — alive/dead detection | Network access, ICMP not blocked |
| **TCP Port Scan** | Service discovery, OS fingerprinting | Network access to target ports |
| **ARP Sweep** | Layer 2 device discovery on local subnet | Local subnet access |
| **Nmap Integration** | Advanced port scanning, service detection, OS fingerprinting | Nmap binary available on scan server |

### Network Scan Scheduling
- One-time scans (manual trigger)
- Scheduled scans (hourly, daily, weekly, monthly, custom cron)
- Continuous monitoring mode (event-driven on new device detection)
- Scan windows (restrict scanning to off-peak hours)

---

## 3. Active Directory / LDAP Import

- Sync users, computers, groups, OUs from AD/LDAP
- Scheduled sync (configurable interval)
- Attribute mapping (AD fields → AssetCommand fields)
- Auto-create asset records for discovered AD computers
- Auto-assign assets to users based on AD computer-user mapping
- Support for multiple AD domains/forests
- LDAPS (secure LDAP) support

---

## 4. Cloud Asset Discovery

### Supported Cloud Providers
| Provider | Assets Discovered |
|----------|------------------|
| **AWS** | EC2 instances, RDS databases, S3 buckets, Lambda functions, VPCs, Security Groups, ELB/ALB, EBS volumes, IAM users/roles, CloudFront distributions, Route53 |
| **Microsoft Azure** | Virtual Machines, SQL Databases, Storage Accounts, App Services, VNets, NSGs, Key Vaults, Azure AD users/groups, AKS clusters |
| **Google Cloud Platform** | Compute Engine instances, Cloud SQL, GCS buckets, GKE clusters, VPC networks, IAM, Cloud Functions |

### Cloud Discovery Features
- API-based discovery (read-only service account credentials)
- Multi-account/subscription support
- Tag-based asset classification
- Cloud security posture checks (public access, encryption, logging enabled)
- Cost attribution per asset
- Auto-sync interval: configurable (default: every 4 hours)
- Cloud-to-CMDB mapping

---

## 5. SNMP Deep Discovery

### Capabilities
- SNMP v1, v2c, v3 (AuthPriv with SHA/AES)
- Auto-discovery via sysOID → manufacturer/model identification
- MIB browser for custom OID mapping
- **Printer Discovery:** Toner levels, page counts, paper tray status, error states, supply replacement alerts
- **Network Device Discovery:** Interface table, routing table, ARP table, VLAN config, port status, PoE status
- **UPS Discovery:** Battery health, load percentage, remaining runtime, input/output voltage
- **Environment Sensors:** Temperature, humidity, door contacts (via SNMP-enabled sensors)
- Custom OID polling for any SNMP-enabled device

---

## 6. CCTV & IoT Discovery

### ONVIF Camera Discovery
- Multicast probe for ONVIF-compliant cameras on network
- Auto-detect: manufacturer, model, firmware version, IP, MAC
- Stream URL extraction (main stream + sub stream)
- PTZ capability detection
- Recording capability detection

### IoT/OT Device Discovery
- Protocol support: MQTT, CoAP, Modbus (TCP/RTU), BACnet
- Device type classification based on protocol fingerprinting
- Sensor data ingestion (temperature, humidity, pressure, vibration)
- Integration with IoT gateways

---

## 7. VDI Pool Discovery

- VMware Horizon: vCenter API integration for pool, farm, session data
- Citrix: Delivery Controller API for site, catalog, delivery group data
- Azure Virtual Desktop: Azure API for host pool, session host, user session data
- Amazon WorkSpaces: AWS API for workspace, bundle, directory data
- Auto-map VDI sessions to user identities

---

## 8. Auto-Classification & Correlation

### Device Classification
When a new device is discovered:
1. Fingerprint the device (OS, open ports, SNMP sysDescr, MAC OUI)
2. Auto-classify into asset type (Server, Workstation, Printer, Switch, Router, etc.)
3. Auto-assign tags (e.g., "New Device", "Unmanaged", "Windows Server")
4. Check against existing CMDB for duplicates (serial number, MAC, hostname matching)
5. If new: create asset record, flag as "Pending Review"
6. If existing: update attributes, log changes
7. Trigger automation rule: "New unmanaged device detected" → notify admin

### Correlation Engine
- Deduplicate assets discovered from multiple sources (agent + agentless + cloud + AD)
- Priority hierarchy: Agent data > WMI/SSH data > SNMP data > AD data
- Merge rules configurable by admin
- Confidence scoring for matches
- Manual merge/split capability for edge cases

---

## 9. Manual Entry & Import

### Web UI Forms
- Admin-configurable forms per asset type
- Required/optional field definitions
- Custom field support (text, number, date, dropdown, checkbox, file upload)
- Barcode/QR scanner integration (mobile-friendly)
- Bulk create with copy/template

### Bulk Import
- CSV import with column mapping wizard
- Excel (XLSX) import with sheet selection
- JSON/XML import for API-driven ingestion
- Validation and error reporting before commit
- Import history with rollback capability
- Scheduled imports from external sources (SFTP, API endpoint)

### Mobile App Asset Entry
- QR/barcode scan to create or look up asset
- Photo capture for asset condition documentation
- GPS location capture for physical asset placement
- Offline mode with sync when connected
- NFC tag read/write support

---

## 10. Scan Security & Governance

### Credential Vault
- Encrypted storage for all scan credentials (AES-256)
- Role-based access to credential sets
- Credential rotation reminders
- No credentials stored on scan targets
- Audit log for credential access

### Scan Permissions
- Scan scope restrictions per admin role
- IP range/subnet restrictions
- Scan type restrictions (e.g., "agentless only for production")
- Approval workflow for first-time scan of new subnets
- Rate limiting to prevent network impact

### Compliance
- All scan activities logged with timestamp, user, scope, results
- Scan reports for audit evidence
- Data retention policies for scan results
- PII handling: mask sensitive data in scan results where applicable
