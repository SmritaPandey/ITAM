"use client";
import { useEffect, useState } from "react";
import { X, Printer, QrCode } from "lucide-react";
import { apiFetch, apiFetchBlob } from "@/lib/api";

interface PrintLabelModalProps {
  open: boolean;
  asset: any;
  onClose: () => void;
}

export default function PrintLabelModal({ open, asset, onClose }: PrintLabelModalProps) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [barcodeSrc, setBarcodeSrc] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !asset?.id) return;
    let cancelled = false;
    const urls: string[] = [];

    async function load() {
      setLoading(true);
      setError("");
      setQrSrc(null);
      setBarcodeSrc(null);
      try {
        const baseUrl = encodeURIComponent(window.location.origin);
        const [qrBlob, barcodeBlob, qrMeta] = await Promise.all([
          apiFetchBlob(`/assets/${asset.id}/qr?baseUrl=${baseUrl}`),
          apiFetchBlob(`/assets/${asset.id}/barcode`),
          apiFetch(`/assets/${asset.id}/qr?format=json&baseUrl=${baseUrl}`),
        ]);
        if (cancelled) return;
        const qrUrl = URL.createObjectURL(qrBlob);
        const bcUrl = URL.createObjectURL(barcodeBlob);
        urls.push(qrUrl, bcUrl);
        setQrSrc(qrUrl);
        setBarcodeSrc(bcUrl);
        setMeta(qrMeta);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load label");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [open, asset?.id]);

  if (!open || !asset) return null;

  const barcodeValue = meta?.barcode || asset.barcode || asset.assetTag || "—";

  return (
    <>
      <div
        className="no-print"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }}
      />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "min(440px, calc(100vw - 32px))", maxHeight: "90vh", overflow: "auto",
          background: "var(--bg-card)", border: "1px solid var(--border-primary)",
          borderRadius: 14, zIndex: 1001, boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        }}
      >
        <div className="no-print" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 18px", borderBottom: "1px solid var(--border-primary)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15 }}>
            <QrCode size={16} style={{ color: "var(--brand-400)" }} /> Print Asset Label
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)", fontSize: 13 }}>
              Generating label…
            </div>
          )}
          {error && (
            <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <div id="asset-print-label" style={{
              background: "#fff", color: "#111", borderRadius: 8, padding: 24,
              textAlign: "center", border: "1px solid #e5e7eb",
            }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
                AssetCommand Label
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{asset.name}</div>
              <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 16, fontFamily: "ui-monospace, monospace" }}>
                {asset.assetTag || barcodeValue}
                {asset.serialNumber ? ` · SN ${asset.serialNumber}` : ""}
              </div>

              {qrSrc && (
                <img
                  src={qrSrc}
                  alt="Asset QR code"
                  style={{ width: 180, height: 180, margin: "0 auto 8px", display: "block" }}
                />
              )}
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 16, wordBreak: "break-all" }}>
                {meta?.qrUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/scan?code=${encodeURIComponent(barcodeValue)}`}
              </div>

              {barcodeSrc && (
                <img
                  src={barcodeSrc}
                  alt={`Barcode ${barcodeValue}`}
                  style={{ width: "100%", maxWidth: 320, height: "auto", margin: "0 auto", display: "block" }}
                />
              )}
              <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", marginTop: 8, fontWeight: 600 }}>
                {barcodeValue}
              </div>
            </div>
          )}
        </div>

        <div className="no-print" style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "12px 18px", borderTop: "1px solid var(--border-primary)",
        }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button
            className="btn btn-primary"
            disabled={loading || !!error}
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #asset-print-label, #asset-print-label * { visibility: visible !important; }
          #asset-print-label {
            position: fixed !important;
            left: 50% !important;
            top: 20px !important;
            transform: translateX(-50%) !important;
            width: 360px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  );
}
