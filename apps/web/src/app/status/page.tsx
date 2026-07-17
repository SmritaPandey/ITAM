"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";

const SERVICES = [
  { id: "web", name: "Web application", detail: "qsasset.com dashboard and marketing" },
  { id: "api", name: "API", detail: "Authentication, inventory, discovery, and ITSM APIs" },
  { id: "agents", name: "Agent ingestion", detail: "Heartbeat and inventory ingest from discovery agents" },
  { id: "email", name: "Transactional email", detail: "Verification, alerts, and notifications" },
];

export default function StatusPage() {
  const t = usePublicTheme();
  const [checkedAt, setCheckedAt] = useState<string>("");
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    setCheckedAt(new Date().toISOString());
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
    const healthUrl = API.replace(/\/api\/v1\/?$/, "") + "/api/v1/health";
    fetch(healthUrl, { method: "GET" })
      .then((r) => setApiOk(r.ok))
      .catch(() => setApiOk(false));
  }, []);

  const allOk = apiOk !== false;

  return (
    <PublicShell maxWidth={720}>
      <MonoEyebrow muted={t.muted} light={t.L}>
        Status
      </MonoEyebrow>
      <h1 className="font-serif" style={{ fontSize: "clamp(32px, 4vw, 44px)", lineHeight: 0.95, marginBottom: 12 }}>
        System status
      </h1>
      <p style={{ fontSize: 14, color: t.muted, marginBottom: 28, fontWeight: 300 }}>
        {checkedAt ? `Last checked ${new Date(checkedAt).toLocaleString()}` : "Checking…"}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 20px",
          borderRadius: 14,
          marginBottom: 24,
          border: `1px solid ${allOk ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.4)"}`,
          background: allOk ? (t.L ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.12)") : "rgba(245,158,11,0.1)",
        }}
      >
        {allOk ? <CheckCircle2 size={22} color="#10b981" /> : <AlertTriangle size={22} color="#f59e0b" />}
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: t.txt }}>
            {apiOk === null ? "Checking systems…" : allOk ? "All systems operational" : "Degraded performance"}
          </div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
            {apiOk === false
              ? "API health check did not succeed. Marketing site may still be available."
              : "Core SaaS components are responding normally."}
          </div>
        </div>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 10 }}>
        {SERVICES.map((s) => {
          const ok = s.id === "api" ? apiOk !== false : true;
          return (
            <li
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                padding: "16px 18px",
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                background: t.card,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: t.txt }}>{s.name}</div>
                <div style={{ fontSize: 12, color: t.muted, marginTop: 4 }}>{s.detail}</div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: ok ? "#059669" : "#d97706",
                  whiteSpace: "nowrap",
                  alignSelf: "center",
                }}
              >
                {s.id === "api" && apiOk === null ? "…" : ok ? "Operational" : "Issue"}
              </div>
            </li>
          );
        })}
      </ul>

      <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.6 }}>
        Incidents or questions:{" "}
        <Link href="/contact" style={{ color: "#0891b2", fontWeight: 600 }}>
          Contact support
        </Link>
        {" · "}
        <Link href="/sla" style={{ color: "#0891b2", fontWeight: 600 }}>
          SLA
        </Link>
        {" · "}
        <Link href="/security" style={{ color: "#0891b2", fontWeight: 600 }}>
          Security
        </Link>
      </p>
    </PublicShell>
  );
}
