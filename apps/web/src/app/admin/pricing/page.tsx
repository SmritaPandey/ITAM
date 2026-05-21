"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { DollarSign, Save, RefreshCw, Plus, Trash2, ArrowUpRight, HelpCircle, Check, Percent } from "lucide-react";

interface PlanConfig {
  priceUSD: number;
  priceINR: number;
  discountPercent: number;
  features: string[];
}

interface PricingConfig {
  starter: PlanConfig;
  professional: PlanConfig;
  enterprise: PlanConfig;
  custom: PlanConfig;
}

const DEFAULT_PRICING: PricingConfig = {
  starter: {
    priceUSD: 0,
    priceINR: 0,
    discountPercent: 0,
    features: ["IT Asset Tracking", "4 Users", "Basic Reports", "Email Support", "Community Access"]
  },
  professional: {
    priceUSD: 199,
    priceINR: 16999,
    discountPercent: 50,
    features: ["All 12 Modules", "Unlimited Users", "Vulnerability Scanning", "ITSM + SLA Engine", "Priority Support", "API Access"]
  },
  enterprise: {
    priceUSD: 499,
    priceINR: 39999,
    discountPercent: 50,
    features: ["Everything in Pro", "On-Premise Deploy", "SSO / SAML / LDAP", "Dedicated CSM", "Custom SLA", "White-Label Option"]
  },
  custom: {
    priceUSD: -1,
    priceINR: -1,
    discountPercent: 0,
    features: ["Everything in Enterprise", "Custom asset limits", "Negotiated pricing", "Dedicated account manager", "Custom SLA", "White-label option", "Priority onboarding"]
  }
};

