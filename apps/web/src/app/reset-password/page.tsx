"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, ArrowRight, Lock, Eye, EyeOff } from "lucide-react";
import { LogoIcon } from "@/components/Logo";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"form" | "success" | "error">(token ? "form" : "error");
  const [message, setMessage] = useState(token ? "" : "Invalid password recovery token. Please request a new recovery link.");

  // Password validation helpers
  const isMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const matches = password === confirmPassword && password.length > 0;
  const isValid = isMinLength && hasUpper && hasNumber && matches;

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setMessage("");

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
    try {
      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password.");

      setStatus("success");
      setMessage(data.message || "Your password has been reset successfully.");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Something went wrong. Please try requesting a new recovery link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)", fontFamily: "'Inter', system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{
        maxWidth: 440, width: "100%",
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

        {status === "form" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.03em" }}>
              Reset Password
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
              Choose a strong, secure new password for your account workspace.
            </p>

            {message && (
              <div style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)",
                color: "#f87171", fontSize: 12, marginBottom: 16, textAlign: "center"
              }}>
                ⚠️ {message}
              </div>
            )}

            <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
              {/* New Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    required
                    type={showPw ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 40px 10px 14px", borderRadius: 10,
                      background: "var(--bg-input)", border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)", fontSize: 13, outline: "none"
                    }}
                    className="focus-glow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", color: "var(--text-tertiary)",
                      cursor: "pointer", display: "flex", alignItems: "center"
                    }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Confirm Password</label>
                <input
                  required
                  type="password"
                  placeholder="Re-type new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    background: "var(--bg-input)", border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)", fontSize: 13, outline: "none"
                  }}
                  className="focus-glow"
                />
              </div>

              {/* Strength Indicators */}
              <div style={{
                background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-primary)",
                borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Password Strength Checklist</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: isMinLength ? "#10b981" : "var(--text-secondary)" }}>
                  <span style={{ fontSize: 14 }}>{isMinLength ? "✓" : "○"}</span>
                  <span>Minimum 8 characters</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: hasUpper ? "#10b981" : "var(--text-secondary)" }}>
                  <span style={{ fontSize: 14 }}>{hasUpper ? "✓" : "○"}</span>
                  <span>At least one uppercase letter</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: hasNumber ? "#10b981" : "var(--text-secondary)" }}>
                  <span style={{ fontSize: 14 }}>{hasNumber ? "✓" : "○"}</span>
                  <span>At least one number</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: matches ? "#10b981" : "var(--text-secondary)" }}>
                  <span style={{ fontSize: 14 }}>{matches ? "✓" : "○"}</span>
                  <span>Passwords match</span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !isValid}
                style={{
                  width: "100%", padding: "12px 20px", borderRadius: 10,
                  border: "none", cursor: isValid && !loading ? "pointer" : "not-allowed",
                  background: isValid ? "linear-gradient(135deg, #06b6d4, #8b5cf6)" : "var(--border-primary)",
                  color: isValid ? "white" : "var(--text-tertiary)",
                  fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                  boxShadow: isValid ? "0 4px 16px rgba(6,182,212,0.25)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.2s"
                }}
              >
                {loading ? (
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <>Reset Password <Lock size={14} /></>
                )}
              </button>
            </form>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 size={48} style={{ color: "#10b981", marginBottom: 16 }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.03em" }}>
              Password Reset!
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
              {message}
            </p>
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
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.03em" }}>
              Recovery Failed
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
              {message}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => {
                setStatus("form");
                setMessage("");
              }} style={{
                padding: "10px 20px", borderRadius: 8,
                border: "1px solid var(--border-primary)",
                background: "none",
                color: "var(--text-primary)", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit"
              }}>
                Try Again
              </button>
              <Link href="/login" style={{
                padding: "10px 20px", borderRadius: 8,
                background: "var(--brand-400)",
                color: "white", fontSize: 13, fontWeight: 600,
                textDecoration: "none", display: "flex", alignItems: "center"
              }}>
                Sign In
              </Link>
            </div>
          </>
        )}
      </div>
      <style>{`
        .focus-glow:focus {
          border-color: var(--brand-400) !important;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.15);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <Loader2 size={24} style={{ color: "var(--text-tertiary)", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
