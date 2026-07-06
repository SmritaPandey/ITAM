"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, Zap, ArrowRight, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function TopRiskCard() {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/risk/top-risks?limit=3")
      .then(data => setRisks(data || []))
      .catch(() => setRisks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <Zap className="animate-pulse" size={24} style={{ color: 'var(--brand-500)', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 13 }}>Analyzing infrastructure risk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header" style={{ paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={18} style={{ color: '#ef4444' }} />
          <div>
            <div className="card-title">Predictive Risk Engine</div>
            <div className="card-subtitle">AI-driven vulnerability assessment</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 20px 20px' }}>
        {risks.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', gap: 12 }}>
             <ShieldCheck size={32} style={{ opacity: 0.2 }} />
             <p style={{ fontSize: 13 }}>No critical risks detected</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {risks.map((risk, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                borderLeft: `3px solid ${risk.overallScore > 75 ? '#ef4444' : risk.overallScore > 50 ? '#f59e0b' : '#3b82f6'}`,
                padding: '12px 16px',
                borderRadius: '0 8px 8px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {risk.assetName}
                    <span style={{ 
                      fontSize: 10, padding: '1px 6px', borderRadius: 10, 
                      background: risk.overallScore > 75 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: risk.overallScore > 75 ? '#ef4444' : '#f59e0b'
                    }}>
                      Score: {risk.overallScore}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Threats: {Object.entries(risk.components).filter(([_, s]: any) => s < 50).map(([k]) => k).join(', ') || 'General vulnerability'}
                  </div>
                </div>
                <Link href={`/dashboard/assets/${risk.assetId}`} style={{ color: 'var(--brand-400)' }}>
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.01)' }}>
        <Link href="/dashboard/intelligence" style={{ fontSize: 12, color: 'var(--brand-400)', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          Full Risk Analysis <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
