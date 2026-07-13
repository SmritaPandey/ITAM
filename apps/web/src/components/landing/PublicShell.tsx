"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useTheme } from "@/components/ThemeProvider";
import type { ReactNode, CSSProperties } from "react";

export function usePublicTheme() {
  const { theme, toggleTheme } = useTheme();
  const L = theme === "light";
  return {
    theme,
    toggleTheme,
    L,
    bg: L ? "#f5f7f8" : "#070b10",
    txt: L ? "#0f172a" : "#f5f5f7",
    muted: L ? "#6b7280" : "#9f9fa0",
    border: L ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)",
    card: L ? "#ffffff" : "rgba(18,21,26,0.92)",
    voidBtn: L ? "#0f172a" : "#ffffff",
    voidTxt: L ? "#ffffff" : "#0f172a",
    pTxt: L ? "#475569" : "#cbd5e1",
    boxBg: L ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.04)",
    codeColor: L ? "#0e7490" : "#22d3ee",
    font: "var(--font-body), 'DM Sans', system-ui, sans-serif",
    wash: L
      ? "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(6,182,212,0.12) 0%, transparent 55%), linear-gradient(180deg, #eef4f6 0%, #f5f7f8 70%)"
      : "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(6,182,212,0.16) 0%, transparent 55%), linear-gradient(180deg, #0a1218 0%, #070b10 75%)",
  };
}

export function MonoEyebrow({ children, muted, light = true }: { children: ReactNode; muted: string; light?: boolean }) {
  return (
    <div
      className="font-mono-label"
      style={{
        display: "inline-block",
        fontSize: 11,
        padding: "8px 18px",
        borderRadius: 9999,
        background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${light ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.12)"}`,
        color: muted,
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  );
}

export function PublicShell({
  children,
  maxWidth = 1200,
  contentStyle,
}: {
  children: ReactNode;
  maxWidth?: number | string;
  contentStyle?: CSSProperties;
}) {
  const t = usePublicTheme();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        color: t.txt,
        fontFamily: t.font,
        transition: "background 0.4s, color 0.4s",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "0 0 auto 0",
          height: 420,
          pointerEvents: "none",
          zIndex: 0,
          background: t.wash,
        }}
      />
      <Header theme={t.theme} onToggleTheme={t.toggleTheme} />
      <div
        style={{
          flex: 1,
          width: "100%",
          maxWidth,
          margin: "0 auto",
          padding: "108px 24px 80px",
          position: "relative",
          zIndex: 1,
          ...contentStyle,
        }}
      >
        {children}
      </div>
      <Footer theme={t.theme} />
    </div>
  );
}
