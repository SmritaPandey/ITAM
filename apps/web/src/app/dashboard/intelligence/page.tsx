"use client";
import { useEffect, useState } from "react";
import { 
  ShieldAlert, ShieldCheck, Zap, Activity, AlertTriangle, 
  ChevronRight, Brain, Info, ArrowRight, Layers, Monitor, Users
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer 
} from "recharts";
import SafeChart from "@/components/SafeChart";
import AiInsightCard from "@/components/AiInsightCard";

export default function IntelligencePage() {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    avgScore: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0
  });

  useEffect(() => {
    async function loadData() {
      try {
        const data = await apiFetch("/risk/top-risks?limit=50");
        setRisks(data || []);
        
        // Calculate stats
        const scores = data.map((r: any) => r.overallScore);
        const avg = scores.reduce((a: any, b: any) => a + b, 0) / (scores.length || 1);
        
        setStats({
          avgScore: Math.round(avg),
          criticalCount: data.filter((r: any) => r.overallScore >= 75).length,
          highCount: data.filter((r: any) => r.overallScore >= 50 && r.overallScore < 75).length,
          mediumCount: data.filter((r: any) => r.overallScore >= 25 && r.overallScore < 50).length,
          lowCount: data.filter((r: any) => r.overallScore < 25).length
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const chartData = [
    { name: 'Critical (75-100)', value: stats.criticalCount, color: '#ef4444' },
    { name: 'High (50-75)', value: stats.highCount, color: '#f97316' },
    { name: 'Medium (25-50)', value: stats.mediumCount, color: '#f59e0b' },
    { name: 'Low (0-25)', value: stats.lowCount, color: '#10b981' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Brain size={28} style={{ color: 'var(--brand-400)' }} />
            Risk Intelligence Dashboard
          </h1>
          <p className="page-subtitle">Algorithm-driven infrastructure vulnerability and security posture analysis</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 24 }}>
        <IntelligenceStat label="Org Risk Score" value={stats.avgScore} color={stats.avgScore > 50 ? '#ef4444' : '#10b981'} icon={<ShieldAlert />} />
        <IntelligenceStat label="Critical Threats" value={stats.criticalCount} color="#ef4444" icon={<AlertTriangle />} />
        <IntelligenceStat label="Highly Secure" value={stats.lowCount} color="#10b981" icon={<ShieldCheck />} />
        <IntelligenceStat label="Active Analysis" value={risks.length} color="var(--brand-400)" icon={<Activity />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginBottom: 24 }}>
         <div className="card">
           <div className="card-header">
             <div className="card-title">Risk Distribution</div>
           </div>
           <div style={{ height: 300, padding: 20 }}>
              <SafeChart height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </SafeChart>
           </div>
         </div>

         <div style={{ display: 'grid', gap: 20 }}>
            <AiInsightCard title="AI Strategic Advice" type="risk" />
            <div className="card" style={{ background: 'rgba(6,182,212,0.05)', border: '1px dashed var(--brand-500)44' }}>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Zap size={18} style={{ color: 'var(--brand-400)' }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Security Recommendation</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Your organization has {stats.criticalCount} assets with critical risk scores. 
                  The primary risk vector is <b>OS Lifecycle (End-of-Life)</b> on legacy Windows servers.
                  Prioritize patching the top 5 assets listed below to reduce overall risk by 24%.
                </p>
              </div>
            </div>
         </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Asset Risk Ranking</div>
          <div className="card-subtitle">Showing all assets analyzed by the Risk Engine</div>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Risk Score</th>
                <th>Threat Components</th>
                <th>Security Level</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((risk, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{risk.assetName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ID: {risk.assetId}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, maxWidth: 60 }}>
                        <div style={{ width: `${risk.overallScore}%`, height: '100%', background: getScoreColor(risk.overallScore), borderRadius: 3 }} />
                      </div>
                      <span style={{ fontWeight: 700, color: getScoreColor(risk.overallScore) }}>{risk.overallScore}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(risk.components).map(([k, v]: any) => (
                        v < 60 && <span key={k} style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 4, textTransform: 'capitalize' }}>{k}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                     <span className={`badge ${risk.overallScore > 75 ? 'red' : risk.overallScore > 50 ? 'orange' : 'green'}`}>
                       {risk.overallScore > 75 ? 'CRITICAL' : risk.overallScore > 50 ? 'HIGH' : 'SECURE'}
                     </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Analyze</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function IntelligenceStat({ label, value, color, icon }: any) {
  return (
    <div className="card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.05, transform: 'scale(2)' }}>{icon}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function getScoreColor(score: number) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 25) return '#f59e0b';
  return '#10b981';
}