export default function PricingManagerPage() {
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [activePlanTab, setActivePlanTab] = useState<keyof PricingConfig>("professional");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newFeatureText, setNewFeatureText] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    loadPricing();
  }, []);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadPricing() {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/pricing");
      if (data && typeof data === "object" && data.starter) {
        setPricing(data);
      } else {
        setPricing(DEFAULT_PRICING);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to load pricing config", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify(pricing),
      });
      showToast("Pricing config updated successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save pricing config", "error");
    } finally {
      setSaving(false);
    }
  }

  function updatePlanField<K extends keyof PlanConfig>(
    planKey: keyof PricingConfig,
    field: K,
    value: PlanConfig[K]
  ) {
    setPricing((prev) => ({
      ...prev,
      [planKey]: {
        ...prev[planKey],
        [field]: value,
      },
    }));
  }

  function addFeature(planKey: keyof PricingConfig) {
    if (!newFeatureText.trim()) return;
    const plan = pricing[planKey];
    updatePlanField(planKey, "features", [...plan.features, newFeatureText.trim()]);
    setNewFeatureText("");
  }

  function removeFeature(planKey: keyof PricingConfig, index: number) {
    const plan = pricing[planKey];
    const nextFeatures = plan.features.filter((_, i) => i !== index);
    updatePlanField(planKey, "features", nextFeatures);
  }

  // Live calculations for the active plan
  const plan = pricing[activePlanTab];
  const disc = plan.discountPercent || 0;
  
  const calcCyclePrice = (base: number, billingDiscount: number) => {
    if (base < 0) return -1;
    // Apply founders discount, then the cycle billing discount
    const standardPromo = base * (1 - disc / 100);
    const finalPrice = standardPromo * (1 - billingDiscount / 100);
    return Math.round(finalPrice);
  };

  const isLight = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60 }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 1000,
          padding: "12px 20px", borderRadius: 10,
          background: toast.type === "success" ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
          color: "#fff", fontWeight: 600, fontSize: 13,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(8px)",
          animation: "slideIn 0.3s ease",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {toast.type === "success" ? <Check size={16} /> : <HelpCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.025em" }}>
            Pricing Config Manager
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Control dynamic plans, features, USD/INR conversion values, and active founder's discount rates
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadPricing} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 8,
            border: "1px solid var(--border-primary)", background: "rgba(255,255,255,0.03)",
            color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", transition: "all 0.2s",
            fontWeight: 500
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleSave} disabled={saving || loading} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8,
            background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", border: "none",
            color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600,
            boxShadow: "0 4px 14px rgba(6,182,212,0.3)", transition: "all 0.2s"
          }}>
            <Save size={14} /> {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: 350, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-primary)",
        }}>
          <RefreshCw className="animate-spin" size={32} style={{ color: "#06b6d4", marginBottom: 12 }} />
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Fetching system-wide pricing...</span>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 24 }}>
          {/* Main Controls Card */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
            backdropFilter: "blur(12px)",
          }}>
            {/* Tabs Selector */}
            <div style={{
              display: "flex", borderBottom: "1px solid var(--border-primary)",
              paddingBottom: 12, marginBottom: 24, gap: 8
            }}>
              {(["starter", "professional", "enterprise", "custom"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setActivePlanTab(key)}
                  style={{
                    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: activePlanTab === key ? 700 : 500,
                    textTransform: "capitalize",
                    background: activePlanTab === key ? "rgba(6,182,212,0.1)" : "transparent",
                    color: activePlanTab === key ? "#06b6d4" : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}
                >
                  {key} Plan
                </button>
              ))}
            </div>

            {/* Price Inputs Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 28 }}>
              {/* priceUSD */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8, letterSpacing: "0.05em" }}>
                  Original USD Price
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--text-tertiary)" }}>$</span>
                  <input
                    type="number"
                    value={plan.priceUSD}
                    disabled={activePlanTab === "starter"}
                    onChange={(e) => updatePlanField(activePlanTab, "priceUSD", parseFloat(e.target.value) || 0)}
                    style={{
                      width: "100%", padding: "10px 12px 10px 24px", borderRadius: 8,
                      background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)", fontSize: 14, fontWeight: 600, outline: "none",
                      opacity: activePlanTab === "starter" ? 0.6 : 1,
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block", marginTop: 4 }}>
                  {plan.priceUSD < 0 ? "Negative resolves as contact sales" : "Monthly charge amount"}
                </span>
              </div>

              {/* priceINR */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8, letterSpacing: "0.05em" }}>
                  Original INR Price
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--text-tertiary)" }}>₹</span>
                  <input
                    type="number"
                    value={plan.priceINR}
                    disabled={activePlanTab === "starter"}
                    onChange={(e) => updatePlanField(activePlanTab, "priceINR", parseFloat(e.target.value) || 0)}
                    style={{
                      width: "100%", padding: "10px 12px 10px 24px", borderRadius: 8,
                      background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)", fontSize: 14, fontWeight: 600, outline: "none",
                      opacity: activePlanTab === "starter" ? 0.6 : 1,
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block", marginTop: 4 }}>
                  {plan.priceINR < 0 ? "Negative resolves as contact sales" : "Equivalent localized price"}
                </span>
              </div>

              {/* discountPercent */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8, letterSpacing: "0.05em" }}>
                  Active Founder Promo Discount
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={plan.discountPercent}
                    disabled={activePlanTab === "starter" || activePlanTab === "custom"}
                    onChange={(e) => updatePlanField(activePlanTab, "discountPercent", Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    style={{
                      width: "100%", padding: "10px 28px 10px 12px", borderRadius: 8,
                      background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)", fontSize: 14, fontWeight: 600, outline: "none",
                      opacity: (activePlanTab === "starter" || activePlanTab === "custom") ? 0.6 : 1,
                    }}
                  />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--text-tertiary)" }}>%</span>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block", marginTop: 4 }}>
                  Default promo discount rate (e.g. 50)
                </span>
              </div>
            </div>

            {/* Checklist Feature Editor */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                Features Checklist Manager
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400 }}>({plan.features.length} listed)</span>
              </h3>

              {/* Add Input */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Enter a new feature bullet (e.g. Custom SSO Integration)..."
                  value={newFeatureText}
                  onChange={(e) => setNewFeatureText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addFeature(activePlanTab); }}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: 8,
                    background: "rgba(0,0,0,0.12)", border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)", fontSize: 13, outline: "none"
                  }}
                />
                <button
                  onClick={() => addFeature(activePlanTab)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 8,
                    background: "rgba(6,182,212,0.15)", border: "none", color: "#06b6d4",
                    fontSize: 13, cursor: "pointer", fontWeight: 600, transition: "all 0.2s"
                  }}
                >
                  <Plus size={14} /> Add Bullet
                </button>
              </div>

              {/* Features List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto", paddingRight: 6 }}>
                {plan.features.map((feat, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border-primary)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(6,182,212,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#06b6d4" }}>
                        <Check size={8} />
                      </div>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{feat}</span>
                    </div>
                    <button
                      onClick={() => removeFeature(activePlanTab, index)}
                      style={{
                        background: "transparent", border: "none", color: "var(--text-tertiary)",
                        cursor: "pointer", padding: 4, borderRadius: 4, transition: "all 0.15s"
                      }}
                    >
                      <Trash2 size={13} style={{ color: "#ef4444" }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing Preview Right Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Live Pricing Preview Panel */}
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-primary)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              position: "relative",
              overflow: "hidden"
            }}>
              {/* Neon border glow effect */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: "linear-gradient(90deg, #06b6d4, #8b5cf6, #10b981)"
              }} />

              <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                Live Calculations Preview
                <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(16,185,129,0.1)", color: "#10b981", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                  Active
                </span>
              </h2>

              <div style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>
                Active Plan Selected
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#06b6d4", textTransform: "capitalize", marginBottom: 20 }}>
                {activePlanTab} Plan
              </div>

              {plan.priceUSD < 0 ? (
                <div style={{ padding: "30px 12px", textAlign: "center", border: "1px dashed var(--border-primary)", borderRadius: 12 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-secondary)" }}>
                    Contact Sales Model
                  </span>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                    Standard prices disabled; user will be prompted to contact platform founders
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Monthly Row */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Monthly Cycle</span>
                      <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>0% billing disc.</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-primary)" }}>
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>USD / mo</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                          ${calcCyclePrice(plan.priceUSD, 0)}
                          {disc > 0 && <span style={{ fontSize: 10, textDecoration: "line-through", color: "var(--text-tertiary)", fontWeight: 400 }}>${plan.priceUSD}</span>}
                        </div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-primary)" }}>
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>INR / mo</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                          ₹{calcCyclePrice(plan.priceINR, 0).toLocaleString()}
                          {disc > 0 && <span style={{ fontSize: 10, textDecoration: "line-through", color: "var(--text-tertiary)", fontWeight: 400 }}>₹{plan.priceINR.toLocaleString()}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quarterly Row */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Quarterly Cycle</span>
                      <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, background: "rgba(16,185,129,0.1)", padding: "1px 4px", borderRadius: 3 }}>
                        10% cycle disc.
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-primary)" }}>
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>USD / mo</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                          ${calcCyclePrice(plan.priceUSD, 10)}
                          <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 400 }}>(${calcCyclePrice(plan.priceUSD, 10) * 3}/qtr)</span>
                        </div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-primary)" }}>
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>INR / mo</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                          ₹{calcCyclePrice(plan.priceINR, 10).toLocaleString()}
                          <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 400 }}>(₹{(calcCyclePrice(plan.priceINR, 10) * 3).toLocaleString()}/qtr)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Annual Row */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Annual Cycle</span>
                      <span style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, background: "rgba(139,92,246,0.1)", padding: "1px 4px", borderRadius: 3 }}>
                        20% cycle disc.
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-primary)" }}>
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>USD / mo</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#8b5cf6", display: "flex", alignItems: "center", gap: 4 }}>
                          ${calcCyclePrice(plan.priceUSD, 20)}
                          <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 400 }}>(${calcCyclePrice(plan.priceUSD, 20) * 12}/yr)</span>
                        </div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-primary)" }}>
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>INR / mo</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#8b5cf6", display: "flex", alignItems: "center", gap: 4 }}>
                          ₹{calcCyclePrice(plan.priceINR, 20).toLocaleString()}
                          <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 400 }}>(₹{(calcCyclePrice(plan.priceINR, 20) * 12).toLocaleString()}/yr)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Info card */}
            <div style={{
              background: "rgba(255,255,255,0.01)",
              border: "1px dashed var(--border-primary)",
              borderRadius: 16,
              padding: 20,
              fontSize: 12,
              color: "var(--text-tertiary)",
              lineHeight: 1.5,
            }}>
              <h4 style={{ fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Percent size={14} style={{ color: "#06b6d4" }} /> How discounts stack
              </h4>
              <span>
                Standard base values (USD/INR) are first reduced by the Active Founder Promo Discount (e.g. 50%).
                <br /><br />
                When tenants subscribe inside the Billing portal, they also receive compounding discounts for choosing longer terms (10% off for Quarterly, 20% off for Annual billing cycles).
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
