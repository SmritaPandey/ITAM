"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ImagePlus, Keyboard, Loader2, QrCode, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";

function extractCode(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  try {
    if (trimmed.includes("://") || trimmed.startsWith("/scan")) {
      const url = trimmed.includes("://") ? new URL(trimmed) : new URL(trimmed, window.location.origin);
      const fromQuery = url.searchParams.get("code");
      if (fromQuery) return fromQuery.trim();
      // Deep link to asset detail — use last path segment only when it looks like an id
      const parts = url.pathname.split("/").filter(Boolean);
      const assetIdx = parts.indexOf("assets");
      if (assetIdx >= 0 && parts[assetIdx + 1]) return parts[assetIdx + 1];
    }
  } catch {
    // fall through
  }
  return trimmed;
}

function ScanPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scannerRef = useRef<any>(null);
  const regionId = "qr-reader-region";

  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState<"idle" | "scanning" | "looking" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const handledRef = useRef(false);

  async function lookupAndNavigate(raw: string) {
    const code = extractCode(raw);
    if (!code) {
      setStatus("error");
      setMessage("No barcode detected");
      return;
    }
    if (!getToken()) {
      setStatus("error");
      setMessage("Please sign in to look up assets");
      try { sessionStorage.setItem("pendingScanCode", code); } catch { /* ignore */ }
      router.push("/login");
      return;
    }

    setStatus("looking");
    setMessage(`Looking up “${code}”…`);
    try {
      const asset = await apiFetch(`/assets/lookup?barcode=${encodeURIComponent(code)}`);
      setStatus("success");
      setMessage(`Found: ${asset.name}`);
      setTimeout(() => router.push(`/dashboard/assets/${asset.id}`), 400);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "No asset found for that code");
      handledRef.current = false;
    }
  }

  // Auto-lookup when arriving via QR deep link (?code=) or after login
  useEffect(() => {
    const fromQuery = searchParams.get("code");
    let pending = "";
    try { pending = sessionStorage.getItem("pendingScanCode") || ""; } catch { /* ignore */ }
    const code = fromQuery || pending;
    if (code && !handledRef.current && getToken()) {
      handledRef.current = true;
      try { sessionStorage.removeItem("pendingScanCode"); } catch { /* ignore */ }
      lookupAndNavigate(code);
    } else if (fromQuery && !getToken()) {
      try { sessionStorage.setItem("pendingScanCode", fromQuery); } catch { /* ignore */ }
      setStatus("error");
      setMessage("Sign in to look up this asset, then return to Scan");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function startCamera() {
    setMessage("");
    setStatus("scanning");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
        scannerRef.current = null;
      }
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          if (handledRef.current) return;
          handledRef.current = true;
          try { await scanner.stop(); } catch { /* ignore */ }
          setCameraActive(false);
          scannerRef.current = null;
          await lookupAndNavigate(decoded);
        },
        () => { /* ignore frame errors */ },
      );
      setCameraActive(true);
    } catch (err: any) {
      setStatus("error");
      setCameraActive(false);
      setMessage(err?.message || "Camera unavailable. Try uploading an image or enter the code manually.");
    }
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setCameraActive(false);
    if (status === "scanning") setStatus("idle");
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("scanning");
    setMessage("Reading image…");
    handledRef.current = false;
    try {
      await stopCamera();
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(regionId);
      const decoded = await scanner.scanFile(file, true);
      try { await scanner.clear(); } catch { /* ignore */ }
      handledRef.current = true;
      await lookupAndNavigate(decoded);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Could not read a QR/barcode from that image");
    }
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(165deg, #0b1220 0%, #111827 45%, #0f172a 100%)",
      color: "#f8fafc",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
      padding: "16px 16px 32px",
    }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <button
          onClick={() => router.push("/dashboard/assets")}
          style={{
            background: "transparent", border: "none", color: "#94a3b8",
            display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
            fontSize: 13, padding: "8px 0", marginBottom: 8,
          }}
        >
          <ArrowLeft size={14} /> Assets
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(6,182,212,0.15)", color: "#22d3ee",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <QrCode size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Scan Asset</h1>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>QR, barcode, or RFID/NFC tag → open asset</p>
          </div>
        </div>

        <div style={{
          marginTop: 20, borderRadius: 16, overflow: "hidden",
          border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.85)",
        }}>
          <div id={regionId} style={{ width: "100%", minHeight: cameraActive ? 280 : 0 }} />
          {!cameraActive && (
            <div style={{
              minHeight: 220, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 10, color: "#64748b", padding: 24,
            }}>
              <Camera size={36} />
              <div style={{ fontSize: 13, textAlign: "center" }}>Use the camera or upload a photo of the label</div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          {!cameraActive ? (
            <button
              onClick={startCamera}
              style={btnStyle("#0891b2", "#fff")}
            >
              <Camera size={16} /> Start Camera
            </button>
          ) : (
            <button onClick={stopCamera} style={btnStyle("#334155", "#e2e8f0")}>
              Stop Camera
            </button>
          )}
          <label style={{ ...btnStyle("#1e293b", "#e2e8f0"), cursor: "pointer" }}>
            <ImagePlus size={16} /> Upload Image
            <input type="file" accept="image/*" capture="environment" onChange={onFileSelected} style={{ display: "none" }} />
          </label>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handledRef.current = true;
            lookupAndNavigate(manualCode);
          }}
          style={{
            marginTop: 14, display: "1px solid rgba(148,163,184,0.2)", borderRadius: 12,
            padding: 12, background: "rgba(15,23,42,0.7)",
          }}
        >
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Keyboard size={12} /> Or enter barcode / asset tag
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Asset tag, barcode, serial, or RFID"
              style={{
                flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
                padding: "10px 12px", color: "#f8fafc", fontSize: 14, outline: "none",
              }}
            />
            <button type="submit" style={{ ...btnStyle("#0891b2", "#fff"), padding: "10px 14px" }}>
              Lookup
            </button>
          </div>
        </form>

        {(status === "looking" || status === "success" || status === "error" || message) && (
          <div style={{
            marginTop: 14, padding: 12, borderRadius: 10, fontSize: 13,
            display: "flex", alignItems: "center", gap: 8,
            background: status === "error" ? "rgba(239,68,68,0.12)" : status === "success" ? "rgba(16,185,129,0.12)" : "rgba(6,182,212,0.1)",
            color: status === "error" ? "#fca5a5" : status === "success" ? "#6ee7b7" : "#67e8f9",
          }}>
            {status === "looking" && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
            {status === "success" && <CheckCircle2 size={16} />}
            {status === "error" && <AlertCircle size={16} />}
            {message || status}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: bg,
  color,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
});

export default function ScanPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b1220", color: "#94a3b8" }}>
        Loading scanner…
      </div>
    }>
      <ScanPageInner />
    </Suspense>
  );
}
