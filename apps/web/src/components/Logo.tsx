import React from "react";

interface LogoIconProps {
  size?: number;
  glow?: boolean;
}

export function LogoIcon({ size = 32, glow = true }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: glow ? "drop-shadow(0 4px 14px rgba(6, 182, 212, 0.35))" : "none",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <defs>
        {/* Core Sleek Cybernetic Gradients */}
        <linearGradient id="qs-primary-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="qs-accent-grad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="qs-shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(34, 211, 238, 0.45)" />
          <stop offset="50%" stopColor="rgba(99, 102, 241, 0.15)" />
          <stop offset="100%" stopColor="rgba(16, 185, 129, 0.45)" />
        </linearGradient>
      </defs>

      {/* Futuristic Precision Outer Hexagonal Shield */}
      <path
        d="M24 3 L42.5 13.7 L42.5 35.3 L24 46 L5.5 35.3 L5.5 13.7 Z"
        stroke="url(#qs-shield-grad)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="rgba(6, 182, 212, 0.01)"
      />

      {/* Cybernetic Tech Detailing Accent Markers (Adds premium aerospace-grid feel) */}
      <path d="M11.5 8.7 L7.5 11" stroke="rgba(34, 211, 238, 0.35)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M36.5 8.7 L40.5 11" stroke="rgba(34, 211, 238, 0.35)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M24 40.5 L24 43" stroke="rgba(139, 92, 246, 0.35)" strokeWidth="1.2" strokeLinecap="round" />

      {/* High-Fidelity Interlocking 'Q' Ring */}
      <path
        d="M24 11.5 C17.1 11.5 11.5 17.1 11.5 24 C11.5 30.9 17.1 36.5 24 36.5 C27.1 36.5 29.9 35.3 32.1 33.4 L36.8 38.1 C37.2 38.5 37.8 38.5 38.2 38.1 C38.6 37.7 38.6 37.1 38.2 36.7 L33.5 32 C35.4 29.8 36.5 27 36.5 24 C36.5 17.1 30.9 11.5 24 11.5 Z M24 15.5 C28.7 15.5 32.5 19.3 32.5 24 C32.5 26.1 31.7 28 30.5 29.5 L28.9 27.9 C29.6 26.8 30 25.4 30 24 C30 20.7 27.3 18 24 18 C22.6 18 21.2 18.4 20.1 19.1 L18.5 17.5 C20 16.3 21.9 15.5 24 15.5 Z M15.5 24 C15.5 19.3 19.3 15.5 24 15.5 L24 18 C20.7 18 18 20.7 18 24 C18 25.4 18.4 26.8 19.1 27.9 L17.5 29.5 C16.3 28 15.5 26.1 15.5 24 Z"
        fill="url(#qs-primary-grad)"
      />

      {/* Infinite Autonomic 'S' Winding Fiber Core */}
      <path
        d="M28.5 19.5 C28.5 18 26.5 17 24 17 C21 17 20 19 20 21 C20 23.5 28 23.5 28 26 C28 28.5 27 31 24 31 C21 31 19.5 29.5 19.5 28.5"
        stroke="url(#qs-accent-grad)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

interface LogoProps {
  size?: number;
  glow?: boolean;
  textColor?: string;
  subtextColor?: string;
  theme?: "dark" | "light";
}

export function Logo({
  size = 32,
  glow = true,
  textColor,
  subtextColor,
  theme = "dark",
}: LogoProps) {
  const isLight = theme === "light";
  const defaultText = textColor || (isLight ? "#0f172a" : "#f8fafc");
  const defaultSub = subtextColor || (isLight ? "#475569" : "#22d3ee");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LogoIcon size={size} glow={glow} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span
          style={{
            fontSize: size * 0.44,
            fontWeight: 800,
            color: defaultText,
            letterSpacing: "-0.03em",
            fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
            background: "linear-gradient(to right, " + defaultText + " 70%, #22d3ee 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            transition: "all 0.3s ease",
          }}
        >
          QS Asset
        </span>
        <span
          style={{
            fontSize: size * 0.28,
            fontWeight: 700,
            color: defaultSub,
            letterSpacing: "0.12em",
            fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
            textTransform: "uppercase",
            marginTop: 1,
            opacity: 0.9,
            transition: "all 0.3s ease",
          }}
        >
          APM Platform
        </span>
      </div>
    </div>
  );
}

