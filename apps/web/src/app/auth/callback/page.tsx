"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";

function decodeJwt(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const isNewUser = searchParams.get("new") === "1";
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(decodeURIComponent(error));
      return;
    }

    async function complete(accessToken: string, refreshToken: string) {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      const decoded = decodeJwt(accessToken);
      if (decoded) {
        localStorage.setItem("userRole", decoded.role || "");
        localStorage.setItem("userEmail", decoded.email || "");
      }
      setIsNew(isNewUser);
      setStatus("success");
      const target = decoded?.role === "Employee" ? "/portal" : "/dashboard";
      setTimeout(() => router.push(target), isNewUser ? 2500 : 1200);
    }

    // Preferred: one-time exchange code (tokens never appear in the URL)
    if (code) {
      fetch(`${API}/auth/oauth/exchange`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || "Failed to exchange authorization code");
          }
          return res.json();
        })
        .then((data) => {
          // Drop secrets from the address bar as soon as exchange succeeds
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", "/auth/callback");
          }
          return complete(data.accessToken, data.refreshToken);
        })
        .catch((err) => {
          setStatus("error");
          setMessage(err.message || "Authentication failed.");
        });
      return;
    }

    setStatus("error");
    setMessage("Authentication failed. No credentials received.");
  }, [searchParams, router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#09090b", fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif",
    }}>
      <div style={{
        maxWidth: 440, width: "100%", textAlign: "center", padding: 40,
      }}>
        {status === "loading" && (
          <>
            <Loader2 size={40} style={{ color: "#06b6d4", animation: "spin 1s linear infinite", marginBottom: 20 }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
              Completing sign in...
            </h1>
            <p style={{ fontSize: 14, color: "#94a3b8" }}>Please wait while we set up your session.</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {status === "success" && (
          <>
            {isNew ? (
              <Sparkles size={48} style={{ color: "#06b6d4", marginBottom: 20 }} />
            ) : (
              <CheckCircle2 size={48} style={{ color: "#10b981", marginBottom: 20 }} />
            )}
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 8, letterSpacing: "-0.03em" }}>
              {isNew ? "Welcome to QS Asset!" : "Welcome back!"}
            </h1>
            <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20 }}>
              {isNew
                ? "Your workspace has been created with roles, asset types, SLA policies, and automation rules. Redirecting to your dashboard..."
                : "Signed in successfully. Redirecting..."}
            </p>
            {isNew && (
              <div style={{
                padding: "12px 16px", borderRadius: 10,
                background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
                textAlign: "left", fontSize: 12, color: "#94a3b8", lineHeight: 1.7,
              }}>
                <strong style={{ color: "#06b6d4" }}>✨ Your workspace includes:</strong>
                <ul style={{ margin: "6px 0 0 0", paddingLeft: 16 }}>
                  <li>4 roles (Admin, IT Admin, Staff, Employee)</li>
                  <li>7 asset types (Laptop, Server, Network Device, etc.)</li>
                  <li>4 SLA policies (Critical through Low)</li>
                  <li>3 automation rules</li>
                </ul>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <Loader2 size={16} style={{ color: "#94a3b8", animation: "spin 1s linear infinite", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>Redirecting...</span>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={48} style={{ color: "#ef4444", marginBottom: 20 }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
              Authentication Failed
            </h1>
            <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24, lineHeight: 1.6 }}>
              {message || "Something went wrong during sign in."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => router.push("/login")}
                style={{
                  padding: "10px 24px", borderRadius: 8, border: "none",
                  background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                  color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                Back to Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b" }}>
        <Loader2 size={24} style={{ color: "#94a3b8", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
