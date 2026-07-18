"use client";
import { useEffect, useState } from "react";
import { apiFetch, getApiBase, getToken } from "@/lib/api";
import {
  Key, Plus, Download, Ban, RefreshCw, Search, Copy, CheckCircle2, X,
  Boxes, Server, Users, AlertTriangle,
} from "lucide-react";

const MODULES = [
  ["DASHBOARD", "Dashboard"], ["MY_PORTAL", "My Portal"], ["ALL_ASSETS", "All Assets"],
  ["IT_ASSETS", "IT Assets"], ["NON_IT_ASSETS", "Non-IT Assets"], ["TICKETS", "Tickets"],
  ["SERVICE_CATALOG", "Service Catalog"], ["USERS", "Users"], ["SETTINGS", "Settings"],
  ["HELP", "Help & Docs"], ["CMDB", "CMDB"], ["WORK_ORDERS", "Work Orders"],
  ["FACILITY", "Facility & EAM"], ["DISCOVERY", "Discovery"], ["PATCH_MGMT", "Patch Mgmt"],
  ["SOFTWARE_DEPLOYMENT", "Software Deploy"], ["NETWORK", "Network (NMS)"],
  ["SECURITY_SCAN", "Security Scan"], ["LICENSES", "Licenses"], ["KNOWLEDGE_BASE", "Knowledge Base"],
  ["REPORTS", "Reports"], ["AUDIT_LOGS", "Audit Logs"], ["CCTV", "CCTV"], ["ALERTS", "Alerts"],
  ["COMPLIANCE", "Compliance"], ["PROCUREMENT", "Procurement"], ["CHANGES", "Changes"],
  ["PROBLEMS", "Problems"], ["FLEET", "Fleet / GPS"], ["VDI", "VDI"], ["AUTOMATION", "Automation"],
  ["NAC", "NAC"], ["INTELLIGENCE", "Intelligence"], ["REMOTE_TERMINAL", "Remote Terminal"],
] as const;

const STATUS_COLORS: Record<string, string> = {
  ISSUED: "#64748b",
  ACTIVE: "#10b981",
  REVOKED: "#ef4444",
  EXPIRED: "#f59e0b",
};

