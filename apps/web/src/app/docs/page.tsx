"use client";
import { useState } from "react";
import Header from "@/components/Header";
import { useTheme } from "@/components/ThemeProvider";
import Footer from "@/components/Footer";
import {
  BookOpen, Terminal, Server, Cpu, Monitor, Search, ChevronRight,
  ExternalLink, Menu, X, ArrowRight
} from "lucide-react";

// --- Custom Reusable Components for Premium Documentation Content ---

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: "relative",
      margin: "18px 0",
      borderRadius: 10,
      overflow: "hidden",
      background: "#0b0f19",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 16px",
        background: "rgba(255,255,255,0.02)",
        borderBottom: "1px solid rgba(255,255,255,0.04)"
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{lang}</span>
        <button
          onClick={handleCopy}
          style={{
            background: "none",
            border: "none",
            color: copied ? "#10b981" : "#06b6d4",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            transition: "color 0.2s"
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: "16px 20px",
        overflowX: "auto",
        fontSize: 13,
        lineHeight: 1.6,
        color: "#cbd5e1",
        fontFamily: "var(--font-mono, Consolas, Monaco, 'Andale Mono', monospace)"
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Alert({ type, children }: { type: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info: {
      bg: "rgba(6,182,212,0.05)",
      border: "rgba(6,182,212,0.18)",
      color: "#0891b2",
      icon: "💡"
    },
    warning: {
      bg: "rgba(245,158,11,0.05)",
      border: "rgba(245,158,11,0.18)",
      color: "#d97706",
      icon: "⚠️"
    },
    success: {
      bg: "rgba(16,185,129,0.05)",
      border: "rgba(16,185,129,0.18)",
      color: "#059669",
      icon: "✅"
    }
  };
  const active = styles[type];
  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "16px 20px",
      borderRadius: 10,
      background: active.bg,
      border: `1px solid ${active.border}`,
      color: active.color,
      margin: "20px 0"
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{active.icon}</span>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "inherit", fontWeight: 500 }}>
        {children}
      </div>
    </div>
  );
}

function HelpfulWidget({ articleId }: { articleId: string }) {
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
      padding: "32px 0",
      borderTop: "1px solid var(--border-primary, rgba(255,255,255,0.06))",
      marginTop: 48,
      textAlign: "center"
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }}>
        {voted ? "🎉 Thank you for helping us improve our documentation!" : "Was this article helpful?"}
      </span>
      {!voted && (
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => setVoted("yes")}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid var(--border-primary, rgba(255,255,255,0.08))",
              background: "rgba(6, 182, 212, 0.08)",
              color: "#06b6d4",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(6, 182, 212, 0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(6, 182, 212, 0.08)"; }}
          >
            👍 Yes, helpful
          </button>
          <button
            onClick={() => setVoted("no")}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid var(--border-primary, rgba(255,255,255,0.08))",
              background: "rgba(255,255,255,0.02)",
              color: "var(--text-secondary)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
          >
            👎 Not helpful
          </button>
        </div>
      )}
    </div>
  );
}

// --- Detailed Documentation Articles Injected Professionally ---

