"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoIcon } from "@/components/Logo";
import {
  Shield, ArrowRight, CheckCircle2, Loader2, Building2, Mail, Lock, User,
  Eye, EyeOff, AlertCircle, Info, XCircle, ArrowLeft, Zap
} from "lucide-react";
import { trackEvent } from "@/components/Analytics";

const GOOGLE_ICON = <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
const MS_ICON = <svg width="18" height="18" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>;

// ─── Password Strength ─────────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string; tips: string[] } {
  const tips: string[] = [];
  let score = 0;
  if (pw.length >= 8) score++; else tips.push("At least 8 characters");
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++; else tips.push("Add an uppercase letter");
  if (/[a-z]/.test(pw)) score++; else tips.push("Add a lowercase letter");
  if (/[0-9]/.test(pw)) score++; else tips.push("Add a number");
  if (/[^A-Za-z0-9]/.test(pw)) score++; else tips.push("Add a special character (!@#$)");
  if (score <= 2) return { score, label: "Weak", color: "#ef4444", tips };
  if (score <= 4) return { score, label: "Fair", color: "#f59e0b", tips };
  return { score, label: "Strong", color: "#10b981", tips };
}

// ─── Validation ─────────────────────────────────────────────────
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validateCompany(name: string): string | null {
  if (name.length < 2) return "Company name must be at least 2 characters";
  if (name.length > 100) return "Company name must be under 100 characters";
  return null;
}
function validateName(name: string): string | null {
  if (name.trim().length < 2) return "Please enter your full name";
  if (!/\s/.test(name.trim())) return "Please enter both first and last name";
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ company: "", name: "", email: "", password: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [oauthProviders] = useState<{ google: boolean; microsoft: boolean }>({ google: true, microsoft: true });
  const [signupDisabled, setSignupDisabled] = useState<boolean | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
  const pwStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  useEffect(() => {
    fetch(`${API}/product-licenses/deployment`)
      .then((r) => r.json())
      .then((d) => {
        const disabled = !!d.publicSignupDisabled || d.deploymentMode === "onprem";
        setSignupDisabled(disabled);
      })
      .catch(() => setSignupDisabled(false));
  }, [API]);

  const errors = useMemo(() => ({
    company: touched.company ? validateCompany(form.company) : null,
    name: touched.name ? validateName(form.name) : null,
    email: touched.email && form.email && !validateEmail(form.email) ? "Please enter a valid email address" : null,
    password: touched.password && form.password.length > 0 && form.password.length < 8 ? "Password must be at least 8 characters" : null,
    confirmPassword: touched.confirmPassword && form.confirmPassword && form.password !== form.confirmPassword ? "Passwords do not match" : null,
  }), [form, touched]);

  const canSubmit = form.company.length >= 2 && form.name.trim().length >= 2 &&
    validateEmail(form.email) && form.password.length >= 8 &&
    form.password === form.confirmPassword && acceptedTerms && !loading;

  if (signupDisabled === true) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg-base)" }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <LogoIcon size={60} />
          <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 16, color: "var(--text-primary)" }}>Registration disabled</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
            This deployment does not allow public self-signup. Contact your administrator for an account, or sign in if you already have one.
          </p>
          <button
            onClick={() => router.push("/login")}
            style={{ marginTop: 20, padding: "10px 18px", borderRadius: 8, border: "none", background: "#06b6d4", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); setError(""); }
  function touch(field: string) { setTouched(t => ({ ...t, [field]: true })); }

  // Field-level validation (hooks above)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Mark all fields as touched
    setTouched({ company: true, name: true, email: true, password: true, confirmPassword: true });

    if (!validateEmail(form.email)) { setError("Please enter a valid email address"); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (pwStrength.score <= 2) { setError("Password is too weak. Add uppercase, numbers, or special characters."); return; }

    setLoading(true); setError("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: form.company.trim(), fullName: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      trackEvent("register_submit", { source: "register_form" });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === "AbortError") setError("Request timed out. Please check your connection and try again.");
        else setError(err.message);
      } else { setError("An unexpected error occurred"); }
    } finally { setLoading(false); }
  }

  const bg = "#09090b", card = "rgba(24,24,27,0.8)", border = "rgba(63,63,70,0.3)", muted = "#94a3b8";

  // ─── Success State ────────────────────────────────────────────
  if (success) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 440, padding: 40 }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(6,182,212,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#06b6d4" }}><Mail size={36} /></div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", marginBottom: 8, letterSpacing: "-0.03em" }}>Check Your Email</h1>
        <p style={{ fontSize: 14, color: muted, lineHeight: 1.7, marginBottom: 8, letterSpacing: "-0.01em" }}>We&apos;ve sent a verification link to <strong style={{ color: "#06b6d4" }}>{form.email}</strong></p>
        <p style={{ fontSize: 12, color: "rgba(148,163,184,0.6)", marginBottom: 24 }}>Click the link in the email to verify your account and start managing your IT assets.</p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/login")} style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            Go to Sign In <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ marginTop: 28, padding: "14px 18px", borderRadius: 10, background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", textAlign: "left" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#06b6d4", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Zap size={13} /> Quick Start</p>
          <ol style={{ fontSize: 12, color: muted, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
            <li>Sign in with your credentials</li>
            <li>Go to <strong style={{ color: "#cbd5e1" }}>Discovery</strong> → run your first network scan</li>
            <li>Review discovered devices and approve them as managed assets</li>
          </ol>
        </div>
      </div>
    </div>
  );

  // ─── Registration Form ────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif", padding: 20 }}>

      <div style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div onClick={() => router.push("/")} style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 18 }} title="Back to homepage">
            <LogoIcon size={44} />
            <span style={{ fontSize: 24, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-0.04em", fontFamily: "'Outfit', 'Inter', sans-serif", background: "linear-gradient(to right, #f1f5f9 65%, #22d3ee 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>QS Asset</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 6, letterSpacing: "-0.03em" }}>Create Your Workspace</h1>
          <p style={{ fontSize: 13, color: muted, letterSpacing: "-0.01em" }}>Free plan includes 5 assets and 4 users • <a href="/contact" style={{ color: "#06b6d4", textDecoration: "none", fontWeight: 600 }} title="Contact us for enterprise pricing">Need more?</a></p>
        </div>

        {/* OAuth Quick Signup */}
        {(oauthProviders.google || oauthProviders.microsoft) && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {oauthProviders.google && (
                <a href={`${API}/auth/google`} style={{
                  flex: 1, padding: "12px 16px", borderRadius: 10, textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  background: card, border: `1px solid ${border}`,
                  fontSize: 13, fontWeight: 600, color: "#e4e4e7",
                  fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s",
                }}>
                  {GOOGLE_ICON}
                  Sign up with Google
                </a>
              )}
              {oauthProviders.microsoft && (
                <a href={`${API}/auth/microsoft`} style={{
                  flex: 1, padding: "12px 16px", borderRadius: 10, textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  background: card, border: `1px solid ${border}`,
                  fontSize: 13, fontWeight: 600, color: "#e4e4e7",
                  fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s",
                }}>
                  {MS_ICON}
                  Sign up with Microsoft
                </a>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(63,63,70,0.3)" }} />
              <span style={{ fontSize: 11, color: muted, fontWeight: 500, letterSpacing: "0.02em" }}>OR REGISTER WITH EMAIL</span>
              <div style={{ flex: 1, height: 1, background: "rgba(63,63,70,0.3)" }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ background: card, backdropFilter: "blur(20px)", border: `1px solid ${border}`, borderRadius: 18, padding: 30 }}>
          {/* Error Banner */}
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12, fontWeight: 500, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <XCircle size={15} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          {/* Company Name */}
          <FormField icon={<Building2 size={16} />} label="Company Name" value={form.company}
            onChange={v => update("company", v)} onBlur={() => touch("company")}
            placeholder="Acme Corp" required error={errors.company}
            tooltip="Your organization name. This will be your workspace name." />

          {/* Full Name */}
          <FormField icon={<User size={16} />} label="Your Full Name" value={form.name}
            onChange={v => update("name", v)} onBlur={() => touch("name")}
            placeholder="Jane Smith" required error={errors.name}
            tooltip="First and last name. You'll be the admin of this workspace." />

          {/* Email */}
          <FormField icon={<Mail size={16} />} label="Work Email" value={form.email}
            onChange={v => update("email", v)} onBlur={() => touch("email")}
            placeholder="jane@acme.com" type="email" required error={errors.email}
            tooltip="Use your work email. This will be your login credential." />

          {/* Password with strength meter */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 5 }}>
              Password
              <span title="Use a mix of uppercase, lowercase, numbers, and special characters" style={{ cursor: "help", color: muted }}><Info size={12} /></span>
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: muted }} />
              <input type={showPw ? "text" : "password"} value={form.password}
                onChange={e => update("password", e.target.value)} onBlur={() => touch("password")}
                placeholder="Min 8 characters" required minLength={8}
                style={{ width: "100%", padding: "10px 40px 10px 36px", borderRadius: 8, border: `1px solid ${errors.password ? "rgba(239,68,68,0.5)" : border}`, background: "rgba(15,23,42,0.5)", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              <button type="button" onClick={() => setShowPw(!showPw)} title={showPw ? "Hide password" : "Show password"}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: muted, cursor: "pointer", padding: 2 }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* Strength Meter */}
            {form.password.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= pwStrength.score ? pwStrength.color : "rgba(255,255,255,0.06)", transition: "background 0.2s" }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: pwStrength.color, fontWeight: 600 }}>{pwStrength.label}</span>
                  {pwStrength.tips.length > 0 && (
                    <span style={{ fontSize: 10, color: muted }}>{pwStrength.tips[0]}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <FormField icon={<Lock size={16} />} label="Confirm Password" value={form.confirmPassword}
            onChange={v => update("confirmPassword", v)} onBlur={() => touch("confirmPassword")}
            placeholder="Repeat password" type="password" required error={errors.confirmPassword} />

          {/* Terms Acceptance */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#06b6d4", marginTop: 2, cursor: "pointer", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
              I agree to the <a href="/terms" target="_blank" style={{ color: "#06b6d4", textDecoration: "underline" }}>Terms of Service</a>,{" "}
              <a href="/privacy" target="_blank" style={{ color: "#06b6d4", textDecoration: "underline" }}>Privacy Policy</a>, and{" "}
              <a href="/cookies" target="_blank" style={{ color: "#06b6d4", textDecoration: "underline" }}>Cookie Policy</a>.
              I consent to the processing of my data as described.
            </span>
          </label>

          {/* Submit */}
          <button type="submit" disabled={!canSubmit}
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: canSubmit ? "linear-gradient(135deg,#06b6d4,#0891b2)" : "rgba(100,116,139,0.2)", color: canSubmit ? "white" : "#64748b", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s", letterSpacing: "-0.01em", fontFamily: "inherit", boxShadow: canSubmit ? "0 4px 16px rgba(6,182,212,0.2)" : "none" }}>
            {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Creating Workspace...</> : <>Create Free Account <ArrowRight size={15} /></>}
          </button>

          {/* Links */}
          <div style={{ textAlign: "center", marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 12, color: muted, margin: 0 }}>
              Already have an account? <a href="/login" style={{ color: "#06b6d4", textDecoration: "none", fontWeight: 600 }}>Sign in</a>
            </p>
            <p style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", margin: 0 }}>
              <a href="/" style={{ color: muted, textDecoration: "none" }}>← Back to homepage</a>
            </p>
          </div>
        </form>

        {/* Legal + Plan Info */}
        <div style={{ textAlign: "center", marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", margin: 0 }}>
            By creating an account you agree to our{" "}
            <a href="/terms" style={{ color: muted, textDecoration: "underline" }}>Terms</a>,{" "}
            <a href="/privacy" style={{ color: muted, textDecoration: "underline" }}>Privacy Policy</a>, and{" "}
            <a href="/cookies" style={{ color: muted, textDecoration: "underline" }}>Cookie Policy</a>
          </p>
          <p style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Lock size={10} /> Your data is encrypted and never shared
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Reusable Field Component ───────────────────────────────────
function FormField({ icon, label, value, onChange, onBlur, placeholder, type = "text", required = false, error, tooltip }: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void;
  onBlur?: () => void; placeholder: string; type?: string; required?: boolean;
  error?: string | null; tooltip?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 5 }}>
        {label}
        {tooltip && <span title={tooltip} style={{ cursor: "help", color: "#94a3b8" }}><Info size={12} /></span>}
      </label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>{icon}</span>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}
          placeholder={placeholder} required={required}
          style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 8, border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(42,49,80,0.5)"}`, background: "rgba(15,23,42,0.5)", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} />
      </div>
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, color: "#ef4444" }}>
          <AlertCircle size={11} /> {error}
        </div>
      )}
    </div>
  );
}
