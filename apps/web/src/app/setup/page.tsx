"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Server, Shield, Building2, Mail, Lock, User, ArrowRight,
  CheckCircle2, Loader2, Zap, AlertTriangle, Copy, Check, FileText, Globe, X,
} from "lucide-react";
import { LogoIcon } from "@/components/Logo";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=check, 1=form, 2=success
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    organizationName: "",
    adminEmail: "",
    adminPassword: "",
    adminName: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    industry: "Technology",
  });

  // On-premise docs modal states
  const [showOnPremDocs, setShowOnPremDocs] = useState(false);
  const [docsTab, setDocsTab] = useState<"docker" | "baremetal" | "firewall">("docker");
  const [copiedText, setCopiedText] = useState("");

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(""), 2000);
  };

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1"}/setup/status`)
      .then(r => r.json())
      .then(data => {
        if (data.initialized) {
          router.replace("/dashboard");
        } else {
          setStep(1);
        }
      })
      .catch(() => setStep(1))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1"}/setup/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Setup failed");
      setResult(data);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const industries = ["Technology", "Healthcare", "Finance", "Manufacturing", "Education", "Government", "Retail", "Energy", "Transportation", "Telecommunications"];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary, #0a0e1a)" }}>
        <Loader2 size={40} style={{ animation: "spin 1s linear infinite", color: "#22d3ee" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0a0e1a 0%, #0f172a 30%, #0a0e1a 100%)",
      fontFamily: "'Inter', -apple-system, sans-serif", color: "#e2e8f0",
      position: "relative", overflow: "hidden"
    }}>
      <div style={{
        width: "100%", maxWidth: step === 2 ? 540 : 500, padding: 40,
        background: "rgba(15, 23, 42, 0.8)", borderRadius: 20,
        border: "1px solid rgba(34, 211, 238, 0.15)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 0 80px rgba(34, 211, 238, 0.06), 0 20px 60px rgba(0,0,0,0.4)",
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            margin: "0 auto 16px",
            display: "flex",
            justifyContent: "center",
          }}>
            <LogoIcon size={68} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>
            QS Asset
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>
            {step === 1 ? "First-time setup — configure your organization" : "Setup complete!"}
          </p>
        </div>

        {/* Step 1: Form */}
        {step === 1 && (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5", fontSize: 12, display: "flex", gap: 8, alignItems: "center",
              }}>
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <Building2 size={12} style={{ marginRight: 4 }} /> Organization Name
              </label>
              <input required placeholder="Acme Corporation" value={form.organizationName}
                onChange={e => setForm({ ...form, organizationName: e.target.value })}
                style={inputStyle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}><User size={12} style={{ marginRight: 4 }} /> Admin Name</label>
                <input required placeholder="John Doe" value={form.adminName}
                  onChange={e => setForm({ ...form, adminName: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}><Mail size={12} style={{ marginRight: 4 }} /> Admin Email</label>
                <input required type="email" placeholder="admin@company.com" value={form.adminEmail}
                  onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}><Lock size={12} style={{ marginRight: 4 }} /> Admin Password</label>
              <input required type="password" placeholder="Minimum 8 characters" minLength={8}
                value={form.adminPassword}
                onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                style={inputStyle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Industry</label>
                <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  {industries.map(i => <option key={i} value={i} style={{ background: "#0f172a" }}>{i}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Timezone</label>
                <input value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>

            {/* What gets created */}
            <div style={{
              padding: 14, borderRadius: 10, marginBottom: 20,
              background: "rgba(34, 211, 238, 0.05)", border: "1px solid rgba(34, 211, 238, 0.1)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#22d3ee", marginBottom: 8 }}>
                <Zap size={12} /> This will create:
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.8 }}>
                ✓ Organization tenant &amp; admin account<br />
                ✓ Default roles (Admin, IT Admin, Staff)<br />
                ✓ SLA policies (Critical: 1h/4h, High: 4h/8h, Medium: 8h/24h, Low: 24h/72h)<br />
                ✓ 7 asset type categories (IT &amp; Non-IT)<br />
                ✓ 3 starter automation rules with cooldown protection
              </div>
            </div>

            <button type="submit" disabled={submitting}
              style={{
                width: "100%", padding: "12px 20px", borderRadius: 10, border: "none",
                background: submitting ? "#1e293b" : "linear-gradient(135deg, #06b6d4, #3b82f6)",
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: submitting ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s",
                boxShadow: submitting ? "none" : "0 4px 15px rgba(6,182,212,0.25)",
              }}>
              {submitting ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Initializing...</>
                : <><Shield size={16} /> Initialize QS Asset <ArrowRight size={14} /></>}
            </button>

            {/* Interactive installation help link */}
            <div style={{
              textAlign: "center", marginTop: 22, paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}>
              <button type="button" onClick={() => setShowOnPremDocs(true)}
                style={{
                  background: "none", border: "none", color: "#22d3ee",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  transition: "color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#06b6d4"}
                onMouseLeave={e => e.currentTarget.style.color = "#22d3ee"}>
                <Server size={12} /> View On-Premise Installation &amp; Docker Guide
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Success */}
        {step === 2 && result && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
              background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckCircle2 size={32} color="#10b981" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>System Initialized</h2>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
              {result.tenant?.name} is ready. Log in with your admin credentials.
            </p>

            <div style={{
              textAlign: "left", padding: 16, borderRadius: 10,
              background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(148, 163, 184, 0.1)",
              marginBottom: 20,
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                <div><span style={{ color: "#94a3b8" }}>Roles:</span> <strong>{result.defaults?.roles}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>SLA Policies:</span> <strong>{result.defaults?.slaPolicies}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>Asset Types:</span> <strong>{result.defaults?.assetTypes}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>Auto Rules:</span> <strong>{result.defaults?.automationRules}</strong></div>
              </div>
            </div>

            <button
              onClick={() => router.push("/login")}
              style={{
                width: "100%", padding: "12px 20px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 15px rgba(6,182,212,0.25)",
              }}>
              Go to Login <ArrowRight size={14} />
            </button>

            {/* Success stage onprem help */}
            <div style={{
              textAlign: "center", marginTop: 22, paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}>
              <button type="button" onClick={() => setShowOnPremDocs(true)}
                style={{
                  background: "none", border: "none", color: "#22d3ee",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                <Server size={12} /> View Production Post-Deployment Steps
              </button>
            </div>
          </div>
        )}
      </div>

      {/* On-Premise sliding guide modal */}
      {showOnPremDocs && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(2, 6, 23, 0.75)",
          backdropFilter: "blur(8px)", zIndex: 100, display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20
        }} onClick={() => setShowOnPremDocs(false)}>
          <div style={{
            width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden",
            background: "rgba(15, 23, 42, 0.95)", borderRadius: 16,
            border: "1px solid rgba(34, 211, 238, 0.2)",
            boxShadow: "0 0 100px rgba(0, 0, 0, 0.8)", display: "flex", flexDirection: "column"
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "rgba(255,255,255,0.02)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Server style={{ color: "#22d3ee" }} size={20} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>On-Premises Infrastructure &amp; Deployment Guide</h2>
              </div>
              <button onClick={() => setShowOnPremDocs(false)}
                style={{
                  background: "none", border: "none", color: "#94a3b8", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{
              display: "flex", gap: 4, padding: "12px 24px",
              background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.04)"
            }}>
              {[
                { key: "docker" as const, label: "Docker Compose Setup", icon: <Zap size={12} /> },
                { key: "baremetal" as const, label: "Bare-Metal System", icon: <FileText size={12} /> },
                { key: "firewall" as const, label: "Firewall & Ports", icon: <Shield size={12} /> }
              ].map(t => (
                <button key={t.key} onClick={() => setDocsTab(t.key)}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                    background: docsTab === t.key ? "rgba(6,182,212,0.15)" : "transparent",
                    color: docsTab === t.key ? "#22d3ee" : "#94a3b8",
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Modal Scrollable Content */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1, fontSize: 13, lineHeight: 1.6 }}>
              
              {/* Tab 1: Docker */}
              {docsTab === "docker" && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#22d3ee", marginTop: 0, marginBottom: 8 }}>
                    🐳 One-Command LAN Deployment (Recommended)
                  </h3>
                  <p style={{ color: "#cbd5e1", marginBottom: 16 }}>
                    Orchestrate PostgreSQL, Redis cache, NestJS API scanner, and Next.js frontend portals inside a highly secure host-network cluster.
                  </p>

                  <div style={stepBlockStyle}>
                    <div style={stepBadgeStyle}>1</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>Configure System Profile</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Copy the environment configuration profile and specify your corporate server's active IP address:</div>
                      <div style={codeWrapperStyle}>
                        <pre style={codeStyle}>cp .env.example .env</pre>
                        <button onClick={() => handleCopy("cp .env.example .env", "env")} style={copyBtnStyle}>
                          {copiedText === "env" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={stepBlockStyle}>
                    <div style={stepBadgeStyle}>2</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>Launch Containers with Demo Seeds</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Run the LAN deployer to automatically configure volumes, database extensions, and pre-load organization parameters:</div>
                      <div style={codeWrapperStyle}>
                        <pre style={codeStyle}>./deploy.sh --seed</pre>
                        <button onClick={() => handleCopy("./deploy.sh --seed", "deploy")} style={copyBtnStyle}>
                          {copiedText === "deploy" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={stepBlockStyle}>
                    <div style={stepBadgeStyle}>3</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>Access Your Local NMS Dashboard</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>Once initialized, navigate to:</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <span className="badge" style={linkBadgeStyle}>🖥️ Dashboard: http://localhost:3100</span>
                        <span className="badge" style={linkBadgeStyle}>🔑 Login: admin@acme.com / Admin@123</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Baremetal */}
              {docsTab === "baremetal" && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#22d3ee", marginTop: 0, marginBottom: 8 }}>
                    ⚙️ Bare-Metal Host &amp; Database Setup (Ubuntu / Linux / Mac)
                  </h3>
                  <p style={{ color: "#cbd5e1", marginBottom: 16 }}>
                    Install components directly on the operating system for zero-virtualization performance overhead.
                  </p>

                  <div style={stepBlockStyle}>
                    <div style={stepBadgeStyle}>1</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>Install Operating System Runtimes</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Pre-install Node.js 20, PostgreSQL, and Redis database:</div>
                      <div style={codeWrapperStyle}>
                        <pre style={codeStyle}>{`sudo apt-get install -y nodejs postgresql redis-server`}</pre>
                        <button onClick={() => handleCopy("sudo apt-get install -y nodejs postgresql redis-server", "apt")} style={copyBtnStyle}>
                          {copiedText === "apt" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={stepBlockStyle}>
                    <div style={stepBadgeStyle}>2</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>Configure PostgreSQL Owner Role</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Log into Postgres CLI and create database roles:</div>
                      <div style={codeWrapperStyle}>
                        <pre style={codeStyle}>{`CREATE USER qs_user WITH PASSWORD 'QSAsset@2026';\nCREATE DATABASE assetcommand WITH OWNER qs_user;`}</pre>
                        <button onClick={() => handleCopy("CREATE USER qs_user WITH PASSWORD 'QSAsset@2026';\nCREATE DATABASE assetcommand WITH OWNER qs_user;", "pg")} style={copyBtnStyle}>
                          {copiedText === "pg" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={stepBlockStyle}>
                    <div style={stepBadgeStyle}>3</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>Apply Schema Migrations &amp; Build</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Push database structures and build production bundles:</div>
                      <div style={codeWrapperStyle}>
                        <pre style={codeStyle}>{`npm install\nnpx prisma db push --schema apps/api/prisma/schema.prisma\nnpm run build`}</pre>
                        <button onClick={() => handleCopy("npm install\nnpx prisma db push --schema apps/api/prisma/schema.prisma\nnpm run build", "build")} style={copyBtnStyle}>
                          {copiedText === "build" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={stepBlockStyle}>
                    <div style={stepBadgeStyle}>4</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>Start Continuous PM2 Daemons</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Use process managers to execute services inside background threads:</div>
                      <div style={codeWrapperStyle}>
                        <pre style={codeStyle}>{`npm install -g pm2\npm2 start apps/api/dist/src/main.js --name "qs-api"\npm2 start npx --name "qs-web" -- next start -p 3100`}</pre>
                        <button onClick={() => handleCopy("npm install -g pm2\npm2 start apps/api/dist/src/main.js --name \"qs-api\"\npm2 start npx --name \"qs-web\" -- next start -p 3100", "pm2")} style={copyBtnStyle}>
                          {copiedText === "pm2" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Firewall */}
              {docsTab === "firewall" && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#22d3ee", marginTop: 0, marginBottom: 8 }}>
                    🛡️ Network Firewall Rules &amp; Port Scopes
                  </h3>
                  <p style={{ color: "#cbd5e1", marginBottom: 16 }}>
                    To discover endpoints, ping workstations, or monitor SNMP hardware agentlessly, open the following network routing paths.
                  </p>

                  <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          <th style={{ padding: "10px 14px", color: "#f8fafc" }}>Protocol</th>
                          <th style={{ padding: "10px 14px", color: "#f8fafc" }}>Port Range</th>
                          <th style={{ padding: "10px 14px", color: "#f8fafc" }}>Used For</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>SSH</td>
                          <td style={{ padding: "10px 14px" }}><code style={{ color: "#22d3ee" }}>TCP 22</code></td>
                          <td style={{ padding: "10px 14px", color: "#94a3b8" }}>Agentless Linux &amp; macOS system audits</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>WMI / WinRM</td>
                          <td style={{ padding: "10px 14px" }}><code style={{ color: "#22d3ee" }}>TCP 5985 / 5986</code></td>
                          <td style={{ padding: "10px 14px", color: "#94a3b8" }}>Querying Windows Management systems</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>SNMP Traps</td>
                          <td style={{ padding: "10px 14px" }}><code style={{ color: "#22d3ee" }}>UDP 161 / 162</code></td>
                          <td style={{ padding: "10px 14px", color: "#94a3b8" }}>Querying firewalls, printers, &amp; LAN switches</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>RPC / NetBIOS</td>
                          <td style={{ padding: "10px 14px" }}><code style={{ color: "#22d3ee" }}>TCP 135 / 445</code></td>
                          <td style={{ padding: "10px 14px", color: "#94a3b8" }}>Legacy active directory workstation mappings</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>ICMP Echo</td>
                          <td style={{ padding: "10px 14px" }}><code style={{ color: "#22d3ee" }}>All ICMP v4</code></td>
                          <td style={{ padding: "10px 14px", color: "#94a3b8" }}>Host status &amp; alive sweeps</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex", justifyContent: "flex-end", background: "rgba(255,255,255,0.02)"
            }}>
              <button onClick={() => setShowOnPremDocs(false)} className="btn btn-secondary"
                style={{ padding: "6px 16px", fontSize: 12, fontWeight: 700 }}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", fontSize: 11, fontWeight: 600,
  color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(148, 163, 184, 0.15)",
  color: "#e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none",
  transition: "border-color 0.2s",
};

const stepBlockStyle: React.CSSProperties = {
  display: "flex", gap: 14, marginBottom: 20, alignItems: "flex-start",
};

const stepBadgeStyle: React.CSSProperties = {
  width: 24, height: 24, borderRadius: "50%", background: "rgba(6, 182, 212, 0.15)",
  color: "#22d3ee", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 11, fontWeight: 700, flexShrink: 0, border: "1px solid rgba(6, 182, 212, 0.3)",
};

const codeWrapperStyle: React.CSSProperties = {
  position: "relative", borderRadius: 8, background: "#090d16",
  border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", marginTop: 6,
};

const codeStyle: React.CSSProperties = {
  margin: 0, padding: "10px 14px", fontSize: 12, color: "#e2e8f0", overflowX: "auto",
  fontFamily: "monospace",
};

const copyBtnStyle: React.CSSProperties = {
  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", color: "#64748b", cursor: "pointer",
  padding: 4, display: "flex", alignItems: "center", justifyContent: "center",
  transition: "color 0.2s",
};

const linkBadgeStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)", color: "#cbd5e1", fontSize: 11,
  fontWeight: 600, fontFamily: "monospace",
};