const ARTICLES = [
  {
    id: "quickstart",
    title: "Quick Start Guide",
    category: "Getting Started",
    desc: "Deploy QS Asset in under 10 minutes",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Quick Start Guide</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Welcome to QS Asset Management! This guide helps you orchestrate and deploy a secure development or evaluation instance of the platform in under 10 minutes using Docker Compose.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>1. Setup Environment</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Clone the repository, navigate to the project directory, and initialize the configuration profile using the preconfigured template:
        </p>
        <CodeBlock
          lang="bash"
          code={`git clone https://github.com/neurqai/qsasset.git\ncd qsasset\ncp .env.example .env`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>2. Launch Services</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Execute the high-performance local production bundle of DB, API, and Web workspaces immediately:
        </p>
        <CodeBlock
          lang="bash"
          code={`docker compose -f docker-compose.prod.yml up -d --build`}
        />
        <Alert type="info">
          The configuration automatically provisions containerised **PostgreSQL** for relational asset schemas and **Redis** for active job queues and cache control.
        </Alert>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>3. Database Migrations & Seeds</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Run the initialization pipelines inside the API container to configure database schemas and import rich enterprise seed datasets:
        </p>
        <CodeBlock
          lang="bash"
          code={`docker compose -f docker-compose.prod.yml exec api npm run db:migrate\ndocker compose -f docker-compose.prod.yml exec api npm run db:seed`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>4. Verify Platform Access</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 16 }}>
          Once the service logs signal stable system initialization, open your browser and navigate to the portals:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 20 }}>
          <li>🖥️ **Web Landing Page**: [http://localhost:3000](http://localhost:3000)</li>
          <li>🔐 **Platform Login**: [http://localhost:3000/login](http://localhost:3000/login)</li>
          <li>📊 **API Health Endpoint**: [http://localhost:4100/health](http://localhost:4100/health)</li>
        </ul>
      </div>
    )
  },
  {
    id: "requirements",
    title: "System Requirements",
    category: "Getting Started",
    desc: "Prerequisites for deployment",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>System Requirements</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Understand the minimum hardware capacities, operating system kernels, and dependency databases required to operate QS Asset reliably.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Minimum Hardware Profiles</h3>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                <th style={{ padding: 12 }}>Resource</th>
                <th style={{ padding: 12 }}>Dev / Evaluation</th>
                <th style={{ padding: 12 }}>Production (10K+ Assets)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>CPU</td>
                <td style={{ padding: 12 }}>2 Cores (Intel/AMD or Apple Silicon)</td>
                <td style={{ padding: 12 }}>8 Cores (Xeon or EPYC recommended)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>RAM</td>
                <td style={{ padding: 12 }}>4 GB Minimum</td>
                <td style={{ padding: 12 }}>16 GB to 32 GB RAM</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>Disk</td>
                <td style={{ padding: 12 }}>10 GB SSD</td>
                <td style={{ padding: 12 }}>100 GB NVMe (RAID-1 config recommended)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>Network</td>
                <td style={{ padding: 12 }}>100 Mbps Ethernet</td>
                <td style={{ padding: 12 }}>1 Gbps to 10 Gbps Uplink</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Supported Operating Systems</h3>
        <ul style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 20 }}>
          <li>🐧 **Linux**: Ubuntu Server 20.04+, Debian 11+, RHEL/Rocky Linux 9+</li>
          <li>🍎 **macOS**: Sonoma 14, Sequoia 15 (Apple Silicon fully optimized)</li>
          <li>🪟 **Windows Server**: Windows Server 2019/2022 (Core mode supported)</li>
        </ul>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Engine Prerequisites</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Ensure the following execution runtimes are pre-installed before manual installation:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 20 }}>
          <li>🟢 **Node.js**: `v20.0.0` or higher</li>
          <li>📦 **Docker**: `v24.0.0` or higher & **Docker Compose** `v2.20.0`+</li>
          <li>🐘 **PostgreSQL**: `v15.0` or higher</li>
          <li>⚡ **Redis**: `v7.0` or higher</li>
        </ul>
      </div>
    )
  },
  {
    id: "firstscan",
    title: "Running First Scan",
    category: "Getting Started",
    desc: "Discover devices on your network",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Running Your First Scan</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Learn how to launch an active scanning run to automatically discover, audit, and index hardware, workstations, switches, and other devices on a local subnet.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 1: Configure Credentials Vault</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          To audit SNMP-enabled network switches, WMI-enabled Windows clients, or SSH Linux servers, you must first register scanning credentials securely.
        </p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 16 }}>
          <li>Log in as an **Administrator** and access the **NMS / Scanning** dashboard module.</li>
          <li>Select the **Credentials Vault** tab.</li>
          <li>Click **Add Credential** and choose WMI, SSH, or SNMPv2c.</li>
          <li>Enter authentication details. These are encrypted instantly with AES-256-CBC using your system-level vault key.</li>
        </ol>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 2: Schedule a Subnet Discovery Run</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Configure a targeted network scanning range for the background discovery engine:
        </p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 16 }}>
          <li>Navigate to the **Discovery Scanning** tab and click **New Scanner**.</li>
          <li>Assign a name (e.g., `Mumbai Office Subnet`).</li>
          <li>Define the CIDR subnet range (e.g., `192.168.1.0/24`).</li>
          <li>Select your registered credentials and click **Scan Now**.</li>
        </ol>

        <Alert type="success">
          The scanner will spawn concurrent scanning threads to perform ICMP ping sweeps, WMI schema checks, and Nmap vulnerability checks across all active endpoints in the range.
        </Alert>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 3: Analyze Discovered Assets</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 16 }}>
          Once the scan is complete, view the results immediately in the **IT Assets** list:
        </p>
        <CodeBlock
          lang="json"
          code={`// Example of automatically discovered JSON hardware payload\n{\n  "hostname": "MUM-CORE-SW-01",\n  "ipAddress": "192.168.1.1",\n  "manufacturer": "Cisco",\n  "model": "Catalyst 9200-48P",\n  "type": "Network Switch",\n  "macAddress": "00:80:F3:11:AB:BC"\n}`}
        />
      </div>
    )
  },
  {
    id: "docker",
    title: "Docker Compose Setup",
    category: "Deployment",
    desc: "Production Docker instructions",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Docker Compose Setup</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Docker Compose is the recommended layout for orchestrating QS Asset in production environments.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Production Docker Compose Reference</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Below is a production-optimized `docker-compose.prod.yml` template featuring PostgreSQL database clustering, active Redis caching, API gateways, and web dashboards:
        </p>
        <CodeBlock
          lang="yaml"
          code={`version: '3.8'\n\nservices:\n  db:\n    image: postgres:16-alpine\n    container_name: qsasset-postgres\n    environment:\n      POSTGRES_USER: \${DB_USER:-postgres}\n      POSTGRES_PASSWORD: \${DB_PASSWORD:-Secret@Pass}\n      POSTGRES_DB: \${DB_NAME:-qsasset_db}\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n    ports:\n      - "5432:5432"\n    restart: always\n\n  redis:\n    image: redis:7-alpine\n    container_name: qsasset-redis\n    ports:\n      - "6379:6379"\n    restart: always\n\n  api:\n    image: neurqai/qsasset-api:latest\n    container_name: qsasset-api\n    environment:\n      DATABASE_URL: "postgresql://\${DB_USER}:\${DB_PASSWORD}@db:5432/\${DB_NAME}?schema=public"\n      REDIS_URL: "redis://redis:6379"\n      JWT_SECRET: \${JWT_SECRET:-SuperSecureRandomTokenSecret}\n      PORT: 4100\n    ports:\n      - "4100:4100"\n    depends_on:\n      - db\n      - redis\n    restart: always\n\n  web:\n    image: neurqai/qsasset-web:latest\n    container_name: qsasset-web\n    environment:\n      NEXT_PUBLIC_API_URL: "http://localhost:4100/api/v1"\n      PORT: 3000\n    ports:\n      - "3000:3000"\n    depends_on:\n      - api\n    restart: always\n\nvolumes:\n  pgdata:`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Scaling the Scanning Worker Services</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          To scan extremely large distributed subnets, you can scale the background active worker microservices independently to handle WMI and SNMP polling loads:
        </p>
        <CodeBlock
          lang="bash"
          code={`docker compose -f docker-compose.prod.yml up -d --scale worker=4`}
        />
      </div>
    )
  },
  {
    id: "onprem",
    title: "On-Premise Manual",
    category: "Deployment",
    desc: "Manual bare-metal deployment",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>On-Premise Manual Deployment</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          For environments requiring bare-metal host installations behind enterprise firewall configurations, follow this manual step-by-step procedure.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 1: Install System Runtimes</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Install Node.js 20, PostgreSQL 16, and Redis on your host server. For Ubuntu/Debian hosts, run:
        </p>
        <CodeBlock
          lang="bash"
          code={`# Install Node.js\ncurl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\nsudo apt-get install -y nodejs\n\n# Install Postgres and Redis\nsudo apt-get install -y postgresql postgresql-contrib redis-server\nsudo systemctl enable postgresql redis-server\nsudo systemctl start postgresql redis-server`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 2: Database Configuration</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Access the PostgreSQL CLI and create a dedicated database and owner account:
        </p>
        <CodeBlock
          lang="sql"
          code={`CREATE USER qs_user WITH PASSWORD 'SecurePassword123';\nCREATE DATABASE qsasset WITH OWNER qs_user;\nGRANT ALL PRIVILEGES ON DATABASE qsasset TO qs_user;`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 3: Compile and Build Apps</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Install all NPM workspace packages, run migrations, and compile production assets:
        </p>
        <CodeBlock
          lang="bash"
          code={`# Install dependencies\nnpm install\n\n# Run Prisma DB Migrations\nnpm run db:migrate --workspace=apps/api\n\n# Compile production builds\nnpm run build`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 4: Configure PM2 Service Daemon</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Use PM2 to manage the backend APIs, background telemetry runners, and Next.js frontend servers continuously:
        </p>
        <CodeBlock
          lang="bash"
          code={`npm install -g pm2\n\npm2 start apps/api/dist/main.js --name "qs-api"\npm2 start npx --name "qs-web" -- next start -p 3000\n\npm2 save\npm2 startup`}
        />
      </div>
    )
  },
  {
    id: "agent-install",
    title: "Agent Installation",
    category: "Agent Setup",
    desc: "Deploy client auditing agents",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Agent Installation</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Auditing clients securely can be done via background system daemons (Agents). The agent reports system telemetry, missing software patches, and security configurations to the central API.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>💻 Windows PowerShell Installation</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Open PowerShell as an Administrator and execute this one-liner script to download, configure, and install the Windows background service daemon:
        </p>
        <CodeBlock
          lang="powershell"
          code={`Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12;\nInvoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://qsasset.com/downloads/agent/win/install.ps1'));\nStart-QSAgent -ServerUrl "https://yourserver.com" -Token "YOUR_API_TOKEN"`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>🍎 macOS Installation</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Open the terminal and run the secure curl installer script to deploy the LaunchDaemon process:
        </p>
        <CodeBlock
          lang="bash"
          code={`curl -fsSL https://qsasset.com/downloads/agent/mac/install.sh | bash -s -- --url "https://yourserver.com" --token "YOUR_API_TOKEN"`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>🐧 Linux Installation</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          For Ubuntu, RHEL, and Debian systems, run the unified bash installer to deploy the Systemd service:
        </p>
        <CodeBlock
          lang="bash"
          code={`wget -qO- https://qsasset.com/downloads/agent/linux/install.sh | sudo bash -s -- --url "https://yourserver.com" --token "YOUR_API_TOKEN"`}
        />

        <Alert type="info">
          The `YOUR_API_TOKEN` parameter must be obtained from the **NMS &gt; Agents Settings** console tab, which maps host assets securely to your Tenant organization workspace.
        </Alert>
      </div>
    )
  },
  {
    id: "agentless",
    title: "Agentless Monitoring",
    category: "Agent Setup",
    desc: "Ping, SNMP, and WMI scanning",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Agentless Monitoring</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Don&apos;t want to install agent binaries on all local clients? QS Asset features advanced, agentless monitoring schemas for corporate environments.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>How Agentless Monitoring Operates</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          The central scanning engine runs periodic discoveries, querying hardware elements remotely:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 20 }}>
          <li>🛡️ **Windows Nodes**: Queried securely using standard WMI (Windows Management Instrumentation) schemas over WinRM or RPC protocols.</li>
          <li>⚙️ **Unix & Linux Nodes**: Polled safely using SSH commands to fetch CPU, disk partition limits, and system information profiles.</li>
          <li>🌐 **Network Switches & Routers**: Polled securely via standard SNMPv2c or SNMPv3 OID trees to map active ports and device metrics.</li>
          <li>📹 **CCTV & IoT Nodes**: Discovered dynamically using ONVIF discovery sweeps and ICMP active ping telemetry.</li>
        </ul>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Required Firewall Ports</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Ensure the following internal network routes are open between the scanner agent and targets:
        </p>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                <th style={{ padding: 12 }}>Protocol</th>
                <th style={{ padding: 12 }}>Port Range</th>
                <th style={{ padding: 12 }}>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>SSH</td>
                <td style={{ padding: 12 }}>TCP 22</td>
                <td style={{ padding: 12 }}>Auditing Linux, Unix, and Mac hosts</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>WinRM</td>
                <td style={{ padding: 12 }}>TCP 5985 / 5986</td>
                <td style={{ padding: 12 }}>Querying Windows Management systems</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>SNMP</td>
                <td style={{ padding: 12 }}>UDP 161 / 162</td>
                <td style={{ padding: 12 }}>Querying switches, firewalls, and printers</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>WMI / RPC</td>
                <td style={{ padding: 12 }}>TCP 135 & Dynamic ports</td>
                <td style={{ padding: 12 }}>Legacy Windows client audits</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  },
  {
    id: "assets",
    title: "Asset Lifecycle Management",
    category: "Modules",
    desc: "Track asset lifecycles end to end",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Asset Lifecycle Management</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Efficiently catalog and monitor hardware, laptops, servers, accessories, printers, furniture, and vehicles in a single place.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Defined Lifecycle States</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          QS Asset routes hardware records through these sequential lifecycle stages:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 20 }}>
          <li>🆕 **Discovered**: Found dynamically on subnets, awaiting allocation.</li>
          <li>📦 **In Stock**: Stored safely in inventory, ready for assignment.</li>
          <li>🚀 **Active / In Service**: Currently deployed to a user or assigned to a site.</li>
          <li>🛠️ **Under Repair**: Temporarily out of service for hardware maintenance.</li>
          <li>☠️ **Retired**: Decommissioned at end-of-life and stored for audit records.</li>
        </ul>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Custom Asset Fields</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          You can define custom key-value schema attributes for any asset category (e.g. registration numbers for vehicles, lease dates for servers):
        </p>
        <CodeBlock
          lang="javascript"
          code={`// Example of defining dynamic custom fields schema\nconst schema = {\n  category: "Vehicle",\n  fields: [\n    { name: "registrationNumber", type: "text", required: true },\n    { name: "fuelType", type: "select", options: ["Petrol", "Diesel", "EV"] },\n    { name: "seatingCapacity", type: "number" }\n  ]\n};`}
        />
      </div>
    )
  },
  {
    id: "api",
    title: "REST API Documentation",
    category: "API Reference",
    desc: "Complete API endpoints and queries",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>REST API Reference</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Use the REST API to integrate third-party applications, automate custom scripts, or export auditing data programmatically.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>🔑 Base Configuration</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          All requests must be directed to your central server URL using JSON content routing:
        </p>
        <CodeBlock
          lang="text"
          code={`Base URL: https://yourserver.com/api/v1\nContent-Type: application/json`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Core REST Endpoints</h3>
        
        {/* Endpoint 1 */}
        <div style={{ margin: "20px 0", borderLeft: "4px solid #06b6d4", paddingLeft: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#06b6d4", marginBottom: 4 }}>POST /auth/login</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px 0" }}>Sign in to receive a valid JWT access and refresh token.</p>
          <CodeBlock
            lang="json"
            code={`// Request Body\n{\n  "email": "admin@acme.com",\n  "password": "Admin@123"\n}\n\n// Response Success\n{\n  "accessToken": "ey...",\n  "refreshToken": "ey..."\n}`}
          />
        </div>

        {/* Endpoint 2 */}
        <div style={{ margin: "20px 0", borderLeft: "4px solid #10b981", paddingLeft: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981", marginBottom: 4 }}>GET /assets</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px 0" }}>Fetch all cataloged assets. Supports pagination, type filters, and search.</p>
          <CodeBlock
            lang="json"
            code={`// Response Payload Snippet\n[\n  {\n    "id": "2d3e4f...",\n    "name": "Dell Latitude 5540",\n    "assetTag": "LAP-001",\n    "status": "ACTIVE",\n    "manufacturer": "Dell"\n  }\n]`}
          />
        </div>

        {/* Endpoint 3 */}
        <div style={{ margin: "20px 0", borderLeft: "4px solid #a855f7", paddingLeft: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#a855f7", marginBottom: 4 }}>POST /tickets</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px 0" }}>Create a support service ticket for hardware repair or software setup.</p>
          <CodeBlock
            lang="json"
            code={`// Request Body\n{\n  "subject": "Laptop screen flickering",\n  "description": "My Latitude laptop screen has active horizontal lines flickering.",\n  "priority": "HIGH",\n  "category": "Hardware"\n}`}
          />
        </div>
      </div>
    )
  },
  {
    id: "api-auth",
    title: "Authentication",
    category: "API Reference",
    desc: "JWT structures and headers",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>API Authentication</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Authentication is verified strictly using secure JSON Web Tokens (JWT). This prevents session spoofing and isolates tenant workspaces.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Bearer Authorization Flow</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Attach the active `accessToken` received from the login endpoint inside the standard HTTP `Authorization` request header:
        </p>
        <CodeBlock
          lang="http"
          code={`GET /api/v1/assets HTTP/1.1\nHost: yourserver.com\nAuthorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFkM...`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Token Expirations & Lifecycle</h3>
        <ul style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 20 }}>
          <li>🕒 **Access Token**: Valid for **15 minutes**. Used for resource requests.</li>
          <li>🔄 **Refresh Token**: Valid for **7 days**. Used to request new access tokens.</li>
        </ul>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Token Renewal Endpoint</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          When the access token expires, request a new one by sending your refresh token in a POST request:
        </p>
        <CodeBlock
          lang="json"
          code={`POST /api/v1/auth/refresh\n{\n  "refreshToken": "eyJhbGciOiJIUzI1Ni..."\n}\n\n// Response payload returns a fresh access token\n{\n  "accessToken": "eyJhbGciOiJIUzI1Ni..."\n}`}
        />
      </div>
    )
  },
  {
    id: "saas-overview",
    title: "Multi-Tenant SaaS Architecture",
    category: "SaaS Platform Guide",
    desc: "How tenant isolation and workspaces operate",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Multi-Tenant SaaS Architecture</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          QS Asset is built from the ground up as a high-security, multi-tenant Software-as-a-Service (SaaS) platform. This architecture ensures complete data isolation and workspace independence.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>1. Strict Data Isolation</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Every enterprise client gets a fully isolated database partition managed through secure tenant scoping keys. Under no circumstances can data from one tenant workspace bleed into another.
        </p>
        <Alert type="success">
          Workspace access is decoupled from infrastructure deployments, meaning you can scale tenant workloads dynamically while keeping credentials vault items fully segregated.
        </Alert>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>2. Role-Based Access Control (RBAC)</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Permissions are governed strictly according to system hierarchies:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 20 }}>
          <li>👑 **Super Admin (Platform Owner)**: Full administrative authority over global subscriptions, payment plans, tenant health metrics, and global ticketing desk routing.</li>
          <li>👔 **Tenant Admin**: Complete authority over a specific company workspace, active scanning rules, custom fields schemas, user roles, and payment subscriptions.</li>
          <li>🛠️ **IT Staff**: Permission to register hardware assets, audit LAN switches, dispatch work orders, and assign devices to employees.</li>
          <li>👤 **Employee (End User)**: Access to their simplified profile portal to inspect assigned hardware specifications and raise IT helpdesk repair tickets.</li>
        </ul>
      </div>
    )
  },
  {
    id: "saas-billing",
    title: "Subscriptions & Billing Plan",
    category: "SaaS Platform Guide",
    desc: "Managing tiers, quotas, and premium plans",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Subscriptions & Billing Plan</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Platform usage limits, asset capacities, and feature access are automatically provisioned and managed based on your tenant workspace subscription tier.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Available Tiers</h3>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                <th style={{ padding: 12 }}>Feature</th>
                <th style={{ padding: 12 }}>Standard Trial</th>
                <th style={{ padding: 12 }}>Premium Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>Asset Capacity</td>
                <td style={{ padding: 12 }}>Up to 50 monitored hardware items</td>
                <td style={{ padding: 12 }}>Unlimited assets</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>Network Scanning</td>
                <td style={{ padding: 12 }}>Single-subnet scan sweep</td>
                <td style={{ padding: 12 }}>Concurrent multi-subnet background workers</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>SSO & OAuth</td>
                <td style={{ padding: 12 }}>Password authentication only</td>
                <td style={{ padding: 12 }}>Google & Microsoft Azure AD Integration</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>Custom Columns</td>
                <td style={{ padding: 12 }}>Standard attributes only</td>
                <td style={{ padding: 12 }}>Unlimited dynamic custom field schemas</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Dynamic Quota Scaling</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          SaaS workspace billing is integrated securely with automated payment checkout workflows:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 20 }}>
          <li>💳 **Stripe Gateways**: Provides secure card storage, subscription renewal loops, and automated billing portal redirects.</li>
          <li>📊 **Real-Time Limit Audits**: The central scanning system monitors your active device count and notifies you before thresholds are exceeded.</li>
        </ul>
      </div>
    )
  },
  {
    id: "saas-sso",
    title: "Single Sign-On & OAuth",
    category: "SaaS Platform Guide",
    desc: "Google & Microsoft Azure AD authentication",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Single Sign-On & OAuth Setup</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Onboard thousands of enterprise employees securely in a single click using our enterprise-grade Single Sign-On (SSO) engine, supporting Google Workspace and Microsoft Azure AD.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Google Workspace Integration</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Tenant administrators can link corporate domains to Google Client IDs. When employees click &quot;Sign in with Google&quot;, their identity token is validated and scoped automatically to the target workspace organization.
        </p>
        <CodeBlock
          lang="json"
          code={`// Scoped OAuth client configurations\n{\n  "provider": "google",\n  "clientId": "your-id.apps.googleusercontent.com",\n  "authorizedDomain": "acme.com",\n  "autoProvision": true\n}`}
        />

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Microsoft Azure AD / Entra ID</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          For Windows-centric or Office 365 environments, connect your workspace to the Azure AD tenant endpoint to sync user accounts, groups, and access directories in real-time.
        </p>
      </div>
    )
  },
  {
    id: "tutorial-setup",
    title: "Workspace Setup Guide",
    category: "Easy-Use Tutorials",
    desc: "Create your organization workspace in 3 minutes",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Workspace Setup Guide</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Follow this easy, non-technical walkthrough to create and brand your corporate asset workspace in under 3 minutes.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 1: Account Registration</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Navigate to [https://qsasset.vercel.app/register](https://qsasset.vercel.app/register) and create your administrator profile. Select your company name to establish your isolated database partition automatically.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 2: Brand and Theme Configuration</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Personalize the look and feel of the dashboard:
        </p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 16 }}>
          <li>Go to **Dashboard &gt; Settings &gt; General**.</li>
          <li>Upload your official corporate logo in high-res PNG or SVG format.</li>
          <li>Choose your default workspace interface theme (Light or Dark) using the premium responsive header controller.</li>
        </ol>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>Step 3: Onboarding Your IT Team</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Add your systems administrators or inventory managers to the team:
        </p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 16 }}>
          <li>Go to the **Users** management console tab.</li>
          <li>Click **Invite User** and enter their work email address.</li>
          <li>Assign their permissions tier (e.g. `IT Staff` or `Tenant Admin`) and send the secure magic invite link.</li>
        </ol>
      </div>
    )
  },
  {
    id: "tutorial-assets",
    title: "Asset Cataloging & Tracking",
    category: "Easy-Use Tutorials",
    desc: "How to manage and assign IT hardware",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Asset Cataloging & Tracking</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Learn how to manually register assets, assign hardware components to employees, print inventory tracking tags, and customize your device details sheets.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>1. Registering an Asset Manually</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Have single hardware items to log (like a new employee laptop)?
        </p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 16 }}>
          <li>Open the **IT Assets** catalog page and click **New Asset**.</li>
          <li>Input details such as: Name (e.g. `MacBook Pro 16`), Asset Tag (e.g. `LAP-8902`), Model, and Manufacturer.</li>
          <li>Click **Save**. The asset is generated instantly under the status &quot;In Stock&quot;.</li>
        </ol>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>2. Generating & Printing QR Codes</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          To streamline physical inventory audits, every registered asset profile automatically generates an encoded, high-density **QR Code**:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 20 }}>
          <li>Click on any cataloged asset card to open its drill-down panel.</li>
          <li>Select the **Print Label** tab.</li>
          <li>Export or print the tag label immediately on local thermal barcode printers, and stick it directly to the physical laptop/device.</li>
        </ul>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>3. Assigning Devices to Employees</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          Log exactly who is using what:
        </p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 16 }}>
          <li>Open the target asset details panel and click **Checkout**.</li>
          <li>Select the employee from your synced enterprise user directory.</li>
          <li>Add assignment notes and click **Confirm**. The asset status shifts immediately to **Active / In Service**, and the employee is notified.</li>
        </ol>
      </div>
    )
  },
  {
    id: "tutorial-tickets",
    title: "IT Support Portal Tutorial",
    category: "Easy-Use Tutorials",
    desc: "Raise tickets and resolve hardware issues",
    content: (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>IT Support & Helpdesk Tutorial</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Discover how employees open rapid hardware support request tickets, and how IT engineers receive and resolve tickets directly.
        </p>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>How Employees Raise Tickets</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          When an employee experiences laptop keyboard failure, flickering displays, or network drops, they log support requests in seconds:
        </p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 16 }}>
          <li>Log into the secure **Employee Portal**.</li>
          <li>Inspect your assigned hardware list, choose the failing item, and click **Report Issue**.</li>
          <li>Describe the symptom, select ticket priority (Low, Medium, High), and attach optional error screenshots.</li>
        </ol>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 12px" }}>How IT Admins Resolve Tickets</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 12 }}>
          On the unified ticketing board:
        </p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, marginBottom: 16 }}>
          <li>IT staff receive real-time dashboard notifications when tickets arrive.</li>
          <li>The system automatically links the ticket profile to the target hardware tag and specifications, saving diagnostic time.</li>
          <li>The engineer assigns the ticket to themselves, logs status transitions (Open &gt; In Progress &gt; Resolved), and posts interactive support notes in real-time.</li>
        </ol>
      </div>
    )
  }
];