export default function AdminLicensesPage() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issuedResult, setIssuedResult] = useState<any>(null);
  const [offlineKey, setOfflineKey] = useState("");
  const [offlineChallenge, setOfflineChallenge] = useState("");
  const [offlineResponse, setOfflineResponse] = useState("");
  const [form, setForm] = useState({
    customerName: "",
    plan: "ON_PREMISE",
    maxAssets: "-1",
    maxUsers: "-1",
    expiresAt: "",
    notes: "",
    allowedModules: MODULES.map(([key]) => key) as string[],
  });

  function load(q?: string, status = statusFilter) {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (q) params.set("search", q);
    if (status) params.set("status", status);
    Promise.all([
      apiFetch(`/product-licenses?${params}`),
      apiFetch("/product-licenses/summary"),
    ])
      .then(([d, s]) => {
        setSummary(s);
        setLicenses(d.data || []);
        setTotal(d.total || 0);
      })
      .catch((err) => alert(err?.message || "Failed to load licenses"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // default expiry = 1 year
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    setForm((f) => ({ ...f, expiresAt: d.toISOString().slice(0, 10) }));
  }, []);

  async function issueLicense(e: React.FormEvent) {
    e.preventDefault();
    setIssuing(true);
    try {
      const res = await apiFetch("/product-licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          plan: form.plan,
          maxAssets: Number(form.maxAssets),
          maxUsers: Number(form.maxUsers),
          expiresAt: new Date(form.expiresAt).toISOString(),
          notes: form.notes || undefined,
          allowedModules: form.allowedModules,
        }),
      });
      setIssuedResult(res);
      setShowIssue(false);
      load(search, statusFilter);
    } catch (err: any) {
      alert(err?.message || "Failed to issue license");
    } finally {
      setIssuing(false);
    }
  }

  async function downloadLic(id: string, key: string) {
    const res = await fetch(`${getApiBase()}/product-licenses/${id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const text = await res.text();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key}.lic`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this license? On-prem installs will fail future online activations.")) return;
    await apiFetch(`/product-licenses/${id}/revoke`, { method: "POST" });
    load(search, statusFilter);
  }

  async function renew(id: string) {
    const next = prompt("New expiry date (YYYY-MM-DD)", form.expiresAt);
    if (!next) return;
    await apiFetch(`/product-licenses/${id}/renew`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresAt: new Date(next).toISOString() }),
    });
    load(search, statusFilter);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Product Licenses</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {total} entitlements — issue keys for on-prem / enterprise installs
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(search);
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer or key..."
                style={{
                  padding: "8px 12px 8px 32px",
                  borderRadius: 8,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  width: 220,
                  outline: "none",
                }}
              />
            </div>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                load(search, e.target.value);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            >
              <option value="">All statuses</option>
              <option value="ISSUED">Issued</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </form>
          <button
            onClick={() => setShowIssue(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "#06b6d4",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Issue license
          </button>
        </div>
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Total entitlements", value: summary.total, icon: Key, color: "#06b6d4" },
            { label: "Active installs", value: summary.byStatus?.active ?? 0, icon: Server, color: "#10b981" },
            {
              label: "Licensed users",
              value: summary.activeCapacity?.includesUnlimitedUsers ? "Unlimited" : summary.activeCapacity?.maxUsers ?? 0,
              icon: Users,
              color: "#8b5cf6",
            },
            {
              label: "Licensed assets",
              value: summary.activeCapacity?.includesUnlimitedAssets ? "Unlimited" : summary.activeCapacity?.maxAssets ?? 0,
              icon: Boxes,
              color: "#3b82f6",
            },
            { label: "Expire within 30 days", value: summary.expiringSoon ?? 0, icon: AlertTriangle, color: "#f59e0b" },
          ].map((item) => (
            <div key={item.label} style={{ padding: 14, borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7, color: item.color }}>
                <item.icon size={14} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {issuedResult && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 12,
            border: "1px solid #10b98155",
            background: "#10b98112",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle2 size={16} color="#10b981" /> License issued
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                {issuedResult.licenseKey}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
                Download the .lic file for air-gapped installs, or share the key for online activation.
              </p>
            </div>
            <button onClick={() => setIssuedResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => copyText(issuedResult.licenseKey)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
            >
              <Copy size={12} /> Copy key
            </button>
            <button
              onClick={() => downloadLic(issuedResult.id, issuedResult.licenseKey)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "none", background: "#06b6d4", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              <Download size={12} /> Download .lic
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Sign air-gap challenge</h2>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
          Paste the install challenge and its issued license key to create a one-time signed response.
        </p>
        <input value={offlineKey} onChange={(e) => setOfflineKey(e.target.value)} placeholder="QS-XXXX-XXXX-XXXX-XXXX" style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontFamily: "monospace" }} />
        <textarea value={offlineChallenge} onChange={(e) => setOfflineChallenge(e.target.value)} placeholder="Challenge JSON or base64…" rows={4} style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontFamily: "monospace", fontSize: 11 }} />
        <button
          disabled={!offlineKey.trim() || !offlineChallenge.trim()}
          onClick={async () => {
            try {
              const response = await apiFetch("/product-licenses/challenge-activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ licenseKey: offlineKey.trim(), challenge: offlineChallenge.trim() }),
              });
              setOfflineResponse(JSON.stringify(response.licenseFile, null, 2));
            } catch (err: any) {
              alert(err?.message || "Failed to sign challenge");
            }
          }}
          style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#06b6d4", color: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          Sign response
        </button>
        {offlineResponse && <textarea readOnly value={offlineResponse} rows={7} style={{ width: "100%", padding: 8, marginTop: 10, borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontFamily: "monospace", fontSize: 11 }} />}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
              {["Customer", "Key", "Plan", "Seats", "Expires", "Status", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "12px 14px",
                    textAlign: "left",
                    fontWeight: 600,
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                  Loading...
                </td>
              </tr>
            ) : licenses.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                  No product licenses yet
                </td>
              </tr>
            ) : (
              licenses.map((lic) => (
                <tr key={lic.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text-primary)" }}>{lic.customerName}</td>
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                    {lic.licenseKey}
                  </td>
                  <td style={{ padding: "12px 14px" }}>{lic.plan}</td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>
                    {lic.maxUsers < 0 ? "∞" : lic.maxUsers} users / {lic.maxAssets < 0 ? "∞" : lic.maxAssets} assets
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>
                    {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: `${STATUS_COLORS[lic.status] || "#64748b"}15`,
                        color: STATUS_COLORS[lic.status] || "#64748b",
                      }}
                    >
                      {lic.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button title="Download .lic" onClick={() => downloadLic(lic.id, lic.licenseKey)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
                        <Download size={14} />
                      </button>
                      <button title="Renew" onClick={() => renew(lic.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
                        <RefreshCw size={14} />
                      </button>
                      {lic.status !== "REVOKED" && (
                        <button title="Revoke" onClick={() => revoke(lic.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showIssue && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowIssue(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={issueLicense}
            style={{
              width: 440,
              maxWidth: "92vw",
              background: "var(--bg-card)",
              border: "1px solid var(--border-primary)",
              borderRadius: 14,
              padding: 24,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Key size={18} color="#06b6d4" />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Issue product license</h2>
            </div>
            {[
              { key: "customerName", label: "Customer name", type: "text", required: true },
              { key: "expiresAt", label: "Expires", type: "date", required: true },
              { key: "maxUsers", label: "Max users (−1 = unlimited)", type: "text" },
              { key: "maxAssets", label: "Max assets (−1 = unlimited)", type: "text" },
              { key: "notes", label: "Notes", type: "text" },
            ].map((field) => (
              <label key={field.key} style={{ display: "block", marginBottom: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                {field.label}
                <input
                  required={field.required}
                  type={field.type}
                  value={(form as any)[field.key]}
                  onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                  }}
                />
              </label>
            ))}
            <label style={{ display: "block", marginBottom: 16, fontSize: 12, color: "var(--text-secondary)" }}>
              Plan
              <select
                value={form.plan}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
              >
                <option value="ON_PREMISE">ON_PREMISE</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </label>
            <fieldset style={{ margin: "0 0 16px", padding: 12, borderRadius: 8, border: "1px solid var(--border-primary)" }}>
              <legend style={{ padding: "0 5px", fontSize: 12, color: "var(--text-secondary)" }}>
                Licensed modules ({form.allowedModules.length}/{MODULES.length})
              </legend>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, allowedModules: MODULES.map(([key]) => key) }))}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-secondary)", fontSize: 10, cursor: "pointer" }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, allowedModules: [] }))}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-secondary)", fontSize: 10, cursor: "pointer" }}
                >
                  Clear
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px 12px", maxHeight: 180, overflowY: "auto" }}>
                {MODULES.map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={form.allowedModules.includes(key)}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        allowedModules: e.target.checked
                          ? [...f.allowedModules, key]
                          : f.allowedModules.filter((module) => module !== key),
                      }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {form.allowedModules.length === 0 && (
                <p style={{ margin: "8px 0 0", fontSize: 10, color: "#f59e0b" }}>
                  No selection means the server will issue all modules. Select the intended modules explicitly.
                </p>
              )}
            </fieldset>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowIssue(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
                Cancel
              </button>
              <button type="submit" disabled={issuing || form.allowedModules.length === 0} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#06b6d4", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: issuing || form.allowedModules.length === 0 ? .6 : 1 }}>
                {issuing ? "Issuing…" : "Issue"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
