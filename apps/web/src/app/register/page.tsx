"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, ArrowRight, CheckCircle2, Loader2, Building2, Mail, Lock, User,
  Eye, EyeOff, AlertCircle, Info, XCircle, ArrowLeft, Zap
} from "lucide-react";

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

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
  const pwStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); setError(""); }
  function touch(field: string) { setTouched(t => ({ ...t, [field]: true })); }

  // Field-level validation
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
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === "AbortError") setError("Request timed out. Please check your connection and try again.");
        else setError(err.message);
      } else { setError("An unexpected error occurred"); }
    } finally { setLoading(false); }
  }

  const bg = "#0a0e1a", card = "rgba(26,31,53,0.7)", border = "rgba(42,49,80,0.5)", muted = "#94a3b8";

  // ─── Success State ────────────────────────────────────────────
  if (success) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 440, padding: 40 }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(6,182,212,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#06b6d4" }}><Mail size={36} /></div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>Check Your Email</h1>
        <p style={{ fontSize: 14, color: muted, lineHeight: 1.7, marginBottom: 8 }}>We&apos;ve sent a verification link to <strong style={{ color: "#06b6d4" }}>{form.email}</strong></p>
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
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", padding: 20 }}>
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(6,182,212,0.06) 0%,transparent 70%)", top: "-10%", right: "15%" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.05) 0%,transparent 70%)", bottom: "-10%", left: "10%" }} />

      <div style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div onClick={() => router.push("/")} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 16 }} title="Back to homepage">
            <Shield size={28} style={{ color: "#06b6d4" }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.03em" }}>QS Asset</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>Create Your Workspace</h1>
          <p style={{ fontSize: 13, color: muted }}>Free plan includes 100 assets and 5 users • <a href="/contact" style={{ color: "#06b6d4", textDecoration: "none" }} title="Contact us for enterprise pricing">Need more?</a></p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: card, backdropFilter: "blur(20px)", border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>
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
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: canSubmit ? "linear-gradient(135deg,#06b6d4,#8b5cf6)" : "rgba(100,116,139,0.3)", color: canSubmit ? "white" : "#64748b", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
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
