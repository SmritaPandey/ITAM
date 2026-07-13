"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight } from "lucide-react";
import { LogoIcon } from "@/components/Logo";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
    fetch(`${apiUrl}/auth/verify-email?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus("success");
          setMessage(data.message);
          setEmail(data.email || "");
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Unable to verify email. Please try again later.");
      });
  }, [token]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)", fontFamily: "'Inter', system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{
        maxWidth: 440, width: "100%", textAlign: "center",
        background: "var(--bg-card)", borderRadius: 16,
        border: "1px solid var(--border-primary)",
        padding: "48px 32px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}>
        {/* Logo */}
        <div style={{
          margin: "0 auto 20px",
          display: "flex",
          justifyContent: "center",
        }}>
          <LogoIcon size={68} />
        </div>

        {status === "loading" && (
          <>
            <Loader2 size={36} style={{ color: "#06b6d4", animation: "spin 1s linear infinite", marginBottom: 16 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Verifying your email...
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Please wait while we verify your email address.</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 size={48} style={{ color: "#10b981", marginBottom: 16 }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Email Verified!
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
              {message}
            </p>
            {email && (
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 24 }}>
                Verified: <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
              </p>
            )}
            <Link href="/login" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 28px", borderRadius: 10,
              background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
              color: "white", fontWeight: 700, fontSize: 14,
              textDecoration: "none", transition: "transform 0.15s",
            }}>
              Sign In <ArrowRight size={16} />
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={48} style={{ color: "#ef4444", marginBottom: 16 }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Verification Failed
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
              {message}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link href="/register" style={{
                padding: "10px 20px", borderRadius: 8,
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)", fontSize: 13, fontWeight: 600,
                textDecoration: "none",
              }}>
                Register Again
              </Link>
              <Link href="/login" style={{
                padding: "10px 20px", borderRadius: 8,
                background: "var(--brand-400)",
                color: "white", fontSize: 13, fontWeight: 600,
                textDecoration: "none",
              }}>
                Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <Loader2 size={24} style={{ color: "var(--text-tertiary)", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
