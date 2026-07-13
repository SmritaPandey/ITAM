"use client";

import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}

export default function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        {eyebrow && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--brand-500)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 6,
              fontFamily: "var(--font-display), inherit",
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          style={{
            fontSize: 24,
            fontWeight: 750,
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.03em",
            fontFamily: "var(--font-display), inherit",
          }}
        >
          {title}
        </h1>
        {description && (
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "6px 0 0", lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
