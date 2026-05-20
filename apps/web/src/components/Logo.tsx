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
        filter: glow ? "drop-shadow(0 0 10px rgba(6, 182, 212, 0.45))" : "none",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <defs>
        <linearGradient id="cyber-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="60%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="cyber-pink" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* Hexagonal Outer Frame (Futuristic Cyber-Grid Structure) */}
      <polygon
        points="24,2 44,13 44,35 24,46 4,35 4,13"
        stroke="url(#cyber-cyan)"
        strokeWidth="3"
        strokeLinejoin="round"
        fill="rgba(13, 18, 37, 0.75)"
      />

      {/* Active Network Scan Line (Subtle Inner Hex) */}
      <polygon
        points="24,7 39,15 39,33 24,41 9,33 9,15"
        stroke="rgba(34, 211, 238, 0.15)"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* Network Nodes (Discovery / CMDB Representation) */}
      <circle cx="24" cy="7" r="2.5" fill="#22d3ee" />
      <circle cx="39" cy="15" r="2.5" fill="#3b82f6" />
      <circle cx="39" cy="33" r="2.5" fill="#8b5cf6" />
      <circle cx="24" cy="41" r="2.5" fill="#ec4899" />
      <circle cx="9" cy="33" r="2.5" fill="#8b5cf6" />
      <circle cx="9" cy="15" r="2.5" fill="#3b82f6" />

      {/* Interlocking 'Q' & 'S' Cybernetic Monogram */}
      {/* Outer Q Circle & Tail */}
      <path
        d="M24 13C17.9249 13 13 17.9249 13 24C13 30.0751 17.9249 35 24 35C26.4384 35 28.6811 34.2057 30.4952 32.8653L34.2929 36.663C34.6834 37.0535 35.3166 37.0535 35.7071 36.663C36.0976 36.2725 36.0976 35.6393 35.7071 35.2488L31.9546 31.4963C33.8427 29.5898 35 26.9327 35 24C35 17.9249 30.0751 13 24 13ZM17 24C17 20.134 20.134 17 24 17C27.866 17 31 20.134 31 24C31 27.866 27.866 31 24 31C20.134 31 17 27.866 17 24Z"
        fill="url(#cyber-cyan)"
      />

      {/* Overlapping glowing 'S' path (resembling security flow & alert cycles) */}
      <path
        d="M24 18C25.1046 18 26 18.8954 26 20C26 21.1046 25.1046 22 24 22C21.7909 22 20 23.7909 20 26C20 27.1046 19.1046 28 18 28C16.8954 28 16 27.1046 16 26C16 21.5817 19.5817 18 24 18Z"
        fill="url(#cyber-pink)"
      />
      <path
        d="M24 30C22.8954 30 22 29.1046 22 28C22 26.8954 22.8954 26 24 26C26.2091 26 28 24.2091 28 22C28 20.8954 28.8954 20 30 20C31.1046 20 32 20.8954 32 22C32 26.4183 28.4183 30 24 30Z"
        fill="url(#cyber-pink)"
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
  const defaultSub = subtextColor || (isLight ? "#475569" : "#38bdf8");

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
          APM platform
        </span>
      </div>
    </div>
  );
}
