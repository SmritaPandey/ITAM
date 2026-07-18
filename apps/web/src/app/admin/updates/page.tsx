"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { RefreshCw, Shield, Package, Key, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 10px", borderRadius: 8, background: "var(--bg-base)" }}>
      {ok ? <CheckCircle2 size={14} color="#10b981" /> : <XCircle size={14} color="#f59e0b" />}
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: ok ? "#10b981" : "#f59e0b" }}>
        {ok ? "CONFIGURED" : "MISSING"}
      </span>
    </div>
  );
}

export default function AdminUpdatesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    apiFetch("/platform/updates/owner-status")
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load update channel status"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Platform Updates</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Signing channels for product licenses, agents, and on-prem appliance releases
          </p>
        </div>
        <button onClick={load} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
          border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
        }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, borderRadius: 12, border: "1px solid #ef444455", background: "#ef444412", color: "#ef4444", fontSize: 13 }}>{error}</div>
      ) : data ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Deployment mode", value: data.deploymentMode, icon: Shield, color: "#06b6d4" },
              { label: "Current version", value: data.currentVersion, icon: Package, color: "#8b5cf6" },
              {
                label: "On-prem channel",
                value: data.onPrem?.manifestAvailable ? `v${data.onPrem.latestVersion}` : data.deploymentMode === "onprem" ? "No manifest" : "SaaS N/A",
                icon: Key,
                color: "#10b981",
              },
            ].map((item) => (
              <div key={item.label} style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: item.color }}>
                  <item.icon size={14} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", fontFamily: "monospace" }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: 18, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border-primary)", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>Signing key presence</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              <Flag ok={data.channels?.productLicense?.privateKeyConfigured} label="License private key" />
              <Flag ok={data.channels?.productLicense?.publicKeyConfigured} label="License public key" />
              <Flag ok={data.channels?.agentUpdate?.privateKeyConfigured} label="Agent-update private key" />
              <Flag ok={data.channels?.agentUpdate?.publicKeyConfigured} label="Agent-update public key" />
              <Flag ok={data.channels?.platformUpdate?.privateKeyConfigured} label="Platform-update private key" />
              <Flag ok={data.channels?.platformUpdate?.publicKeyConfigured} label="Platform-update public key" />
            </div>
          </div>

          {data.onPrem && (
            <div style={{ padding: 18, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border-primary)", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>On-prem update status</h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                Latest: {data.onPrem.latestVersion || "—"} · Signature valid: {String(data.onPrem.signatureValid)} ·
                Manifest available: {String(data.onPrem.manifestAvailable)}
              </p>
            </div>
          )}

          <div style={{ padding: 18, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 0 }}>{data.note}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={data.releaseDocs?.githubReleases} target="_blank" rel="noreferrer" style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#06b6d4", textDecoration: "none", fontWeight: 600,
              }}>
                GitHub Releases <ExternalLink size={12} />
              </a>
              <a href="/admin/licenses" style={{ fontSize: 12, color: "#06b6d4", textDecoration: "none", fontWeight: 600 }}>
                Issue / sign product licenses →
              </a>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
