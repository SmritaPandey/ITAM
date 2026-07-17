"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { LogoIcon } from "@/components/Logo";
import { Eye, EyeOff, Loader2, ArrowRight, Sun, Moon, Shield, Lock, Fingerprint, Globe2, Zap, BarChart3, Mail, CheckCircle } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { trackEvent } from "@/components/Analytics";
import { TrustStrip } from "@/components/landing/TrustStrip";

function decodeJwt(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDev = process.env.NODE_ENV === "development";
  const [email, setEmail] = useState(isDev ? "admin@acme.com" : "");
  const [password, setPassword] = useState(isDev ? "Admin@123" : "");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { theme, toggleTheme } = useTheme();
  const [focused, setFocused] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; microsoft: boolean; extra: { id: string; name: string; startUrl: string }[] }>({
    google: false,
    microsoft: false,
    extra: [],
  });
  const [showForgotNotice, setShowForgotNotice] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function completeLogin(data: { accessToken: string; refreshToken: string }, fallbackEmail: string) {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    const decoded = decodeJwt(data.accessToken);
    localStorage.setItem("userRole", decoded?.role || "");
    localStorage.setItem("userEmail", decoded?.email || fallbackEmail);
    trackEvent("login_success", { role: decoded?.role || "unknown" });
    router.push(decoded?.role === "Employee" ? "/portal" : "/dashboard");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to trigger recovery link");
      setForgotSuccess(true);
    } catch (err: any) {
      setForgotError(err.message || "Something went wrong.");
    } finally {
      setForgotLoading(false);
    }
  }

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";

  useEffect(() => {
    // Check for OAuth error in URL
    const urlError = searchParams.get("error");
    if (urlError) setError(decodeURIComponent(urlError));
  }, [searchParams]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tenant = searchParams.get("tenant") || undefined;
    const qs = tenant ? `?tenant=${encodeURIComponent(tenant)}` : "";
    fetch(`${API}/auth/sso/providers${qs}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.providers) ? data.providers : [];
        const google = list.some((p: any) => p.id === "google" || p.provider === "GOOGLE");
        const microsoft = list.some((p: any) => p.id === "microsoft" || p.provider === "MICROSOFT");
        const extra = list.filter(
          (p: any) => p.id !== "google" && p.id !== "microsoft" && p.enabled !== false,
        ).map((p: any) => ({
          id: p.id,
          name: p.name || p.provider,
          startUrl: p.startUrl,
        }));
        setOauthProviders({ google, microsoft, extra });
      })
      .catch(() => {
        // Fallback to legacy /auth/providers
        fetch(`${API}/auth/providers`)
          .then((r) => r.json())
          .then((d) => setOauthProviders({
            google: !!d.google,
            microsoft: !!d.microsoft,
            extra: [],
          }))
          .catch(() => setOauthProviders({ google: false, microsoft: false, extra: [] }));
      });
  }, [API, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mfaToken) {
        const res = await fetch(`${API}/auth/mfa/challenge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mfaToken, code: mfaCode }),
        });
        if (!res.ok) { const data = await res.json(); throw new Error(data.message || "Invalid MFA code"); }
        const data = await res.json();
        await completeLogin(data, email);
        return;
      }
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.message || "Invalid credentials"); }
      const data = await res.json();
      if (data.mfaRequired && (data.mfaToken || data.mfaChallengeToken)) {
        setMfaToken(data.mfaToken || data.mfaChallengeToken);
        setLoading(false);
        return;
      }
      await completeLogin(data, email);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally { setLoading(false); }
  }

  const dk = theme === "dark";

  const FEATURES = [
    { icon: <Shield size={20} />, title: "Enterprise Security", desc: "SOC 2 compliant with end-to-end encryption" },
    { icon: <Globe2 size={20} />, title: "Network Discovery", desc: "Auto-detect every device on your network" },
    { icon: <BarChart3 size={20} />, title: "Real-Time Analytics", desc: "Live dashboards with actionable insights" },
    { icon: <Zap size={20} />, title: "Smart Automation", desc: "Automated workflows and compliance checks" },
  ];

  return (
    <div style={{
      minHeight: "100vh", display: "flex", fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      background: dk ? "#09090b" : "#fafafa",
    }}>
      {/* ─── Left Panel: Brand / Features ─── */}
      <div className="login-hero" style={{
        flex: "0 0 50%", display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "60px 56px", position: "relative", overflow: "hidden",
        background: dk
          ? "linear-gradient(160deg, #0c0f1d 0%, #111631 40%, #0e1428 100%)"
          : "linear-gradient(160deg, #f0f9ff 0%, #e0e7ff 40%, #ede9fe 100%)",
      }}>
        {/* Subtle grain texture only */}
        <div style={{ position: "absolute", inset: 0, opacity: dk ? 0.02 : 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='${dk ? '%23fff' : '%23000'}' stroke-width='0.3'%3E%3Cpath d='M0 30h60M30 0v60'/%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 480 }}>
          {/* Brand */}
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 48, textDecoration: "none", color: "inherit" }}>
            <LogoIcon size={52} glow={dk} />
            <span style={{
              fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em",
              color: dk ? "#f1f5f9" : "#0f172a",
            }}>QS Asset</span>
          </Link>

          {/* Headline */}
          <h1 style={{
            fontSize: 42, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.04em",
            color: dk ? "#f8fafc" : "#0f172a", marginBottom: 16,
          }}>
            Secure Every Asset.{" "}
            <span style={{
              background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Everywhere.</span>
          </h1>
          <p style={{
            fontSize: 16, lineHeight: 1.7, color: dk ? "#94a3b8" : "#64748b",
            maxWidth: 420, marginBottom: 40,
          }}>
            Enterprise-grade IT asset management, network monitoring, and security compliance — all in one platform.
          </p>

          {/* Feature chips */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "14px 16px", borderRadius: 12,
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.6)",
                border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                backdropFilter: "blur(8px)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}>
                <div style={{
                  color: "#06b6d4", flexShrink: 0, marginTop: 2,
                }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: dk ? "#e2e8f0" : "#1e293b", marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: dk ? "#64748b" : "#94a3b8", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div style={{ marginTop: 40 }}>
            <TrustStrip
              compact
              muted={dk ? "#64748b" : "#94a3b8"}
              txt={dk ? "#e2e8f0" : "#1e293b"}
              border={dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
              L={!dk}
            />
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="login-form-panel" style={{
        flex: "0 0 50%", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 32px", position: "relative",
        background: dk ? "#09090b" : "#fafafa",
      }}>
        {/* Theme toggle */}
        <button onClick={toggleTheme} style={{
          position: "absolute", top: 24, right: 24, width: 40, height: 40,
          borderRadius: 10, border: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
          background: dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
          color: dk ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.2s",
        }}>
          {dk ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* Mobile-only brand */}
          <div className="login-mobile-brand" style={{ display: "none", textAlign: "center", marginBottom: 32 }}>
            <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <LogoIcon size={42} glow={dk} />
              <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: dk ? "#f1f5f9" : "#0f172a" }}>QS Asset</span>
            </Link>
          </div>

          {/* Welcome */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em",
              color: dk ? "#f8fafc" : "#0f172a", marginBottom: 8,
            }}>Welcome back</h2>
            <p style={{ fontSize: 14, color: dk ? "#64748b" : "#94a3b8", lineHeight: 1.6 }}>
              Sign in to your workspace to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Email */}
            <div>
              <label style={{
                display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8,
                color: dk ? "#a1a1aa" : "#71717a", letterSpacing: "-0.01em",
              }}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                placeholder="you@company.com" required autoComplete="email"
                style={{
                  width: "100%", padding: "13px 16px", borderRadius: 10, fontSize: 14,
                  fontFamily: "inherit", outline: "none", transition: "all 0.2s ease",
                  background: dk ? "rgba(255,255,255,0.04)" : "white",
                  border: `1.5px solid ${focused === "email" ? "#06b6d4" : dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
                  color: dk ? "#f1f5f9" : "#0f172a",
                  boxShadow: focused === "email" ? "0 0 0 3px rgba(6,182,212,0.1)" : "none",
                }} />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{
                  fontSize: 13, fontWeight: 600,
                  color: dk ? "#a1a1aa" : "#71717a", letterSpacing: "-0.01em",
                }}>Password</label>
                <button type="button" onClick={() => setShowForgotNotice(true)} style={{
                  fontSize: 12, color: "#06b6d4", textDecoration: "none", fontWeight: 500,
                  background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit"
                }}>Forgot password?</button>
              </div>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")} onBlur={() => setFocused(null)}
                  placeholder="Enter your password" required autoComplete="current-password"
                  style={{
                    width: "100%", padding: "13px 44px 13px 16px", borderRadius: 10, fontSize: 14,
                    fontFamily: "inherit", outline: "none", transition: "all 0.2s ease",
                    background: dk ? "rgba(255,255,255,0.04)" : "white",
                    border: `1.5px solid ${focused === "password" ? "#06b6d4" : dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
                    color: dk ? "#f1f5f9" : "#0f172a",
                    boxShadow: focused === "password" ? "0 0 0 3px rgba(6,182,212,0.1)" : "none",
                  }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  color: dk ? "#52525b" : "#a1a1aa",
                }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mfaToken && (
              <div>
                <label style={{
                  display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8,
                  color: dk ? "#a1a1aa" : "#71717a",
                }}>Authenticator code</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  value={mfaCode} onChange={e => setMfaCode(e.target.value)}
                  placeholder="6-digit code" required autoComplete="one-time-code"
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: 10, fontSize: 14,
                    fontFamily: "inherit", outline: "none", letterSpacing: "0.2em",
                    background: dk ? "rgba(255,255,255,0.04)" : "white",
                    border: `1.5px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
                    color: dk ? "#f1f5f9" : "#0f172a",
                  }} />
                <button type="button" onClick={() => { setMfaToken(null); setMfaCode(""); }}
                  style={{ marginTop: 8, background: "none", border: "none", color: "#06b6d4", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Back to password
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                background: dk ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)",
                border: `1px solid ${dk ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)"}`,
                color: "#ef4444", display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "14px 16px", borderRadius: 10,
              border: "none", cursor: loading ? "wait" : "pointer",
              background: loading
                ? (dk ? "rgba(6,182,212,0.3)" : "rgba(6,182,212,0.4)")
                : "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
              color: "white", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: loading ? "none" : "0 4px 16px rgba(6,182,212,0.25), 0 1px 3px rgba(6,182,212,0.1)",
              transition: "all 0.2s ease", letterSpacing: "-0.01em",
            }}>
              {loading ? (
                <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Signing in...</>
              ) : mfaToken ? (
                <>Verify MFA <Shield size={15} /></>
              ) : (
                <>Sign in <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {/* OAuth Divider */}
          {(oauthProviders.google || oauthProviders.microsoft || oauthProviders.extra.length > 0) && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
                <div style={{ flex: 1, height: 1, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
                <span style={{ fontSize: 11, color: dk ? "#52525b" : "#a1a1aa", fontWeight: 500, letterSpacing: "0.02em" }}>OR CONTINUE WITH</span>
                <div style={{ flex: 1, height: 1, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {oauthProviders.google && (
                  <a href={`${API}/auth/google`} style={{
                    flex: 1, minWidth: 120, padding: "12px 16px", borderRadius: 10, textDecoration: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    background: dk ? "rgba(255,255,255,0.04)" : "white",
                    border: `1.5px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
                    fontSize: 13, fontWeight: 600, color: dk ? "#e4e4e7" : "#3f3f46",
                    fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Google
                  </a>
                )}
                {oauthProviders.microsoft && (
                  <a href={`${API}/auth/microsoft`} style={{
                    flex: 1, minWidth: 120, padding: "12px 16px", borderRadius: 10, textDecoration: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    background: dk ? "rgba(255,255,255,0.04)" : "white",
                    border: `1.5px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
                    fontSize: 13, fontWeight: 600, color: dk ? "#e4e4e7" : "#3f3f46",
                    fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>
                    Microsoft
                  </a>
                )}
                {oauthProviders.extra.map((p) => (
                  <a key={p.id} href={p.startUrl} style={{
                    flex: 1, minWidth: 120, padding: "12px 16px", borderRadius: 10, textDecoration: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    background: dk ? "rgba(255,255,255,0.04)" : "white",
                    border: `1.5px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
                    fontSize: 13, fontWeight: 600, color: dk ? "#e4e4e7" : "#3f3f46",
                    fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <Fingerprint size={16} />
                    {p.name}
                  </a>
                ))}
              </div>
            </>
          )}

          {/* Demo quick-logins — only rendered when explicitly enabled (never in production) */}
          {process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === "true" && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, margin: "24px 0",
              }}>
                <div style={{ flex: 1, height: 1, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
                <span style={{ fontSize: 11, color: dk ? "#52525b" : "#a1a1aa", fontWeight: 500, letterSpacing: "0.02em" }}>DEMO CREDENTIALS</span>
                <div style={{ flex: 1, height: 1, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
              </div>
              <div className="login-demo-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Platform Owner", email: "owner@qsasset.com", color: "#f59e0b", sub: "Super admin" },
                  { label: "Admin Demo", email: "director@demobank.com", color: "#06b6d4", sub: "Tenant admin" },
                  { label: "IT Admin", email: "itsupport@demobank.com", color: "#10b981", sub: "IT operations" },
                  { label: "Security", email: "ciso@demobank.com", color: "#8b5cf6", sub: "Security admin" },
                ].map(q => (
                  <button key={q.email} type="button" onClick={() => { setEmail(q.email); setPassword(process.env.NEXT_PUBLIC_DEMO_PASSWORD || ""); }}
                    style={{
                      padding: "12px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                      background: email === q.email
                        ? (dk ? `rgba(${q.color === "#06b6d4" ? "6,182,212" : q.color === "#f59e0b" ? "245,158,11" : q.color === "#10b981" ? "16,185,129" : "139,92,246"},0.08)` : `rgba(${q.color === "#06b6d4" ? "6,182,212" : q.color === "#f59e0b" ? "245,158,11" : q.color === "#10b981" ? "16,185,129" : "139,92,246"},0.06)`)
                        : (dk ? "rgba(255,255,255,0.03)" : "white"),
                      border: `1.5px solid ${email === q.email ? `${q.color}40` : dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}`,
                      transition: "all 0.15s",
                      textAlign: "left",
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: email === q.email ? q.color : (dk ? "#e4e4e7" : "#3f3f46"), marginBottom: 2 }}>
                      {q.label}
                    </div>
                    <div style={{ fontSize: 11, color: dk ? "#52525b" : "#a1a1aa" }}>{q.sub}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Register link */}
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <p style={{ fontSize: 13, color: dk ? "#52525b" : "#a1a1aa", margin: 0 }}>
              Don&apos;t have an account?{" "}
              <a href="/register" style={{
                color: "#06b6d4", textDecoration: "none", fontWeight: 600,
                borderBottom: "1px solid transparent",
                transition: "border-color 0.15s",
              }}>Create workspace</a>
            </p>
          </div>

          {/* Trust signals */}
          <div className="login-trust-badges" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 28,
            padding: "14px 0", borderTop: `1px solid ${dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
          }}>
            {[
              { icon: <Lock size={12} />, text: "256-bit SSL" },
              { icon: <Fingerprint size={12} />, text: "SOC 2" },
              { icon: <Shield size={12} />, text: "GDPR" },
            ].map((t, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, color: dk ? "#3f3f46" : "#a1a1aa", fontWeight: 500,
              }}>
                {t.icon} {t.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForgotNotice && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(9, 9, 11, 0.8)",
          backdropFilter: "blur(8px)",
          zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            maxWidth: 440, width: "100%",
            background: dk ? "rgba(20, 20, 25, 0.9)" : "#ffffff",
            border: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
            position: "relative",
            textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center"
          }}>
            {forgotSuccess ? (
              <>
                {/* Success Icon */}
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#10b981", marginBottom: 20,
                  boxShadow: "0 8px 24px rgba(16, 185, 129, 0.15)"
                }}>
                  <CheckCircle size={24} />
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: 20, fontWeight: 800,
                  color: dk ? "#f8fafc" : "#0f172a",
                  marginBottom: 12,
                  letterSpacing: "-0.02em"
                }}>
                  Check Your Inbox
                </h3>

                {/* Message */}
                <p style={{
                  fontSize: 14, lineHeight: 1.6,
                  color: dk ? "#a1a1aa" : "#4b5563",
                  marginBottom: 24,
                  textAlign: "center"
                }}>
                  If <strong style={{ color: "#06b6d4" }}>{forgotEmail}</strong> is registered in our directory, a secure recovery link will be sent shortly. Please check your inbox and spam folder.
                </p>

                {/* Got it button */}
                <button type="button" onClick={() => {
                  setShowForgotNotice(false);
                  setForgotSuccess(false);
                  setForgotEmail("");
                  setForgotError("");
                }} style={{
                  width: "100%", padding: "12px 20px", borderRadius: 10,
                  border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                  boxShadow: "0 4px 16px rgba(16,185,129,0.25)",
                  transition: "all 0.2s ease"
                }}>
                  Got it, thanks!
                </button>
              </>
            ) : (
              <>
                {/* Recovery Icon */}
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", marginBottom: 20,
                  boxShadow: "0 8px 24px rgba(6,182,212,0.3)"
                }}>
                  <Lock size={24} />
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: 20, fontWeight: 800,
                  color: dk ? "#f8fafc" : "#0f172a",
                  marginBottom: 12,
                  letterSpacing: "-0.02em"
                }}>
                  Password Recovery
                </h3>

                {/* Message */}
                <p style={{
                  fontSize: 14, lineHeight: 1.6,
                  color: dk ? "#a1a1aa" : "#4b5563",
                  marginBottom: 20,
                  textAlign: "center"
                }}>
                  Enter the email associated with your directory account and we will dispatch a secure recovery link.
                </p>

                {forgotError && (
                  <div style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "#f87171",
                    fontSize: 12,
                    marginBottom: 16,
                    textAlign: "center"
                  }}>
                    ⚠️ {forgotError}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleForgotPassword} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: dk ? "#94a3b8" : "#4b5563" }}>Email Address</label>
                    <input
                      required
                      type="email"
                      placeholder="e.g. admin@acme.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        border: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
                        color: dk ? "#f8fafc" : "#0f172a",
                        fontSize: 13,
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                      className="focus-glow"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      width: "100%",
                      padding: "12px 20px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      boxShadow: "0 4px 16px rgba(6,182,212,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      opacity: forgotLoading ? 0.7 : 1
                    }}
                  >
                    {forgotLoading ? (
                      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      "Send Recovery Link"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotNotice(false);
                      setForgotError("");
                      setForgotEmail("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: dk ? "#94a3b8" : "#4b5563",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: 500,
                      marginTop: 4,
                      fontFamily: "inherit"
                    }}
                  >
                    Back to Sign In
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); }  }
        @media (max-width: 900px) {
          .login-hero { display: none !important; }
          .login-form-panel { flex: 1 1 100% !important; }
          .login-mobile-brand { display: block !important; }
        }
        @media (max-width: 600px) {
          .login-form-panel { padding: 24px 20px !important; }
          .login-form-card { padding: 24px 20px !important; border-radius: 14px !important; }
          .login-form-card h1 { font-size: 22px !important; }
          .login-demo-grid { grid-template-columns: 1fr !important; }
          .login-trust-badges { flex-direction: column !important; gap: 6px !important; }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b" }}>
        <Loader2 size={24} style={{ color: "#94a3b8", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
