"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Server, Shield, Building2, Mail, Lock, User, ArrowRight,
  CheckCircle2, Loader2, Zap, AlertTriangle,
} from "lucide-react";

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
    }}>
      <div style={{
        width: "100%", maxWidth: step === 2 ? 540 : 500, padding: 40,
        background: "rgba(15, 23, 42, 0.8)", borderRadius: 20,
        border: "1px solid rgba(34, 211, 238, 0.15)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 0 80px rgba(34, 211, 238, 0.06), 0 20px 60px rgba(0,0,0,0.4)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 30px rgba(34, 211, 238, 0.3)",
          }}>
            <Server size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>
            ReconAPM
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
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
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
              }}>
              {submitting ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Initializing...</>
                : <><Shield size={16} /> Initialize ReconAPM <ArrowRight size={14} /></>}
            </button>
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
              }}>
              Go to Login <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
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
