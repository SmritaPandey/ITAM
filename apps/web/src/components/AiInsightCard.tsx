'use client';
import { useEffect, useState, useCallback } from 'react';
import { Sparkles, AlertTriangle, Shield, Package, Brain, RefreshCw } from 'lucide-react';
import { safeFetch } from '@/lib/api';

interface AiInsightCardProps {
  title: string;
  type: 'risk' | 'compliance' | 'patches' | 'general';
}

const TYPE_CONFIG: Record<string, { color: string; gradient: string; icon: typeof AlertTriangle }> = {
  risk: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #f97316)', icon: AlertTriangle },
  compliance: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)', icon: Shield },
  patches: { color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', icon: Package },
  general: { color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', icon: Brain },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
  info: '#06b6d4',
};

// Inject shimmer keyframes once
const SHIMMER_INJECTED = typeof document !== 'undefined' && (() => {
  const id = '__ai-insight-shimmer';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes aiShimmer {
        0% { background-position: -200px 0; }
        100% { background-position: calc(200px + 100%) 0; }
      }
      @keyframes aiSpinRefresh {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  return true;
})();

// Suppress unused var
void SHIMMER_INJECTED;

export default function AiInsightCard({ title, type }: AiInsightCardProps) {
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<any>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.general;
  const Icon = config.icon;

  const fetchInsight = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const healthData = await safeFetch<any>('/ai/health');
      const isAvailable = healthData?.available ?? false;
      setAiAvailable(isAvailable);

      if (!isAvailable) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const data = await safeFetch<any>(`/ai/insights/dashboard?type=${type}`);
      setInsight(data);
    } catch {
      setInsight(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  // Shimmer skeleton
  if (loading) {
    const shimmerBg = 'linear-gradient(90deg, var(--bg-tertiary) 25%, rgba(255,255,255,0.05) 50%, var(--bg-tertiary) 75%)';
    return (
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        border: '1px solid var(--border-primary)',
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: config.gradient, opacity: 0.5,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: shimmerBg, backgroundSize: '200px 100%',
            animation: 'aiShimmer 1.5s infinite',
          }} />
          <div style={{
            width: 120, height: 14, borderRadius: 4,
            background: shimmerBg, backgroundSize: '200px 100%',
            animation: 'aiShimmer 1.5s infinite',
          }} />
        </div>
        {[100, 80, 60].map((w, i) => (
          <div key={i} style={{
            width: `${w}%`, height: 10, borderRadius: 4, marginBottom: 8,
            background: shimmerBg, backgroundSize: '200px 100%',
            animation: `aiShimmer 1.5s infinite ${i * 0.15}s`,
          }} />
        ))}
      </div>
    );
  }

  // AI not available
  if (aiAvailable === false) {
    return (
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        border: '1px solid var(--border-primary)',
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
        opacity: 0.7,
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, var(--border-primary), var(--border-secondary))',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Sparkles size={16} style={{ color: 'var(--text-tertiary)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
          Enable AI for intelligent insights. Configure <code style={{
            fontSize: 11, padding: '1px 5px', borderRadius: 3,
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
          }}>AI_ENABLED=true</code> to activate.
        </p>
      </div>
    );
  }

  const severity = insight?.severity || 'info';
  const severityColor = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: 12,
      border: '1px solid var(--border-primary)',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = config.color + '40';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px ${config.color}10`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-primary)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Gradient top border */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: config.gradient,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: config.color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} style={{ color: config.color }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
          <Sparkles size={11} style={{ color: config.color, opacity: 0.6 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {severity && severity !== 'info' && (
            <span style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 6,
              background: severityColor + '18', color: severityColor,
              letterSpacing: '0.5px',
            }}>
              {severity}
            </span>
          )}
          <button
            onClick={() => fetchInsight(true)}
            disabled={refreshing}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              borderRadius: 6, display: 'flex', alignItems: 'center',
              color: 'var(--text-tertiary)', transition: 'color 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'; }}
            title="Refresh insight"
          >
            <RefreshCw
              size={13}
              style={refreshing ? { animation: 'aiSpinRefresh 1s linear infinite' } : {}}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      <p style={{
        fontSize: 12.5, color: 'var(--text-secondary)', margin: 0,
        lineHeight: 1.6, minHeight: 38,
      }}>
        {insight?.summary || insight?.insight || 'Analyzing your data…'}
      </p>

      {/* Metrics row */}
      {insight?.metrics && (
        <div style={{
          display: 'flex', gap: 12, marginTop: 12, paddingTop: 10,
          borderTop: '1px solid var(--border-primary)',
        }}>
          {Object.entries(insight.metrics).slice(0, 3).map(([key, val]) => (
            <div key={key} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2, textTransform: 'capitalize' }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {String(val)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
