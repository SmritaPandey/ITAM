"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import {
  Building2, Users, Package, TrendingUp, MessageSquare, CreditCard,
  ArrowUpRight, ArrowDownRight, Clock,
} from "lucide-react";

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/admin/dashboard").then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading dashboard...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>Failed to load dashboard</div>;

  const kpis = [
    { label: "Total Tenants", value: data.kpis.totalTenants, icon: Building2, color: "#06b6d4", sub: `${data.kpis.activeTenants} active` },
    { label: "Total Users", value: data.kpis.totalUsers, icon: Users, color: "#8b5cf6", sub: "Across all tenants" },
    { label: "Total Assets", value: data.kpis.totalAssets, icon: Package, color: "#10b981", sub: "All categories" },
    { label: "MRR", value: `₹${Number(data.kpis.mrr || 0).toLocaleString()}`, icon: TrendingUp, color: "#f59e0b", sub: "Monthly recurring" },
    { label: "New Signups (7d)", value: data.kpis.newSignups7d, icon: ArrowUpRight, color: "#3b82f6", sub: "Last 7 days" },
    { label: "Pending Support", value: data.kpis.pendingContacts, icon: MessageSquare, color: "#ef4444", sub: "Awaiting reply" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>Platform Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Overview of all tenants, users, revenue, and support requests</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} style={{
              padding: 20, borderRadius: 12,
              background: "var(--bg-card)", border: "1px solid var(--border-primary)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${k.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: k.color }}>
                  <Icon size={18} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>{k.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{k.label}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Two Columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Recent Tenants */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>Recent Signups</h3>
          {data.recentTenants?.length ? data.recentTenants.map((t: any) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-primary)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t.plan} • {t.status}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} /> {new Date(t.createdAt).toLocaleDateString()}
              </div>
            </div>
          )) : <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No recent signups</div>}
        </div>

        {/* Recent Support */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>Recent Support Requests</h3>
          {data.recentContacts?.length ? data.recentContacts.map((c: any) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-primary)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name} — {c.subject}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.email}</div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                background: c.status === "NEW" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                color: c.status === "NEW" ? "#ef4444" : "#10b981",
              }}>{c.status}</span>
            </div>
          )) : <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No recent requests</div>}
        </div>
      </div>

      {/* Plan Distribution */}
      {data.planDistribution?.length > 0 && (
        <div style={{ marginTop: 16, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>Plan Distribution</h3>
          <div style={{ display: "flex", gap: 16 }}>
            {data.planDistribution.map((p: any) => (
              <div key={p.plan} style={{
                flex: 1, textAlign: "center", padding: 16, borderRadius: 10,
                background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#06b6d4" }}>{p.count}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginTop: 4 }}>{p.plan}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
