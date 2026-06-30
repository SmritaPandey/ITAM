"use client";
import { useState, useEffect } from "react";
import { X, Save, Package } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface CreateAssetPanelProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const INITIAL = {
  name: "", assetTag: "", serialNumber: "", manufacturer: "", model: "",
  category: "", ipAddress: "", macAddress: "", hostname: "",
  notes: "", status: "ACTIVE",
};

export default function CreateAssetPanel({ open, onClose, onCreated }: CreateAssetPanelProps) {
  const [form, setForm] = useState(INITIAL);
  const [assetTypes, setAssetTypes] = useState<any[]>([]);
  const [assetTypeId, setAssetTypeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load asset types from dedicated endpoint
    apiFetch("/asset-types")
      .then(types => {
        const list = Array.isArray(types) ? types : types.data || [];
        setAssetTypes(list);
        if (list.length > 0) setAssetTypeId(list[0].id);
      }).catch(() => {});
  }, [open]);

  function handleChange(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Asset name is required"); return; }
    if (!assetTypeId) { setError("Select an asset type"); return; }

    setSubmitting(true);
    try {
      await apiFetch("/assets", {
        method: "POST",
        body: JSON.stringify({ ...form, assetTypeId }),
      });
      setForm(INITIAL);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create asset");
    }
    setSubmitting(false);
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 1000, backdropFilter: "blur(4px)",
      }} />
      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "var(--bg-card)", zIndex: 1001,
        borderLeft: "1px solid var(--border-primary)",
        display: "flex", flexDirection: "column",
        animation: "slideIn 0.2s ease-out",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border-primary)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="stat-icon cyan" style={{ width: 32, height: 32 }}><Package size={16} /></div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add New Asset</h2>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>Register a new asset manually</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-tertiary)",
            cursor: "pointer", padding: 4,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <FormField label="Asset Name *" value={form.name} onChange={v => handleChange("name", v)} placeholder="e.g. Dell Latitude 5540" />

            <div>
              <label style={labelStyle}>Asset Type *</label>
              <select value={assetTypeId} onChange={e => setAssetTypeId(e.target.value)} style={inputStyle}>
                {assetTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Asset Tag" value={form.assetTag} onChange={v => handleChange("assetTag", v)} placeholder="LAP-003" />
              <FormField label="Serial Number" value={form.serialNumber} onChange={v => handleChange("serialNumber", v)} placeholder="SN-12345" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Manufacturer" value={form.manufacturer} onChange={v => handleChange("manufacturer", v)} placeholder="Dell" />
              <FormField label="Model" value={form.model} onChange={v => handleChange("model", v)} placeholder="Latitude 5540" />
            </div>

            <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, display: "block" }}>Network (Optional)</span>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField label="IP Address" value={form.ipAddress} onChange={v => handleChange("ipAddress", v)} placeholder="192.168.1.100" />
                  <FormField label="MAC Address" value={form.macAddress} onChange={v => handleChange("macAddress", v)} placeholder="AA:BB:CC:DD:EE:FF" />
                </div>
                <FormField label="Hostname" value={form.hostname} onChange={v => handleChange("hostname", v)} placeholder="WORKSTATION-001" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => handleChange("status", e.target.value)} style={inputStyle}>
                <option value="ACTIVE">Active</option>
                <option value="DISCOVERED">Discovered</option>
                <option value="IN_STORAGE">In Storage</option>
                <option value="PENDING_REVIEW">Pending Review</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => handleChange("notes", e.target.value)}
                placeholder="Additional notes..."
                style={{ ...inputStyle, height: 80, resize: "vertical" }} />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8,
              color: "var(--error)", fontSize: 12,
            }}>
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: "1px solid var(--border-primary)",
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            <Save size={14} /> {submitting ? "Creating..." : "Create Asset"}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
  marginBottom: 6, display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: "var(--bg-input)",
  border: "1px solid var(--border-primary)", borderRadius: 8,
  color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit",
  outline: "none",
};

function FormField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}
