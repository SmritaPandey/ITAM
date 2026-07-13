"use client";
import { useEffect, useState } from "react";
import { BadgePercent, TrendingDown, ArrowRight, DollarSign, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function LicenseOptimizationCard() {
  const [optimizations, setOptimizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/software/utilization")
      .then(data => {
        // Find under-utilized software
        const underUtilized = (data || [])
          .filter((s: any) => s.status === 'UNDER_UTILIZED')
          .sort((a: any, b: any) => a.utilizationPercent - b.utilizationPercent)
          .slice(0, 3);
        setOptimizations(underUtilized);
      })
      .catch(() => setOptimizations([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <Wallet className="animate-pulse" size={24} style={{ color: 'var(--brand-500)', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 13 }}>Finding cost savings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header" style={{ paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BadgePercent size={18} style={{ color: '#10b981' }} />
          <div>
            <div className="card-title">Cost Optimization</div>
            <div className="card-subtitle">Under-utilized license detection</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px' }}>
        {optimizations.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', gap: 12 }}>
             <DollarSign size={32} style={{ opacity: 0.2 }} />
             <p style={{ fontSize: 13 }}>Licenses are highly optimized</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {optimizations.map((sw, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '12px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {sw.name}
                    <span style={{ 
                      fontSize: 11, fontWeight: 500, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4
                    }}>
                      <TrendingDown size={12} /> {sw.utilizationPercent}% Utilized
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {sw.totalLicensedSeats - sw.actualInstallations} unused seats — potential for reclamation.
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.01)' }}>
        <Link href="/dashboard/licenses" style={{ fontSize: 12, color: 'var(--brand-400)', textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
          Full Optimization Report <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
