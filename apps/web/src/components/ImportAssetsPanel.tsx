"use client";
import { useState, useRef } from "react";
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ImportPanelProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function parseCSV(text: string): any[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: any = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

const SAMPLE_CSV = `name,assetTag,serialNumber,manufacturer,model,assetType,ipAddress,macAddress,hostname,notes
MacBook Pro 16,LAP-010,SN-MBP-001,Apple,MacBook Pro 16 M3,Laptop,10.0.3.50,AA:BB:CC:11:22:33,MACBOOK-JOHN,Engineering team
HP Monitor 27,MON-001,SN-HP27-001,HP,E27 G5,Hardware,,,,Finance department
Brother Printer,PRT-003,SN-BRO-001,Brother,MFC-L3770CDW,Printer,10.0.1.210,,PRINTER-FL2,2nd floor printer room`;

export default function ImportAssetsPanel({ open, onClose, onImported }: ImportPanelProps) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target?.result as string);
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    try {
      const data = await apiFetch("/assets/bulk-import", {
        method: "POST",
        body: JSON.stringify({ assets: rows }),
      });
      setResult(data);
      setStep("result");
      if (data.imported > 0) onImported();
    } catch (err: any) {
      setResult({ imported: 0, failed: rows.length, errors: [err.message] });
      setStep("result");
    }
    setImporting(false);
  }

  function handleReset() {
    setStep("upload"); setRows([]); setFileName(""); setResult(null);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "asset-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 560,
        background: "var(--bg-card)", zIndex: 1001,
        borderLeft: "1px solid var(--border-primary)",
        display: "flex", flexDirection: "column",
        animation: "slideIn 0.2s ease-out",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="stat-icon purple" style={{ width: 32, height: 32 }}><Upload size={16} /></div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Bulk Import Assets</h2>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                {step === "upload" ? "Upload a CSV file" : step === "preview" ? `Preview: ${rows.length} rows` : "Import complete"}
              </p>
            </div>
          </div>
          <button onClick={() => { onClose(); handleReset(); }} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {step === "upload" && (
            <div style={{ display: "grid", gap: 20 }}>
              {/* Drop Zone */}
              <div onClick={() => fileRef.current?.click()} style={{
                border: "2px dashed var(--border-primary)", borderRadius: 12,
                padding: 40, textAlign: "center", cursor: "pointer",
                background: "rgba(6,182,212,0.02)",
                transition: "border-color 0.2s",
              }}>
                <Upload size={36} style={{ color: "var(--brand-400)", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Click to upload CSV</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>or drag and drop your file here</div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
              </div>

              {/* Template */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Download Template</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>CSV with sample data and column headers</div>
                  </div>
                  <button className="btn btn-secondary" onClick={downloadSample} style={{ padding: "6px 12px" }}>
                    <Download size={12} /> Template
                  </button>
                </div>
              </div>

              {/* Column Guide */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Required & Optional Columns</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {[
                    { col: "name", req: true, desc: "Asset name (required)" },
                    { col: "assetTag", req: false, desc: "Unique tag (e.g. LAP-010)" },
                    { col: "serialNumber", req: false, desc: "Serial number" },
                    { col: "manufacturer", req: false, desc: "Manufacturer name" },
                    { col: "model", req: false, desc: "Model name" },
                    { col: "assetType", req: false, desc: "Type (Laptop, Server, etc.)" },
                    { col: "ipAddress", req: false, desc: "IP address" },
                    { col: "macAddress", req: false, desc: "MAC address" },
                    { col: "hostname", req: false, desc: "Hostname" },
                  ].map(c => (
                    <div key={c.col} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
                      <code style={{ fontSize: 11, color: "var(--brand-400)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>{c.col}</code>
                      {c.req && <span className="badge red" style={{ fontSize: 8 }}>Required</span>}
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div>
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={14} style={{ color: "var(--brand-400)" }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{fileName}</span>
                <span className="badge cyan">{rows.length} rows</span>
              </div>
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-primary)" }}>
                <table className="data-table" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      {rows[0] && Object.keys(rows[0]).map(k => <th key={k}>{k}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--text-tertiary)" }}>{i + 1}</td>
                        {Object.values(r).map((v, j) => (
                          <td key={j} style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>Showing first 10 of {rows.length} rows</p>}
            </div>
          )}

          {step === "result" && result && (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ textAlign: "center", padding: 24 }}>
                {result.imported > 0 ? (
                  <CheckCircle2 size={48} style={{ color: "var(--success)", margin: "0 auto 12px" }} />
                ) : (
                  <AlertTriangle size={48} style={{ color: "var(--error)", margin: "0 auto 12px" }} />
                )}
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{result.imported} Imported</div>
                {result.failed > 0 && <div style={{ fontSize: 14, color: "var(--error)" }}>{result.failed} Failed</div>}
              </div>
              {result.errors?.length > 0 && (
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginBottom: 8 }}>Errors:</div>
                  {result.errors.map((e: string, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {step === "preview" && (
            <>
              <button className="btn btn-secondary" onClick={handleReset}>Back</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                <Upload size={14} /> {importing ? "Importing..." : `Import ${rows.length} Assets`}
              </button>
            </>
          )}
          {step === "result" && (
            <button className="btn btn-primary" onClick={() => { onClose(); handleReset(); }}>Done</button>
          )}
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}
