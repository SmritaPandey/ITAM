# QS Asset — On-Premises Deployment & Operations Manual

This manual provides detailed, step-by-step instructions to orchestrate, configure, and maintain a private, secure **on-premises deployment** of the QS Asset Management & Network Discovery platform. 

---

## 🖥️ Platform Architecture

QS Asset employs a hybrid-capable architecture. When deployed on-premises, it operates inside a host network configuration to permit direct Layer-2 (ARP) and Layer-3 (Ping/TCP/SNMP) active sweeps over local network interfaces without external cloud dependencies.

```
                  ┌──────────────────────────────────────────┐
                  │          Local Web Browser               │
                  └────────────────────┬─────────────────────┘
                                       │ HTTP / Port 3100
                  ┌────────────────────▼─────────────────────┐
                  │         Next.js Web Frontend             │
                  └────────────────────┬─────────────────────┘
                                       │ HTTP / Port 4100
                  ┌────────────────────▼─────────────────────┐
                  │         NestJS Backend API               │
                  └─────┬──────────────────────┬─────────────┘
                        │                      │ 
        PostgreSQL / 5434                      │ Redis / 6379
  ┌─────────────────────▼─────┐          ┌─────▼─────────────────────┐
  │   PostgreSQL Database     │          │    Redis Cache & Queue    │
  │  (Relational CMDB Schemas)│          │ (Active Scanning Tasks)   │
  └───────────────────────────┘          └───────────────────────────┘
```

---

## 📋 System Requirements & Prerequisites

Before deploying the platform, verify that your host machine satisfies the following hardware and software baselines:

### Minimum Hardware Profile (Evaluation & Small LANs)
- **CPU**: 2 Cores (x86_64 or Apple Silicon ARM64)
- **Memory**: 4 GB RAM
- **Storage**: 10 GB SSD / NVMe
- **Network**: 100 Mbps Ethernet

### Enterprise Hardware Profile (10K+ Scanned Nodes)
- **CPU**: 8 Cores / 16 Threads
- **Memory**: 16 GB to 32 GB RAM
- **Storage**: 100 GB NVMe (RAID-1 configuration recommended)
- **Network**: 1 Gbps to 10 Gbps Uplink

### Software Dependencies (Bare-Metal Only)
- **Node.js**: `v20.0.0` or higher
- **PostgreSQL**: `v15.0` or higher
- **Redis**: `v7.0` or higher
- **Network Sweepers**: `nmap` and `ping` installed on PATH

---

## 🐳 Option 1: Docker Compose Orchestration (Recommended)

Docker Compose encapsulates the database, Redis caches, WMI/SNMP sweeps, and web frontends into high-performance host-isolated containers.

### 1. File Structure Setup
Create a `docker-compose.prod.yml` configuration:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: qsasset-db
    restart: unless-stopped
    ports:
      - "5434:5432"
    environment:
      POSTGRES_DB: assetcommand
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-QSAsset@2026}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: qsasset-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  api:
    image: neurqai/qsasset-api:latest
    container_name: qsasset-api
    restart: unless-stopped
    network_mode: host
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD:-QSAsset@2026}@localhost:5434/assetcommand?connection_limit=20
      REDIS_URL: redis://localhost:6379
      JWT_SECRET: ${JWT_SECRET:-qsasset-jwt-secret-2026-change-me}
      PORT: 4100
      NODE_ENV: production
      SEED_DB: ${SEED_DB:-false}
      CORS_ORIGIN: "http://localhost:3100,http://${SERVER_IP:-0.0.0.0}:3100"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    image: neurqai/qsasset-web:latest
    container_name: qsasset-web
    restart: unless-stopped
    ports:
      - "3100:3100"
    environment:
      NEXT_PUBLIC_API_URL: http://${SERVER_IP:-localhost}:4100/api/v1
    depends_on:
      - api

volumes:
  pgdata:
    driver: local
```

### 2. Launch with Demo Data (Evaluation Mode)
Execute the deployment shell script with the `--seed` flag. This will provision DB extensions, build containers, and automatically populate trial incident matrices, SLAs, and CMDB structures:

```bash
./deploy.sh --seed
```

### 3. Launch Clean (Production Mode)
For clean, sterile company setups:

```bash
./deploy.sh
```

---

## ⚙️ Option 2: Bare-Metal Manual Installation (Ubuntu/Debian)

For high-security air-gapped environments that restrict containerization runtimes.

### Step 1: Install Operating System Packages
```bash
# Update repositories
sudo apt-get update

# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Nmap, PostgreSQL, and Redis
sudo apt-get install -y nmap postgresql postgresql-contrib redis-server
sudo systemctl enable postgresql redis-server
sudo systemctl start postgresql redis-server
```

### Step 2: Configure Dedicated Relational Database
Log into the PostgreSQL CLI and provision your dedicated role, DB scope, and privileges:

```sql
-- Access CLI via postgres system role: sudo -u postgres psql
CREATE USER qs_user WITH PASSWORD 'QSAsset@2026';
CREATE DATABASE assetcommand WITH OWNER qs_user;
GRANT ALL PRIVILEGES ON DATABASE assetcommand TO qs_user;
```

### Step 3: Compile Workspaces and Build Bundles
Clone, link packages, pull Prisma engines, push DB schemas, and compile the Turbopack distributions:

```bash
# Clone
git clone https://github.com/neurqai/qsasset.git
cd qsasset

# Copy profile
cp .env.example .env

# Install monorepo dependencies
npm install

# Push database schema (zero migration requirements)
npx prisma db push --schema apps/api/prisma/schema.prisma

# Build frontend and backend bundles
npm run build
```

### Step 4: Setup Process Daemons (PM2)
Manage the application services inside background threads to handle restarts and monitoring:

```bash
sudo npm install -g pm2

# Run API and Web portals
pm2 start apps/api/dist/src/main.js --name "qs-api"
pm2 start npx --name "qs-web" -- next start -p 3100

# Save process lists to run automatically on system boot
pm2 save
pm2 startup
```

---

## 🛡️ Network Security, Firewall Rules, & Ports

The scanning engine requires outbound routing privileges to audit client hardware agentlessly. Open the following ingress/egress firewall paths:

| Protocol / Tool | Ports | Mode | Scopes |
|-----------------|-------|------|--------|
| **ICMP v4** | Echo Request / Reply | Outbound | Discovering active hosts via ping sweeps |
| **SSH** | `TCP 22` | Outbound | Agentless Unix, Linux, and macOS hardware audits |
| **WinRM** | `TCP 5985 / 5986` | Outbound | Remote Windows client queries (WMI / WQL) |
| **SNMP polling**| `UDP 161 / 162` | Outbound | Mapping switch ports, router statistics, and printers |
| **RPC / NetBIOS**| `TCP 135 / 445` | Outbound | Discovering legacy Active Directory clients |
| **Discovery Agent**| `TCP 4100` | Inbound | Secure TLS heartbeats and telemetry from local agents |

---

## 🚀 Step 3: Interactive First-Time Web Wizard

Once your Docker containers or bare-metal PM2 daemons are running:
1. Open your browser and navigate to: **`http://<YOUR_SERVER_IP>:3100/setup`**
2. The platform automatically launches the **Interactive Setup Wizard**.
3. Complete the form (Organization Name, Admin Credentials, Timezone, and Industry).
4. Click **Initialize QS Asset**. The wizard will instantly configure your isolated tenant space, setup security access roles, configure SLAs, initialize default IT Asset types, and create core ITIL automation rules!
5. Log in and begin scanning your network!
