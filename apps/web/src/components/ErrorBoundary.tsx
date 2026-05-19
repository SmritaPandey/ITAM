"use client";
import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; error?: Error; }

/**
 * React error boundary — catches render errors and shows a friendly UI
 * instead of a white screen. Prevents cascading failures.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    // In production, send to Sentry/logging service
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", padding: 40, textAlign: "center", fontFamily: "'Inter',system-ui,sans-serif" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <AlertTriangle size={28} style={{ color: "#ef4444" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Something went wrong</h2>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", maxWidth: 400, lineHeight: 1.6, marginBottom: 20 }}>
            An unexpected error occurred. This has been logged automatically.
          </p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <RefreshCw size={14} /> Reload Page
          </button>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre style={{ marginTop: 20, fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,0.05)", padding: 16, borderRadius: 8, maxWidth: 600, overflow: "auto", textAlign: "left" }}>
              {this.state.error.message}{"\n"}{this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
