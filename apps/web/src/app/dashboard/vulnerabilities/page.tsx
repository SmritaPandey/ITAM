"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert, RefreshCw, Loader2, Filter, Bug, ExternalLink,
  CheckCircle2, Download, Radar,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";

const SEVERITY_MAP: Record<string, { color: string; bg: string; badge: string }> = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", badge: "red" },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.12)", badge: "amber" },
  MEDIUM:   { color: "#eab308", bg: "rgba(234,179,8,0.12)",  badge: "amber" },
  LOW:      { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  badge: "blue" },
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  REMEDIATED: "Remediated",
  FALSE_POSITIVE: "False Positive",
};

export default function VulnerabilitiesPage() {
  const router = useRouter();
  const [findings, setFindings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string>("");
  const [status, setStatus] = useState<string>("OPEN");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (severity) params.set("severity", severity);
      if (status) params.set("status", status);
      const [list, dash] = await Promise.all([
        apiFetch(`/vulnerabilities?${params}`),
        apiFetch("/vulnerabilities/dashboard").catch(() => null),
      ]);
      setFindings(list?.data || []);
      setTotal(list?.total || 0);
      setDashboard(dash);
    } catch (e) {
      console.error(e);
      setFindings([]);
    }
    setLoading(false);
  }, [severity, status]);

  useEffect(() => { load(); }, [load]);

  const ingest = async () => {
    setBusy("ingest");
    try {
      const res = await apiFetch("/vulnerabilities/ingest", {
        method: "POST",
        body: JSON.stringify({ daysBack: 7 }),
      });
      alert(`Ingested ${res?.upserted ?? 0} CVEs from NVD${res?.totalAvailable != null ? ` (${res.totalAvailable} available in window)` : ""}.`);
      await load();
    } catch (e: any) {
      alert(e?.message || "NVD ingest failed. Check NVD_API_KEY / rate limits.");
    }
    setBusy(null);
  };

  const scan = async () => {
    setBusy("scan");
    try {
      const res = await apiFetch("/vulnerabilities/scan", { method: "POST", body: "{}" });
      alert(`Scanned ${res?.assetsScanned ?? 0} assets — ${res?.totalMatches ?? 0} matches.`);
      await load();
    } catch (e: any) {
      alert(e?.message || "Scan failed.");
    }
    setBusy(null);
  };

  const updateStatus = async (id: string, next: string) => {
    try {
      await apiFetch(`/vulnerabilities/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Update failed");
    }
  };

  const sev = dashboard?.bySeverity || {};

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            <ShieldAlert size={22} style={{ color: "var(--brand-400)" }} /> Vulnerabilities
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 6 }}>
            CVE findings matched from NVD against installed software and OS.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={load} disabled={!!busy}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={ingest} disabled={!!busy}>
            {busy === "ingest" ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            Ingest NVD
          </button>
          <button className="btn btn-primary" onClick={scan} disabled={!!busy}>
            {busy === "scan" ? <Loader2 size={14} className="spin" /> : <Radar size={14} />}
            Scan Assets
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Open Findings", value: dashboard?.open ?? "—", color: "var(--brand-400)" },
          { label: "Critical", value: sev.CRITICAL ?? 0, color: "#ef4444" },
          { label: "High", value: sev.HIGH ?? 0, color: "#f97316" },
          { label: "Medium", value: sev.MEDIUM ?? 0, color: "#eab308" },
          { label: "CVE Catalog", value: dashboard?.cveCatalogSize ?? 0, color: "var(--text-secondary)" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Filter size={14} style={{ color: "var(--text-tertiary)" }} />
        {["", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => (
          <button
            key={s || "ALL"}
            onClick={() => setSeverity(s)}
            className={`btn ${severity === s ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "4px 12px", fontSize: 12 }}
          >
            {s || "All Severities"}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: "var(--border-primary)", margin: "0 4px" }} />
        {["OPEN", "ACKNOWLEDGED", "REMEDIATED", "FALSE_POSITIVE", ""].map((s) => (
          <button
            key={s || "ALL_STATUS"}
            onClick={() => setStatus(s)}
            className={`btn ${status === s ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "4px 12px", fontSize: 12 }}
          >
            {s ? STATUS_LABELS[s] : "All Status"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} style={{ color: "var(--brand-500)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : findings.length === 0 ? (
        <EmptyState
          icon={<Bug size={40} />}
          title="No vulnerability findings"
          description={
            (dashboard?.cveCatalogSize ?? 0) === 0
              ? "Ingest CVEs from NVD, then run a scan against assets with software inventory."
              : "No matches for the current filters. Try scanning assets or clearing severity/status filters."
          }
          action={{ label: "Go to Discovery", href: "/dashboard/discovery" }}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "14px 18px" }}>
            <div className="card-title">{total} finding{total !== 1 ? "s" : ""}</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>CVE</th>
                <th>Severity</th>
                <th>Asset</th>
                <th>Matched Software</th>
                <th>CVSS</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => {
                const v = f.vulnerability || {};
                const sevMeta = SEVERITY_MAP[v.severity] || SEVERITY_MAP.MEDIUM;
                return (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{v.cveId}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.title}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${sevMeta.badge}`} style={{ color: sevMeta.color }}>
                        {v.severity}
                      </span>
                    </td>
                    <td>
                      {f.asset ? (
                        <button
                          onClick={() => router.push(`/dashboard/assets/${f.asset.id}`)}
                          style={{
                            background: "none", border: "none", color: "var(--brand-400)",
                            cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0,
                            display: "inline-flex", alignItems: "center", gap: 4,
                          }}
                        >
                          {f.asset.name} <ExternalLink size={11} />
                        </button>
                      ) : "—"}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{f.matchedSoftware || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{v.cvssScore != null ? Number(v.cvssScore).toFixed(1) : "—"}</td>
                    <td>
                      <select
                        value={f.status}
                        onChange={(e) => updateStatus(f.id, e.target.value)}
                        style={{
                          fontSize: 12, padding: "4px 8px", borderRadius: 6,
                          background: "var(--bg-elevated)", color: "var(--text-primary)",
                          border: "1px solid var(--border-primary)",
                        }}
                      >
                        {Object.keys(STATUS_LABELS).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {f.lastSeenAt ? new Date(f.lastSeenAt).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      {f.status === "OPEN" && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "2px 8px", fontSize: 11 }}
                          onClick={() => updateStatus(f.id, "ACKNOWLEDGED")}
                          title="Acknowledge"
                        >
                          <CheckCircle2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
