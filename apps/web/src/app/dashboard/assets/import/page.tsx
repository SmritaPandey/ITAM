"use client";
import { useEffect, useState, useRef } from "react";
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2,
  AlertTriangle, X, Download, Columns, Loader2, FileCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const TARGET_FIELDS = [
  { key: "name", label: "Asset Name", required: true },
  { key: "assetTag", label: "Asset Tag", required: false },
  { key: "serialNumber", label: "Serial Number", required: false },
  { key: "category", label: "Category", required: false },
  { key: "manufacturer", label: "Manufacturer", required: false },
  { key: "model", label: "Model", required: false },
  { key: "status", label: "Status", required: false },
  { key: "ipAddress", label: "IP Address", required: false },
  { key: "macAddress", label: "MAC Address", required: false },
  { key: "hostname", label: "Hostname", required: false },
  { key: "purchasePrice", label: "Purchase Price", required: false },
  { key: "notes", label: "Notes", required: false },
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    const parts: string[] = [];
    let current = ""; let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { parts.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    parts.push(current.trim());
    return parts;
  });
  return { headers, rows };
}

function autoMap(csvHeaders: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const aliases: Record<string, string[]> = {
    name: ["name", "asset name", "asset_name", "device name"],
    assetTag: ["asset tag", "asset_tag", "tag", "assettag"],
    serialNumber: ["serial", "serial number", "serial_number", "sn"],
    category: ["category", "type", "asset type", "asset_type"],
    manufacturer: ["manufacturer", "make", "vendor", "brand"],
    model: ["model", "model name", "device model"],
    status: ["status", "state", "asset status"],
    ipAddress: ["ip", "ip address", "ip_address", "ipaddress"],
    macAddress: ["mac", "mac address", "mac_address"],
    hostname: ["hostname", "host", "host_name", "computer name"],
    purchasePrice: ["price", "cost", "purchase price", "purchase_price"],
    notes: ["notes", "comments", "description", "remarks"],
  };
  for (const [targetKey, alts] of Object.entries(aliases)) {
    for (const h of csvHeaders) {
      if (alts.includes(h.toLowerCase())) { map[targetKey] = h; break; }
    }
  }
  return map;
}