export default function DocsPage() {
  const { theme, toggleTheme } = useTheme();
  const [activeArticle, setActiveArticle] = useState(ARTICLES[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const L = theme === "light";
  const bg = L ? "linear-gradient(160deg, #f8fafc 0%, #edf2f7 40%, #f7fafc 100%)" : "linear-gradient(160deg, #030308 0%, #090e1f 40%, #04050c 100%)";
  const txt = L ? "#0f172a" : "#f1f5f9";
  const muted = L ? "#475569" : "#94a3b8";
  const border = L ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.06)";
  const card = L ? "rgba(255, 255, 255, 0.8)" : "rgba(13, 17, 34, 0.65)";
  const activeBg = L ? "rgba(6, 182, 212, 0.08)" : "rgba(6, 182, 212, 0.12)";

  // Filter articles based on query matching title, category, or desc
  const filteredArticles = ARTICLES.filter(art => {
    const q = searchQuery.toLowerCase();
    return (
      art.title.toLowerCase().includes(q) ||
      art.category.toLowerCase().includes(q) ||
      art.desc.toLowerCase().includes(q)
    );
  });

  // Group filtered articles by Category
  const categories = Array.from(new Set(ARTICLES.map(art => art.category)));

  const handleSelectArticle = (art: typeof ARTICLES[0]) => {
    setActiveArticle(art);
    setMobileMenuOpen(false);
    // Scroll content pane to top
    const pane = document.getElementById("docs-content-pane");
    if (pane) pane.scrollTop = 0;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      color: txt,
      fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      transition: 'background 0.5s, color 0.5s',
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Global Application Header */}
      <Header theme={theme} onToggleTheme={toggleTheme} />

      {/* Main Documentation Shell */}
      <div style={{
        flex: 1,
        width: "100%",
        maxWidth: 1400,
        margin: "0 auto",
        padding: "100px 4% 60px",
        display: "flex",
        gap: 32,
        position: "relative"
      }}>
        {/* --- 1. Left Sidebar Panel (Desktop) --- */}
        <aside className="docs-sidebar" style={{
          width: 290,
          flexShrink: 0,
          background: card,
          border: `1px solid ${border}`,
          borderRadius: 16,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxHeight: "calc(100vh - 160px)",
          position: "sticky",
          top: 100,
          overflowY: "auto",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: L ? "0 10px 30px rgba(0,0,0,0.02)" : "0 10px 40px rgba(0,0,0,0.15)",
        }}>
          {/* Search Box */}
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: muted }} />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px 10px 38px",
                borderRadius: 10,
                fontSize: 13,
                fontFamily: "inherit",
                background: L ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${border}`,
                color: txt,
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={e => { e.target.style.borderColor = "#06b6d4"; }}
              onBlur={e => { e.target.style.borderColor = border; }}
            />
          </div>

          {/* Grouped Articles List */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {categories.map(cat => {
              const catArticles = filteredArticles.filter(art => art.category === cat);
              if (catArticles.length === 0) return null;

              return (
                <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#06b6d4",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    paddingLeft: 8
                  }}>
                    {cat}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {catArticles.map(art => {
                      const active = activeArticle.id === art.id;
                      return (
                        <button
                          key={art.id}
                          onClick={() => handleSelectArticle(art)}
                          style={{
                            textAlign: "left",
                            padding: "9px 12px",
                            borderRadius: 8,
                            fontSize: 13.5,
                            fontWeight: active ? 700 : 500,
                            color: active ? "#06b6d4" : "var(--text-secondary)",
                            background: active ? activeBg : "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "all 0.15s",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between"
                          }}
                          onMouseEnter={e => {
                            if (!active) {
                              e.currentTarget.style.background = L ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)";
                              e.currentTarget.style.color = txt;
                            }
                          }}
                          onMouseLeave={e => {
                            if (!active) {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "var(--text-secondary)";
                            }
                          }}
                        >
                          {art.title}
                          {active && <ChevronRight size={14} style={{ color: "#06b6d4" }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* --- 2. Mobile Float Trigger & Mobile Menu Overlay --- */}
        <div className="docs-mobile-bar" style={{
          display: "none",
          width: "100%",
          position: "fixed",
          bottom: 20,
          left: 0,
          right: 0,
          padding: "0 24px",
          zIndex: 999
        }}>
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #06b6d4, #0891b2)",
              color: "white",
              fontSize: 14,
              fontWeight: 800,
              boxShadow: "0 10px 25px rgba(6,182,212,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer"
            }}
          >
            <Menu size={16} /> Open Documentation Index
          </button>
        </div>

        {mobileMenuOpen && (
          <>
            <div
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(6px)",
                zIndex: 10000
              }}
            />
            <div style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              left: 0,
              width: "min(320px, 85vw)",
              background: L ? "#ffffff" : "#080b16",
              borderRight: `1px solid ${border}`,
              zIndex: 10001,
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              overflowY: "auto"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>Documentation</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ background: "none", border: "none", color: muted, cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mobile Search Box */}
              <div style={{ position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: muted }} />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 38px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: "inherit",
                    background: L ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${border}`,
                    color: txt,
                    outline: "none"
                  }}
                />
              </div>

              {/* Mobile Links List */}
              <nav style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {categories.map(cat => {
                  const catArticles = filteredArticles.filter(art => art.category === cat);
                  if (catArticles.length === 0) return null;

                  return (
                    <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.08em", paddingLeft: 8 }}>
                        {cat}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {catArticles.map(art => {
                          const active = activeArticle.id === art.id;
                          return (
                            <button
                              key={art.id}
                              onClick={() => handleSelectArticle(art)}
                              style={{
                                textAlign: "left",
                                padding: "10px 12px",
                                borderRadius: 8,
                                fontSize: 13.5,
                                fontWeight: active ? 700 : 500,
                                color: active ? "#06b6d4" : "var(--text-secondary)",
                                background: active ? activeBg : "transparent",
                                border: "none",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                width: "100%"
                              }}
                            >
                              {art.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>
          </>
        )}

        {/* --- 3. Right Content Article Pane --- */}
        <main
          id="docs-content-pane"
          style={{
            flex: 1,
            minWidth: 0,
            background: card,
            border: `1px solid ${border}`,
            borderRadius: 16,
            padding: "40px 5%",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: L ? "0 10px 30px rgba(0,0,0,0.02)" : "0 10px 40px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          {/* Main Article Content Injected Dynamically */}
          <div className="docs-article-body" style={{ minHeight: "60vh" }}>
            {activeArticle.content}
          </div>

          {/* User Feedback voting system */}
          <HelpfulWidget articleId={activeArticle.id} />
        </main>
      </div>

      {/* Footer element */}
      <Footer theme={theme} />

      {/* Custom Global Scrollbars and Responsive Media Styles */}
      <style>{`
        /* Web layout adjustments */
        @media (max-width: 1024px) {
          .docs-sidebar { display: none !important; }
          .docs-mobile-bar { display: block !important; }
          main { padding: 32px 20px !important; }
        }
        
        /* Modern custom scrollbar styling */
        .docs-sidebar::-webkit-scrollbar {
          width: 5px;
        }
        .docs-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }
        .docs-sidebar::-webkit-scrollbar-thumb {
          background: ${L ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"};
          border-radius: 99px;
        }
        .docs-sidebar::-webkit-scrollbar-thumb:hover {
          background: #06b6d4;
        }
      `}</style>
    </div>
  );
}
