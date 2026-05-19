"use client";
import { useState, useEffect } from "react";
import { Shield, X } from "lucide-react";

const CONSENT_KEY = "qs_cookie_consent";
const CONSENT_VERSION = "1.0";

interface ConsentState {
  essential: boolean;
  analytics: boolean;
  version: string;
  timestamp: string;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      // Show banner after 1s delay for better UX
      const t = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(t);
    }
    try {
      const consent: ConsentState = JSON.parse(stored);
      if (consent.version !== CONSENT_VERSION) {
        setVisible(true);
      }
    } catch { setVisible(true); }
  }, []);

  function saveConsent(analyticsEnabled: boolean) {
    const consent: ConsentState = {
      essential: true, // always required
      analytics: analyticsEnabled,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    setVisible(false);

    // Log consent choice for compliance records
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
      fetch(`${API}/analytics/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics: analyticsEnabled, version: CONSENT_VERSION }),
      }).catch(() => {}); // Non-blocking
    } catch {}
  }

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10000,
      background: "rgba(10,14,26,0.98)", backdropFilter: "blur(20px)",
      borderTop: "1px solid rgba(42,49,80,0.5)", padding: "16px 24px",
      boxShadow: "0 -8px 30px rgba(0,0,0,0.4)",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Shield size={16} style={{ color: "#06b6d4" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Privacy & Cookies</span>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.6, maxWidth: 700 }}>
              We use essential cookies for authentication and platform functionality. With your consent, we also collect
              anonymous usage analytics to improve QS Asset Management. No data is sold or shared with third parties.
              Read our <a href="/privacy" style={{ color: "#06b6d4", textDecoration: "underline" }}>Privacy Policy</a> and <a href="/cookies" style={{ color: "#06b6d4", textDecoration: "underline" }}>Cookie Policy</a>.
            </p>

            {showDetails && (
              <div style={{ marginTop: 12, padding: 14, background: "rgba(26,31,53,0.6)", borderRadius: 10, border: "1px solid rgba(42,49,80,0.5)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9" }}>Essential Cookies</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>Authentication, security, session management</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#10b981", padding: "2px 8px", borderRadius: 4, background: "rgba(16,185,129,0.1)" }}>Always Active</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9" }}>Analytics</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>Anonymous page views, feature usage, performance metrics</div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                    <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#06b6d4", cursor: "pointer" }} />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <button onClick={() => saveConsent(true)} style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", color: "white",
              fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            }}>Accept All</button>
            <button onClick={() => saveConsent(false)} style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(42,49,80,0.5)",
              background: "transparent", color: "#94a3b8",
              fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
            }}>Essential Only</button>
            <button onClick={() => setShowDetails(!showDetails)} style={{
              padding: "4px 0", background: "none", border: "none",
              color: "#06b6d4", fontSize: 11, cursor: "pointer", textDecoration: "underline",
            }}>{showDetails ? "Hide Details" : "Manage Preferences"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if user consented to analytics tracking.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return false;
    const consent: ConsentState = JSON.parse(stored);
    return consent.analytics === true;
  } catch { return false; }
}
