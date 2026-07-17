"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { trackEvent } from "@/components/Analytics";
import { FALLBACK_PRICING, PLAN_CARDS, type PlanConfig } from "@/lib/pricing";

export type PricingTheme = {
  L: boolean;
  cardBg: string;
  border: string;
  muted: string;
  txt: string;
  voidBtn: string;
  voidTxt: string;
};

export function PricingGrid({
  theme,
  showHeader = true,
  applyPromo = true,
}: {
  theme: PricingTheme;
  showHeader?: boolean;
  applyPromo?: boolean;
}) {
  const router = useRouter();
  const { L, cardBg, border, muted, txt, voidBtn, voidTxt } = theme;
  const [pricingData, setPricingData] = useState<Record<string, PlanConfig>>(FALLBACK_PRICING);
  const [currency, setCurrency] = useState<"USD" | "INR">("INR");

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
    fetch(`${API_BASE}/settings/pricing`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.starter) setPricingData(d);
      })
      .catch(() => {});
  }, []);

  function onPlanCta(planId: string, isCustom: boolean) {
    if (isCustom) {
      trackEvent("cta_contact_sales", { plan: planId, source: "pricing_grid" });
      router.push("/contact");
      return;
    }
    trackEvent("cta_start_trial", { plan: planId, source: "pricing_grid" });
    router.push("/register");
  }

  return (
    <div>
      {showHeader && (
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="font-mono-label" style={{ fontSize: 11, color: muted, marginBottom: 14 }}>
            Pricing
          </div>
          <h2 className="font-serif" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 0.95, marginBottom: 12 }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontSize: 15, fontWeight: 300, color: muted }}>Start free. Scale when you are ready.</p>
          <div
            style={{
              display: "inline-flex",
              background: L ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",
              borderRadius: 8,
              padding: 3,
              marginTop: 24,
              border: `1px solid ${border}`,
            }}
          >
            {(["USD", "INR"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                style={{
                  padding: "7px 18px",
                  borderRadius: 6,
                  border: "none",
                  background: currency === c ? voidBtn : "transparent",
                  color: currency === c ? voidTxt : muted,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono), monospace",
                  letterSpacing: "0.06em",
                  transition: "all 0.2s ease",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {!showHeader && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              background: L ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",
              borderRadius: 8,
              padding: 3,
              border: `1px solid ${border}`,
            }}
          >
            {(["USD", "INR"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                style={{
                  padding: "7px 18px",
                  borderRadius: 6,
                  border: "none",
                  background: currency === c ? voidBtn : "transparent",
                  color: currency === c ? voidTxt : muted,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono), monospace",
                  letterSpacing: "0.06em",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        id="pricing-grid"
        className="landing-pricing"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "stretch" }}
      >
        {PLAN_CARDS.map((p) => {
          const config = pricingData[p.id] || FALLBACK_PRICING[p.id];
          const isFree = p.id === "starter" || config.priceUSD === 0;
          const isCustom = p.id === "custom" || config.priceUSD < 0;
          const basePrice = currency === "USD" ? config.priceUSD : config.priceINR;
          const discount = applyPromo && config.discountPercent > 0 ? config.discountPercent : 0;
          const finalPrice = basePrice * (1 - discount / 100);
          const symbol = currency === "USD" ? "$" : "₹";
          const locale = currency === "USD" ? "en-US" : "en-IN";

          return (
            <div
              key={p.id}
              style={{
                padding: 28,
                borderRadius: 16,
                background: cardBg,
                border: `1px solid ${p.popular ? (L ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.35)") : border}`,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {p.popular && (
                <div
                  className="font-mono-label"
                  style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "4px 12px",
                    borderRadius: 9999,
                    background: voidBtn,
                    color: voidTxt,
                    fontSize: 10,
                    whiteSpace: "nowrap",
                  }}
                >
                  Most popular
                </div>
              )}
              <div className="font-mono-label" style={{ fontSize: 11, color: muted }}>
                {p.name}
              </div>
              <div>
                {isFree && (
                  <div className="font-serif" style={{ fontSize: 36, lineHeight: 1 }}>
                    Free
                  </div>
                )}
                {isCustom && (
                  <div className="font-serif" style={{ fontSize: 32, lineHeight: 1 }}>
                    Custom
                  </div>
                )}
                {!isFree && !isCustom && (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span className="font-serif" style={{ fontSize: 36, lineHeight: 1 }}>
                        {symbol}
                        {Math.round(finalPrice).toLocaleString(locale)}
                      </span>
                      <span style={{ fontSize: 13, color: muted }}>/mo</span>
                    </div>
                    {discount > 0 && (
                      <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                        <span style={{ textDecoration: "line-through" }}>
                          {symbol}
                          {basePrice.toLocaleString(locale)}
                        </span>
                        <span className="font-mono-label" style={{ marginLeft: 8, fontSize: 10, color: "#10b981" }}>
                          Save {discount}%
                        </span>
                      </div>
                    )}
                  </>
                )}
                <p style={{ fontSize: 13, color: muted, marginTop: 8, fontWeight: 300 }}>
                  {p.desc}
                </p>
              </div>
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 14, flex: 1 }}>
                {config.features.map((f) => (
                  <div
                    key={f}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13, color: txt }}
                  >
                    <Check size={14} color="#10b981" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onPlanCta(p.id, isCustom)}
                style={{
                  marginTop: "auto",
                  padding: "12px 0",
                  borderRadius: 8,
                  border: p.popular ? "none" : `1px solid ${border}`,
                  background: p.popular ? voidBtn : "transparent",
                  color: p.popular ? voidTxt : txt,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "opacity 0.2s ease",
                }}
              >
                {p.cta}
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 960px) {
          .landing-pricing { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .landing-pricing { grid-template-columns: 1fr !important; max-width: 400px; margin: 0 auto; }
        }
      `}</style>
    </div>
  );
}
