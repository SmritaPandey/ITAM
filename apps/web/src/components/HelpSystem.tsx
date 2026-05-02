"use client";
import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Contextual tooltip that appears on hover/click next to feature labels.
 * Usage: <Tip text="This feature does X" />
 */
export function Tip({ text, size = 14 }: { text: string; size?: number }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [show]);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", marginLeft: 4 }}>
      <HelpCircle
        size={size}
        style={{ color: "var(--text-tertiary)", cursor: "pointer", opacity: 0.6, transition: "opacity 0.2s" }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
      />
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "var(--bg-card)", border: "1px solid var(--border-primary)",
          borderRadius: 8, padding: "8px 12px", fontSize: 11, lineHeight: 1.5,
          color: "var(--text-secondary)", whiteSpace: "normal", width: 240,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 9999,
          animation: "tipFadeIn 0.15s ease-out",
        }}>
          {text}
          <div style={{
            position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)",
            width: 10, height: 10, background: "var(--bg-card)",
            borderRight: "1px solid var(--border-primary)", borderBottom: "1px solid var(--border-primary)",
          }} />
        </div>
      )}
      <style>{`@keyframes tipFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
    </span>
  );
}

/**
 * Page-level help banner shown at the top of a page.
 * Dismissible and remembers dismissal in localStorage.
 */
export function PageHelp({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const key = `help-dismissed-${id}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(key) === "true");
  }, [key]);

  if (dismissed) return null;

  return (
    <div style={{
      background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
      borderRadius: 10, padding: "12px 16px", marginBottom: 16,
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <HelpCircle size={18} style={{ color: "var(--brand-400)", marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{children}</div>
      </div>
      <button
        onClick={() => { localStorage.setItem(key, "true"); setDismissed(true); }}
        style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}
      >✕</button>
    </div>
  );
}

/**
 * Quick-start guide shown on first visit to the dashboard.
 * Renders a step-by-step walkthrough with checkable items.
 */
export function QuickStart() {
  const [dismissed, setDismissed] = useState(true);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDismissed(localStorage.getItem("quickstart-dismissed") === "true");
    try {
      setChecks(JSON.parse(localStorage.getItem("quickstart-checks") || "{}"));
    } catch {}
  }, []);

  if (dismissed) return null;

  const steps = [
    { id: "scan", label: "Run your first network scan", desc: "Go to Discovery → New Scan → enter your subnet" },
    { id: "approve", label: "Approve discovered devices", desc: "Review scan results and approve devices as managed assets" },
    { id: "agent", label: "Deploy agents to staff machines", desc: "Share the agent/ folder — staff run it to report system info" },
    { id: "ticket", label: "Create a test ticket", desc: "Go to Tickets → Create Ticket to test the helpdesk workflow" },
    { id: "user", label: "Invite a team member", desc: "Go to Users → Add User to invite colleagues" },
  ];

  const toggleCheck = (id: string) => {
    const next = { ...checks, [id]: !checks[id] };
    setChecks(next);
    localStorage.setItem("quickstart-checks", JSON.stringify(next));
  };

  const completed = Object.values(checks).filter(Boolean).length;

  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--brand-400)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>🚀 Quick Start Guide</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{completed}/{steps.length} steps completed</div>
        </div>
        <button
          onClick={() => { localStorage.setItem("quickstart-dismissed", "true"); setDismissed(true); }}
          className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }}
        >Dismiss</button>
      </div>
      <div style={{ width: "100%", height: 4, background: "var(--bg-elevated)", borderRadius: 2, marginBottom: 12 }}>
        <div style={{ width: `${(completed / steps.length) * 100}%`, height: "100%", background: "var(--brand-400)", borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {steps.map(step => (
          <div
            key={step.id}
            onClick={() => toggleCheck(step.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              borderRadius: 6, cursor: "pointer",
              background: checks[step.id] ? "rgba(16,185,129,0.06)" : "transparent",
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              border: checks[step.id] ? "none" : "2px solid var(--border-primary)",
              background: checks[step.id] ? "#10b981" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 12, fontWeight: 700,
            }}>{checks[step.id] ? "✓" : ""}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: checks[step.id] ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: checks[step.id] ? "line-through" : "none" }}>{step.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
