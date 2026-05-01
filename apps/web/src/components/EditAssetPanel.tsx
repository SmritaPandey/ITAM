"use client";
import { useState, useEffect } from "react";
import { X, Save, Package } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }

interface EditAssetPanelProps {
  open: boolean;
  asset: any;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditAssetPanel({ open, asset, onClose, onUpdated }: EditAssetPanelProps) {
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (asset && open) {
      setForm({
        name: asset.name || "", assetTag: asset.assetTag || "",
        serialNumber: asset.serialNumber || "", manufacturer: asset.manufacturer || "",
        model: asset.model || "", ipAddress: asset.ipAddress || "",
        macAddress: asset.macAddress || "", hostname: asset.hostname || "",
        notes: asset.notes || "", status: asset.status || "ACTIVE",
      });
      setError("");
    }
  }, [asset, open]);

  function handleChange(key: string, value: string) {
    setForm((p: any) => ({ ...p, [key]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) { setError("Asset name is required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/assets/${asset.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update asset");
    }
    setSubmitting(false);
  }

  if (!open || !asset) return null;

  const statusOptions = ["ACTIVE", "DISCOVERED", "IN_MAINTENANCE", "IN_STORAGE", "RESERVED", "RETIRED", "DISPOSED", "PENDING_REVIEW"];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "var(--bg-card)", zIndex: 1001,
        borderLeft: "1px solid var(--border-primary)",
        display: "flex", flexDirection: "column",
        animation: "slideIn 0.2s ease-out",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="stat-icon amber" style={{ width: 32, height: 32 }}><Package size={16} /></div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Edit Asset</h2>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{asset.assetTag || asset.name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Asset Name *" value={form.name} onChange={v => handleChange("name", v)} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Asset Tag" value={form.assetTag} onChange={v => handleChange("assetTag", v)} />
              <Field label="Serial Number" value={form.serialNumber} onChange={v => handleChange("serialNumber", v)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Manufacturer" value={form.manufacturer} onChange={v => handleChange("manufacturer", v)} />
              <Field label="Model" value={form.model} onChange={v => handleChange("model", v)} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => handleChange("status", e.target.value)} style={inputStyle}>
                {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, display: "block" }}>Network</span>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="IP Address" value={form.ipAddress} onChange={v => handleChange("ipAddress", v)} />
                  <Field label="MAC Address" value={form.macAddress} onChange={v => handleChange("macAddress", v)} />
                </div>
                <Field label="Hostname" value={form.hostname} onChange={v => handleChange("hostname", v)} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => handleChange("notes", e.target.value)} style={{ ...inputStyle, height: 80, resize: "vertical" }} />
            </div>
          </div>
          {error && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "var(--error)", fontSize: 12 }}>
              {error}
            </div>
          )}
        </form>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            <Save size={14} /> {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" };

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value || ""} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}
