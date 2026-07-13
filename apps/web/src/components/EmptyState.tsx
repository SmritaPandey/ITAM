"use client";

import React from "react";
import Link from "next/link";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  compact?: boolean;
}

function ActionButton({ action }: { action: EmptyStateAction }) {
  const primary = action.variant !== "secondary";
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: primary ? "10px 18px" : "9px 16px",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    textDecoration: "none",
    border: primary ? "none" : "1.5px solid var(--border-primary)",
    background: primary
      ? "linear-gradient(135deg, var(--brand-500), var(--brand-600))"
      : "transparent",
    color: primary ? "#fff" : "var(--text-primary)",
  };

  if (action.href) {
    return (
      <Link href={action.href} style={style} onClick={action.onClick}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" style={style} onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className="card"
      style={{
        textAlign: "center",
        padding: compact ? "32px 24px" : "48px 32px",
        gridColumn: "1 / -1",
      }}
    >
      {icon && (
        <div style={{ color: "var(--text-tertiary)", margin: "0 auto 12px", opacity: 0.85 }}>
          {icon}
        </div>
      )}
      <h3 style={{ fontSize: compact ? 15 : 16, fontWeight: 650, marginBottom: 6, color: "var(--text-primary)" }}>
        {title}
      </h3>
      {description && (
        <p
          style={{
            color: "var(--text-tertiary)",
            fontSize: 13,
            lineHeight: 1.55,
            maxWidth: 420,
            margin: "0 auto",
          }}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 20,
          }}
        >
          {action && <ActionButton action={action} />}
          {secondaryAction && (
            <ActionButton action={{ ...secondaryAction, variant: secondaryAction.variant || "secondary" }} />
          )}
        </div>
      )}
    </div>
  );
}
