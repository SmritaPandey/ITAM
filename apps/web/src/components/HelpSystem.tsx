"use client";
import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import {
  HelpCircle, ChevronRight, ChevronLeft, X, Play, CheckCircle2,
  Lightbulb, Keyboard, Zap, ExternalLink, Sparkles, ArrowRight,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   1. TOOLTIP — Contextual help that appears on hover/click
   ═══════════════════════════════════════════════════════════════ */
export function Tip({ text, size = 14, position = "top" }: {
  text: string; size?: number; position?: "top" | "bottom" | "left" | "right";
}) {
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

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
  };

  const arrowStyles: Record<string, React.CSSProperties> = {
    top: { bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)", borderRight: "1px solid var(--border-primary)", borderBottom: "1px solid var(--border-primary)" },
    bottom: { top: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)", borderLeft: "1px solid var(--border-primary)", borderTop: "1px solid var(--border-primary)" },
    left: { right: -5, top: "50%", transform: "translateY(-50%) rotate(45deg)", borderTop: "1px solid var(--border-primary)", borderRight: "1px solid var(--border-primary)" },
    right: { left: -5, top: "50%", transform: "translateY(-50%) rotate(45deg)", borderBottom: "1px solid var(--border-primary)", borderLeft: "1px solid var(--border-primary)" },
  };

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", marginLeft: 4 }}>
      <HelpCircle
        size={size}
        style={{ color: "var(--text-tertiary)", cursor: "pointer", opacity: 0.5, transition: "all 0.2s" }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
      />
      {show && (
        <div style={{
          position: "absolute", ...positionStyles[position],
          background: "var(--bg-card)", border: "1px solid var(--border-primary)",
          borderRadius: 10, padding: "10px 14px", fontSize: 11.5, lineHeight: 1.6,
          color: "var(--text-secondary)", whiteSpace: "normal", width: 260,
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)", zIndex: 9999,
          animation: "tipFadeIn 0.15s ease-out",
          backdropFilter: "blur(16px)",
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <Lightbulb size={12} style={{ color: "var(--brand-400)", marginTop: 2, flexShrink: 0 }} />
            <span>{text}</span>
          </div>
          <div style={{
            position: "absolute", ...arrowStyles[position],
            width: 10, height: 10, background: "var(--bg-card)",
          }} />
        </div>
      )}
      <style>{`@keyframes tipFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
    </span>
  );
}


/* ═══════════════════════════════════════════════════════════════
   2. PAGE HELP — Dismissible contextual banner per page
   ═══════════════════════════════════════════════════════════════ */
export function PageHelp({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const key = `help-dismissed-${id}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(key) === "true");
  }, [key]);

  if (dismissed) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(139,92,246,0.06) 100%)",
      border: "1px solid rgba(6,182,212,0.15)",
      borderRadius: 12, padding: "14px 18px", marginBottom: 16,
      display: "flex", gap: 12, alignItems: "flex-start",
      animation: "helpSlideDown 0.3s ease-out",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: "rgba(6,182,212,0.1)", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <Lightbulb size={16} style={{ color: "var(--brand-400)" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>{children}</div>
      </div>
      <button
        onClick={() => { localStorage.setItem(key, "true"); setDismissed(true); }}
        style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1, borderRadius: 4 }}
      >✕</button>
      <style>{`@keyframes helpSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   3. KEYBOARD SHORTCUT HINT — Floating badge
   ═══════════════════════════════════════════════════════════════ */
export function KbdHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 11, color: "var(--text-tertiary)",
    }}>
      <kbd style={{
        padding: "2px 6px", borderRadius: 4, fontSize: 10,
        background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
        fontFamily: "inherit", color: "var(--text-secondary)",
      }}>{keys}</kbd>
      {label}
    </span>
  );
}


/* ═══════════════════════════════════════════════════════════════
   4. QUICK START GUIDE — Dashboard onboarding checklist
   ═══════════════════════════════════════════════════════════════ */
export function QuickStart() {
  const router = useRouter();
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
    { id: "scan", label: "Run your first network scan", desc: "Go to Discovery → New Scan → enter your subnet", href: "/dashboard/discovery" },
    { id: "approve", label: "Approve discovered devices", desc: "Review scan results and approve devices as managed assets", href: "/dashboard/discovery" },
    { id: "agent", label: "Deploy agents to staff machines", desc: "Share the agent/ folder — staff run it to report system info", href: "/dashboard/discovery" },
    { id: "ticket", label: "Create a test ticket", desc: "Go to Tickets → Create Ticket to test the helpdesk workflow", href: "/dashboard/tickets" },
    { id: "user", label: "Invite a team member", desc: "Go to Users → Add User to invite colleagues", href: "/dashboard/users" },
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
          <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={16} style={{ color: "var(--brand-400)" }} /> Quick Start Guide
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{completed}/{steps.length} steps completed</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => { localStorage.setItem("quickstart-dismissed", "true"); setDismissed(true); }}
            className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }}
          >Dismiss</button>
        </div>
      </div>
      <div style={{ width: "100%", height: 4, background: "var(--bg-elevated)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ width: `${(completed / steps.length) * 100}%`, height: "100%", background: "linear-gradient(90deg, var(--brand-400), var(--accent-500))", borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {steps.map(step => (
          <div
            key={step.id}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              borderRadius: 8, cursor: "pointer", transition: "background 0.15s",
              background: checks[step.id] ? "rgba(16,185,129,0.06)" : "transparent",
            }}
            onMouseEnter={e => { if (!checks[step.id]) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = checks[step.id] ? "rgba(16,185,129,0.06)" : "transparent"; }}
          >
            <div
              onClick={(e) => { e.stopPropagation(); toggleCheck(step.id); }}
              style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                border: checks[step.id] ? "none" : "2px solid var(--border-primary)",
                background: checks[step.id] ? "#10b981" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 12, fontWeight: 700, transition: "all 0.2s",
              }}>{checks[step.id] ? "✓" : ""}</div>
            <div style={{ flex: 1 }} onClick={() => router.push(step.href)}>
              <div style={{
                fontSize: 12.5, fontWeight: 600,
                color: checks[step.id] ? "var(--text-tertiary)" : "var(--text-primary)",
                textDecoration: checks[step.id] ? "line-through" : "none",
              }}>{step.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{step.desc}</div>
            </div>
            {!checks[step.id] && (
              <ArrowRight size={14} style={{ color: "var(--text-tertiary)", opacity: 0.4 }}
                onClick={(e) => { e.stopPropagation(); router.push(step.href); }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   5. INTERACTIVE WALKTHROUGH — Spotlight-style guided tour
   ═══════════════════════════════════════════════════════════════ */

export interface WalkthroughStep {
  /** CSS selector for the target element to spotlight */
  target: string;
  /** Title of this step */
  title: string;
  /** Description / instruction */
  content: string;
  /** Position of the tooltip relative to the target */
  position?: "top" | "bottom" | "left" | "right";
  /** Optional action label */
  action?: string;
  /** Optional link to navigate to */
  href?: string;
}

interface WalkthroughContextType {
  startWalkthrough: (steps: WalkthroughStep[], id?: string) => void;
  isActive: boolean;
}

const WalkthroughContext = createContext<WalkthroughContextType>({
  startWalkthrough: () => {},
  isActive: false,
});

export const useWalkthrough = () => useContext(WalkthroughContext);

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [steps, setSteps] = useState<WalkthroughStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [active, setActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [walkthroughId, setWalkthroughId] = useState("");

  const updateTargetRect = useCallback(() => {
    if (!active || !steps[currentStep]) return;
    const el = document.querySelector(steps[currentStep].target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setTargetRect(null);
    }
  }, [active, currentStep, steps]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect);
    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect);
    };
  }, [updateTargetRect]);

  const startWalkthrough = useCallback((newSteps: WalkthroughStep[], id?: string) => {
    if (id) {
      const completedKey = `walkthrough-${id}-completed`;
      // Don't auto-restart completed walkthroughs (but allow manual restart)
      setWalkthroughId(id);
    }
    setSteps(newSteps);
    setCurrentStep(0);
    setActive(true);
  }, []);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      if (steps[currentStep + 1].href) {
        router.push(steps[currentStep + 1].href!);
        setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 500);
      } else {
        setCurrentStep(prev => prev + 1);
      }
    } else {
      endWalkthrough();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const endWalkthrough = () => {
    setActive(false);
    setSteps([]);
    setCurrentStep(0);
    setTargetRect(null);
    if (walkthroughId) {
      localStorage.setItem(`walkthrough-${walkthroughId}-completed`, "true");
    }
  };

  const step = steps[currentStep];
  const pos = step?.position || "bottom";

  // Calculate tooltip position
  let tooltipStyle: React.CSSProperties = {};
  if (targetRect) {
    const pad = 16;
    const tooltipW = 360;
    if (pos === "bottom") {
      tooltipStyle = { top: targetRect.bottom + pad, left: Math.max(pad, Math.min(targetRect.left + targetRect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - pad)) };
    } else if (pos === "top") {
      tooltipStyle = { bottom: window.innerHeight - targetRect.top + pad, left: Math.max(pad, Math.min(targetRect.left + targetRect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - pad)) };
    } else if (pos === "right") {
      tooltipStyle = { top: targetRect.top + targetRect.height / 2 - 60, left: targetRect.right + pad };
    } else {
      tooltipStyle = { top: targetRect.top + targetRect.height / 2 - 60, right: window.innerWidth - targetRect.left + pad };
    }
  }

  return (
    <WalkthroughContext.Provider value={{ startWalkthrough, isActive: active }}>
      {children}
      {active && step && (
        <>
          {/* Overlay with spotlight cutout */}
          <div style={{
            position: "fixed", inset: 0, zIndex: 10000,
            pointerEvents: "none",
          }}>
            {/* Dark overlay SVG with cutout */}
            <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
              <defs>
                <mask id="walkthrough-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {targetRect && (
                    <rect
                      x={targetRect.left - 6}
                      y={targetRect.top - 6}
                      width={targetRect.width + 12}
                      height={targetRect.height + 12}
                      rx="10"
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#walkthrough-mask)" />
            </svg>

            {/* Spotlight ring */}
            {targetRect && (
              <div style={{
                position: "absolute",
                left: targetRect.left - 6,
                top: targetRect.top - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                borderRadius: 10,
                border: "2px solid var(--brand-400)",
                boxShadow: "0 0 0 4px rgba(6,182,212,0.15), 0 0 20px rgba(6,182,212,0.2)",
                pointerEvents: "none",
                animation: "spotlightPulse 2s ease-in-out infinite",
              }} />
            )}

            {/* Tooltip card */}
            <div style={{
              position: "fixed", ...tooltipStyle,
              width: 360, pointerEvents: "auto",
              background: "var(--bg-card)", border: "1px solid var(--border-primary)",
              borderRadius: 14, padding: 0, overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              animation: "tooltipSlideIn 0.25s ease-out",
              zIndex: 10001,
            }}>
              {/* Header */}
              <div style={{
                padding: "14px 18px 10px",
                background: "linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(139,92,246,0.08) 100%)",
                borderBottom: "1px solid var(--border-primary)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "linear-gradient(135deg, var(--brand-400), var(--accent-500))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 12, fontWeight: 800,
                  }}>{currentStep + 1}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{step.title}</div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Step {currentStep + 1} of {steps.length}</div>
                  </div>
                </div>
                <button onClick={endWalkthrough} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-tertiary)", padding: 4, borderRadius: 6,
                }}>
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: "14px 18px" }}>
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
                  {step.content}
                </p>
              </div>

              {/* Progress + Nav */}
              <div style={{
                padding: "10px 18px 14px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                {/* Progress dots */}
                <div style={{ display: "flex", gap: 4 }}>
                  {steps.map((_, i) => (
                    <div key={i} style={{
                      width: i === currentStep ? 18 : 6, height: 6, borderRadius: 3,
                      background: i === currentStep ? "var(--brand-400)" : i < currentStep ? "#10b981" : "var(--bg-elevated)",
                      transition: "all 0.3s",
                    }} />
                  ))}
                </div>

                {/* Navigation */}
                <div style={{ display: "flex", gap: 6 }}>
                  {currentStep > 0 && (
                    <button onClick={prevStep} style={{
                      padding: "6px 12px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                      background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
                      color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <ChevronLeft size={13} /> Back
                    </button>
                  )}
                  <button onClick={nextStep} style={{
                    padding: "6px 14px", borderRadius: 7, fontSize: 11.5, fontWeight: 700,
                    background: "linear-gradient(135deg, var(--brand-400), var(--accent-500))",
                    border: "none", color: "#fff", cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {currentStep === steps.length - 1 ? (
                      <><CheckCircle2 size={13} /> Finish</>
                    ) : (
                      <>Next <ChevronRight size={13} /></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes spotlightPulse {
              0%, 100% { box-shadow: 0 0 0 4px rgba(6,182,212,0.15), 0 0 20px rgba(6,182,212,0.2); }
              50% { box-shadow: 0 0 0 6px rgba(6,182,212,0.25), 0 0 30px rgba(6,182,212,0.3); }
            }
            @keyframes tooltipSlideIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </>
      )}
    </WalkthroughContext.Provider>
  );
}


/* ═══════════════════════════════════════════════════════════════
   6. START TOUR BUTTON — Trigger for any walkthrough
   ═══════════════════════════════════════════════════════════════ */
export function StartTourButton({ steps, id, label = "Take a Tour" }: {
  steps: WalkthroughStep[]; id?: string; label?: string;
}) {
  const { startWalkthrough } = useWalkthrough();

  return (
    <button
      onClick={() => startWalkthrough(steps, id)}
      className="btn btn-secondary"
      style={{
        padding: "6px 14px", fontSize: 12, display: "flex",
        alignItems: "center", gap: 6,
      }}
    >
      <Play size={13} /> {label}
    </button>
  );
}


/* ═══════════════════════════════════════════════════════════════
   7. FEATURE CARD — For help page feature grid
   ═══════════════════════════════════════════════════════════════ */
export function FeatureCard({ icon, title, description, href }: {
  icon: React.ReactNode; title: string; description: string; href?: string;
}) {
  const router = useRouter();
  return (
    <div
      onClick={() => href && router.push(href)}
      style={{
        background: "var(--bg-card)", border: "1px solid var(--border-primary)",
        borderRadius: 12, padding: "20px", cursor: href ? "pointer" : "default",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => {
        if (href) {
          e.currentTarget.style.borderColor = "var(--brand-400)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(6,182,212,0.1)";
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border-primary)";
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, marginBottom: 14,
        background: "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(139,92,246,0.1) 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--brand-400)",
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{description}</div>
      {href && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--brand-400)", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
          Learn more <ExternalLink size={11} />
        </div>
      )}
    </div>
  );
}