export default function ImportWizardPage() {
  const [step, setStep] = useState(1);
  const [fileData, setFileData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [assetTypeId, setAssetTypeId] = useState("");
  const [assetTypes, setAssetTypes] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validRows, setValidRows] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch("/asset-types").then(d => setAssetTypes(Array.isArray(d) ? d : d?.data || []));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setFileData(parsed);
      setMapping(autoMap(parsed.headers));
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleValidate = () => {
    if (!fileData) return;
    const errors: string[] = [];
    const rows: any[] = [];

    if (!assetTypeId) { errors.push("Please select an Asset Type"); }
    if (!mapping.name) { errors.push("'Asset Name' column must be mapped"); }

    for (let i = 0; i < fileData.rows.length; i++) {
      const row = fileData.rows[i];
      const mapped: any = {};
      for (const [targetKey, csvHeader] of Object.entries(mapping)) {
        const colIdx = fileData.headers.indexOf(csvHeader);
        if (colIdx >= 0 && row[colIdx]) mapped[targetKey] = row[colIdx];
      }
      if (!mapped.name) {
        errors.push(`Row ${i + 2}: Missing asset name`);
        continue;
      }
      if (mapped.purchasePrice) mapped.purchasePrice = parseFloat(mapped.purchasePrice) || 0;
      mapped.assetTypeId = assetTypeId;
      rows.push(mapped);
    }

    setValidationErrors(errors);
    setValidRows(rows);
    setStep(3);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await apiFetch("/assets/bulk-import", {
        method: "POST",
        body: JSON.stringify({ assets: validRows }),
      });
      setImportResult(result);
      setStep(4);
    } catch (err: any) {
      setImportResult({ error: err.message });
      setStep(4);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = TARGET_FIELDS.map(f => f.label).join(",") + "\n" +
      "Laptop-001,AT-001,SN12345,IT Equipment,Dell,Latitude 5540,ACTIVE,192.168.1.10,AA:BB:CC:DD:EE:FF,WS-001,1200.00,Sample asset\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "asset_import_template.csv"; a.click();
  };

  const STEPS = [
    { num: 1, label: "Upload" },
    { num: 2, label: "Map Columns" },
    { num: 3, label: "Validate" },
    { num: 4, label: "Results" },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Import Assets</h1>
          <p className="page-subtitle">Bulk import from CSV/Excel with column mapping and validation</p>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "var(--bg-secondary)", borderRadius: 12, padding: 4 }}>
        {STEPS.map((s, i) => (
          <div key={s.num} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: step === s.num ? "rgba(34,211,238,0.15)" : "transparent",
            color: step === s.num ? "#22d3ee" : step > s.num ? "#10b981" : "var(--text-tertiary)",
            transition: "all 0.2s",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: step > s.num ? "rgba(16,185,129,0.2)" : step === s.num ? "rgba(34,211,238,0.2)" : "rgba(100,116,139,0.15)",
              fontSize: 11,
            }}>
              {step > s.num ? <CheckCircle2 size={12} /> : s.num}
            </div>
            {s.label}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: "0 auto 16px",
            background: "rgba(34,211,238,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Upload size={28} style={{ color: "#22d3ee" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "var(--text-primary)" }}>Upload CSV File</h2>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
            Upload a CSV file with your asset data. The first row should contain column headers.
            Supports up to 10,000 rows per import.
          </p>

          <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
          <button onClick={() => fileInputRef.current?.click()} style={{
            padding: "12px 28px", borderRadius: 10, border: "2px dashed var(--border-subtle)",
            background: "transparent", color: "var(--brand-400)", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <FileSpreadsheet size={16} /> Choose CSV File
          </button>

          <div style={{ marginTop: 16 }}>
            <button onClick={downloadTemplate} style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: "rgba(100,116,139,0.15)", color: "var(--text-secondary)", fontSize: 11,
              cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <Download size={12} /> Download Template CSV
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && fileData && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                <Columns size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Map Columns
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>
                {fileData.headers.length} columns detected • {fileData.rows.length} rows • {fileName}
              </p>
            </div>
          </div>

          {/* Asset Type selector */}
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(34,211,238,0.05)", borderRadius: 8, border: "1px solid rgba(34,211,238,0.15)" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Asset Type (required)
            </label>
            <select value={assetTypeId} onChange={e => setAssetTypeId(e.target.value)} style={{
              width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)",
              background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit",
            }}>
              <option value="">Select asset type...</option>
              {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Mapping grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>Target Field</div>
            <div></div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>CSV Column</div>

            {TARGET_FIELDS.map(tf => (
              <>
                <div key={`label-${tf.key}`} style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: tf.required ? 600 : 400 }}>
                  {tf.label} {tf.required && <span style={{ color: "#ef4444" }}>*</span>}
                </div>
                <ArrowRight key={`arrow-${tf.key}`} size={12} style={{ color: "var(--text-tertiary)" }} />
                <select key={`select-${tf.key}`}
                  value={mapping[tf.key] || ""}
                  onChange={e => setMapping({ ...mapping, [tf.key]: e.target.value })}
                  style={{
                    padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-subtle)",
                    background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 11, fontFamily: "inherit",
                  }}>
                  <option value="">— skip —</option>
                  {fileData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </>
            ))}
          </div>

          {/* Preview */}
          <div style={{ marginTop: 16, padding: 12, background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>
              Preview (first 3 rows)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    {fileData.headers.map(h => (
                      <th key={h} style={{ padding: "4px 8px", textAlign: "left", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fileData.rows.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{ padding: "4px 8px", color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button onClick={() => { setStep(1); setFileData(null); }} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-subtle)",
              background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
            }}><ArrowLeft size={12} /> Back</button>
            <button onClick={handleValidate} style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "var(--brand-500)", color: "#0a0f1a", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
            }}>Validate & Preview <ArrowRight size={12} /></button>
          </div>
        </div>
      )}

      {/* Step 3: Validation */}
      {step === 3 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                <FileCheck size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Validation Results
              </h3>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 16 }}>
            <div className="stat-card" style={{ padding: 12 }}>
              <div className="stat-content">
                <div className="stat-label">Valid Rows</div>
                <div className="stat-value" style={{ fontSize: 24, color: "#10b981" }}>{validRows.length}</div>
              </div>
              <CheckCircle2 size={18} style={{ color: "#10b981" }} />
            </div>
            <div className="stat-card" style={{ padding: 12 }}>
              <div className="stat-content">
                <div className="stat-label">Errors</div>
                <div className="stat-value" style={{ fontSize: 24, color: validationErrors.length > 0 ? "#ef4444" : "#10b981" }}>{validationErrors.length}</div>
              </div>
              <AlertTriangle size={18} style={{ color: validationErrors.length > 0 ? "#ef4444" : "#10b981" }} />
            </div>
            <div className="stat-card" style={{ padding: 12 }}>
              <div className="stat-content">
                <div className="stat-label">Columns Mapped</div>
                <div className="stat-value" style={{ fontSize: 24 }}>{Object.values(mapping).filter(Boolean).length}</div>
              </div>
              <Columns size={18} style={{ color: "var(--brand-400)" }} />
            </div>
          </div>

          {/* Errors */}
          {validationErrors.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", maxHeight: 200, overflowY: "auto" }}>
              {validationErrors.map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: "#ef4444", padding: "2px 0", display: "flex", alignItems: "center", gap: 6 }}>
                  <X size={10} /> {e}
                </div>
              ))}
            </div>
          )}

          {/* Preview valid rows */}
          {validRows.length > 0 && (
            <div style={{ overflowX: "auto", maxHeight: 300 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Tag</th>
                    <th>Serial</th>
                    <th>Manufacturer</th>
                    <th>Model</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.slice(0, 20).map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{r.name}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--brand-400)" }}>{r.assetTag || "—"}</td>
                      <td style={{ fontSize: 11 }}>{r.serialNumber || "—"}</td>
                      <td style={{ fontSize: 11 }}>{r.manufacturer || "—"}</td>
                      <td style={{ fontSize: 11 }}>{r.model || "—"}</td>
                      <td><span className="badge blue" style={{ fontSize: 10 }}>{r.status || "DISCOVERED"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validRows.length > 20 && <p style={{ fontSize: 11, color: "var(--text-tertiary)", padding: 8 }}>...and {validRows.length - 20} more rows</p>}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button onClick={() => setStep(2)} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-subtle)",
              background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
            }}><ArrowLeft size={12} /> Back to Mapping</button>
            <button onClick={handleImport} disabled={validRows.length === 0 || importing}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none",
                background: validRows.length > 0 ? "#10b981" : "var(--border-subtle)", color: "#fff", fontSize: 12, fontWeight: 600,
                cursor: validRows.length > 0 ? "pointer" : "not-allowed", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6, opacity: importing ? 0.7 : 1,
              }}>
              {importing ? <><Loader2 size={12} className="spin" /> Importing...</> : <>Import {validRows.length} Assets <ArrowRight size={12} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 4 && (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          {importResult?.error ? (
            <>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <X size={28} style={{ color: "#ef4444" }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Import Failed</h2>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{importResult.error}</p>
            </>
          ) : (
            <>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CheckCircle2 size={28} style={{ color: "#10b981" }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#10b981", margin: "0 0 8px" }}>Import Complete!</h2>
              <div style={{ display: "inline-flex", gap: 24, marginTop: 12, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{importResult?.created ?? validRows.length}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Created</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>{importResult?.skipped ?? 0}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Skipped</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444" }}>{importResult?.errors ?? 0}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Errors</div>
                </div>
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20 }}>
            <a href="/dashboard/assets" style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: "var(--brand-500)", color: "#0a0f1a", fontSize: 12, fontWeight: 600,
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
            }}>View Assets</a>
            <button onClick={() => { setStep(1); setFileData(null); setImportResult(null); setValidRows([]); setMapping({}); }} style={{
              padding: "10px 20px", borderRadius: 8, border: "1px solid var(--border-subtle)",
              background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            }}>Import More</button>
          </div>
        </div>
      )}
    </>
  );
}
