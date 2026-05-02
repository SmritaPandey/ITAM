"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, Loader2, Users, UserCog, Sun, Moon } from "lucide-react";

function decodeJwt(token: string) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch { return null; }
}

const QUICK_LOGINS = [
  { label: "Admin Login", email: "admin@acme.com", icon: <UserCog size={14} />, color: "#06b6d4" },
  { label: "Staff Login", email: "priya@acme.com", icon: <Users size={14} />, color: "#8b5cf6" },
];

export default function LoginPage() {
  const router = useRouter();
  const isDev = process.env.NODE_ENV === 'development';
  const [email, setEmail] = useState(isDev ? "admin@acme.com" : "");
  const [password, setPassword] = useState(isDev ? "Admin@123" : "");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const t = saved || "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1"}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Invalid credentials");
      }
      const data = await res.json();
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      // Decode JWT to get role and route accordingly
      const decoded = decodeJwt(data.accessToken);
      const role = decoded?.role || "";
      localStorage.setItem("userRole", role);
      localStorage.setItem("userEmail", decoded?.email || email);

      if (role === "Employee") {
        router.push("/portal");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const isLight = theme === "light";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: isLight
        ? "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f9ff 100%)"
        : "linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #0d1225 100%)",
      position: "relative",
      overflow: "hidden",
      transition: "background 0.3s ease",
    }}>
      {/* Animated background orbs */}
      <div style={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: isLight
          ? "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)",
        top: "-10%", right: "-5%", animation: "pulse 8s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", width: 400, height: 400, borderRadius: "50%",
        background: isLight
          ? "radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
        bottom: "-10%", left: "-5%", animation: "pulse 10s ease-in-out infinite reverse",
      }} />

      {/* Theme toggle */}
      <button onClick={toggleTheme} style={{
        position: "absolute", top: 20, right: 20, width: 40, height: 40,
        borderRadius: 10, border: "none", cursor: "pointer",
        background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
        color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
      }}>
        {isLight ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <div style={{
        width: "min(420px, 92vw)", padding: "clamp(20px, 5vw, 40px)", borderRadius: 16,
        background: isLight ? "rgba(255, 255, 255, 0.85)" : "rgba(26, 31, 53, 0.7)",
        backdropFilter: "blur(20px)",
        border: isLight ? "1px solid rgba(226, 232, 240, 0.8)" : "1px solid rgba(42, 49, 80, 0.6)",
        boxShadow: isLight
          ? "0 24px 80px rgba(0,0,0,0.08), 0 0 40px rgba(6,182,212,0.03)"
          : "0 24px 80px rgba(0,0,0,0.4), 0 0 40px rgba(6,182,212,0.05)",
        transition: "all 0.3s ease",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/favicon.png" alt="ReconAPM" style={{
            width: 56, height: 56, margin: "0 auto 16px", borderRadius: 14, display: "block",
            boxShadow: isLight ? "0 8px 24px rgba(6,182,212,0.2)" : "0 8px 24px rgba(6,182,212,0.3)",
          }} />
          <h1 style={{
            fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
            background: isLight ? "linear-gradient(135deg, #0e7490, #7c3aed)" : "linear-gradient(135deg, #67e8f9, #a78bfa)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>ReconAPM</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Enterprise IT Asset & Security Management</p>
        </div>

        {/* Quick Login Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {QUICK_LOGINS.map(q => (
            <button key={q.email} type="button" onClick={() => setEmail(q.email)}
              style={{
                padding: "8px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: email === q.email ? `${q.color}15` : isLight ? "rgba(0,0,0,0.03)" : "rgba(30,37,64,0.5)",
                border: email === q.email ? `1px solid ${q.color}40` : `1px solid var(--border-primary)`,
                color: email === q.email ? q.color : "var(--text-secondary)",
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6, transition: "all 0.15s",
              }}>
              {q.icon} {q.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)",
                fontSize: 13, fontFamily: "inherit", outline: "none", transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "#06b6d4"}
              onBlur={e => e.target.style.borderColor = "var(--border-primary)"}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)} required
                style={{
                  width: "100%", padding: "10px 40px 10px 14px", borderRadius: 8,
                  background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)",
                  fontSize: 13, fontFamily: "inherit", outline: "none", transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "#06b6d4"}
                onBlur={e => e.target.style.borderColor = "var(--border-primary)"}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer",
              }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: "8px 12px", borderRadius: 8, marginBottom: 16,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171", fontSize: 12,
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{
            width: "100%", justifyContent: "center", padding: "12px 16px", fontSize: 14,
          }}>
            {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{
          marginTop: 16, padding: "10px 12px", borderRadius: 8,
          background: isLight ? "rgba(6,182,212,0.04)" : "rgba(6,182,212,0.05)",
          border: isLight ? "1px solid rgba(6,182,212,0.08)" : "1px solid rgba(6,182,212,0.1)",
        }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, textAlign: "center" }}>
            <strong style={{ color: "#06b6d4" }}>Admin:</strong> admin@acme.com &nbsp;|&nbsp;
            <strong style={{ color: "#8b5cf6" }}>Staff:</strong> priya@acme.com
            <br />Password: Admin@123
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
