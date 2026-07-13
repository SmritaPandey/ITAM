"use client";

import React, { useId } from "react";

interface LogoIconProps {
  size?: number;
  glow?: boolean;
}

/**
 * QS Assets / QSA mark — open hexagon line-art with SE depth outline,
 * isometric cube, and gradient asset nodes. Transparent (no plate).
 */
export function LogoIcon({ size = 32, glow = true }: LogoIconProps) {
  const uid = useId().replace(/:/g, "");
  const qGrad = `qs-q-${uid}`;
  const cubeStroke = `qs-cube-${uid}`;
  const nodeGrad = `qs-node-${uid}`;

  // Open hex: skip top-right edge (Top→TR); no Q-tail
  const hex = "M424 149 L424 323 L256 420 L88 323 L88 149 L256 52";
  const cubeTop = "216,148 148,186 216,224 284,186";
  const cubeLeft = "148,186 148,278 216,316 216,224";
  const cubeRight = "284,186 284,278 216,316 216,224";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{
        filter: glow ? "drop-shadow(0 2px 10px rgba(6, 182, 212, 0.35))" : "none",
        transition: "filter 0.3s ease",
        flexShrink: 0,
      }}
    >
      <defs>
        <linearGradient id={qGrad} x1="70" y1="30" x2="470" y2="490" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a5f3fc" />
          <stop offset="0.35" stopColor="#22d3ee" />
          <stop offset="0.7" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
        <linearGradient id={cubeStroke} x1="140" y1="140" x2="300" y2="320" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ecfeff" />
          <stop offset="0.45" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id={nodeGrad} x1="300" y1="160" x2="380" y2="310" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5eead4" />
          <stop offset="0.55" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>

      {/* Depth outline — SE offset */}
      <g
        transform="translate(9, 10)"
        fill="none"
        stroke="#134e4a"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      >
        <path d={hex} strokeWidth="20" />
        <polygon points={cubeTop} strokeWidth="15" />
        <polygon points={cubeLeft} strokeWidth="15" />
        <polygon points={cubeRight} strokeWidth="15" />
        <path d="M302 176 V300" strokeWidth="12" />
        <path d="M302 192 H334" strokeWidth="12" />
        <path d="M302 238 H334" strokeWidth="12" />
        <path d="M302 284 H334" strokeWidth="12" />
        <rect x="334" y="174" width="26" height="26" rx="6" strokeWidth="12" />
        <rect x="334" y="220" width="26" height="26" rx="6" strokeWidth="12" />
        <rect x="334" y="266" width="26" height="26" rx="6" strokeWidth="12" />
      </g>

      {/* Primary line art */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={hex} stroke={`url(#${qGrad})`} strokeWidth="20" />

        <polygon points={cubeTop} stroke={`url(#${cubeStroke})`} strokeWidth="16" />
        <polygon points={cubeLeft} stroke="#0e7490" strokeWidth="16" />
        <polygon points={cubeRight} stroke="#06b6d4" strokeWidth="16" />
        <path d="M216 224 L216 316" stroke="#0891b2" strokeWidth="11" opacity="0.85" />
        <path d="M148 186 L216 224 L284 186" stroke={`url(#${cubeStroke})`} strokeWidth="11" opacity="0.7" />

        <g stroke={`url(#${nodeGrad})`} strokeWidth="12">
          <path d="M302 176 V300" />
          <path d="M302 192 H334" />
          <path d="M302 238 H334" />
          <path d="M302 284 H334" />
          <rect x="334" y="174" width="26" height="26" rx="6" />
          <rect x="334" y="220" width="26" height="26" rx="6" />
          <rect x="334" y="266" width="26" height="26" rx="6" />
        </g>
      </g>
    </svg>
  );
}

interface LogoProps {
  size?: number;
  glow?: boolean;
  textColor?: string;
  subtextColor?: string;
  theme?: "dark" | "light";
  showTagline?: boolean;
  wordmark?: "full" | "qsa";
}

export function Logo({
  size = 32,
  glow = true,
  textColor,
  subtextColor,
  theme = "dark",
  showTagline = false,
  wordmark = "full",
}: LogoProps) {
  const isLight = theme === "light";
  const defaultText = textColor || (isLight ? "#0f172a" : "#f8fafc");
  const defaultSub = subtextColor || (isLight ? "#0e7490" : "#22d3ee");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.max(8, size * 0.28) }}>
      <LogoIcon size={size} glow={glow} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
        <span
          style={{
            fontSize: size * 0.5,
            fontWeight: 750,
            color: defaultText,
            letterSpacing: "-0.04em",
            fontFamily: "var(--font-display), 'Outfit', system-ui, sans-serif",
          }}
        >
          {wordmark === "qsa" ? "QSA" : "QS Assets"}
        </span>
        {showTagline && (
          <span
            style={{
              fontSize: size * 0.24,
              fontWeight: 650,
              color: defaultSub,
              letterSpacing: "0.12em",
              fontFamily: "var(--font-display), 'Outfit', system-ui, sans-serif",
              textTransform: "uppercase",
              marginTop: 2,
              opacity: 0.9,
            }}
          >
            Discovery &amp; Control
          </span>
        )}
      </div>
    </div>
  );
}
