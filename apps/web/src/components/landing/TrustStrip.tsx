"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

/** Replace PNGs/SVGs in /public/customers/ — filenames match `src` below. */
/** Swap these files in public/customers/ with real customer wordmarks. */
export const CUSTOMER_LOGOS = [
  { name: "Customer logo 1", src: "/customers/logo-1.svg" },
  { name: "Customer logo 2", src: "/customers/logo-2.svg" },
  { name: "Customer logo 3", src: "/customers/logo-3.svg" },
  { name: "Customer logo 4", src: "/customers/logo-4.svg" },
  { name: "Customer logo 5", src: "/customers/logo-5.svg" },
];

export function TrustStrip({
  muted,
  txt,
  border,
  L,
  compact = false,
}: {
  muted: string;
  txt: string;
  border: string;
  L: boolean;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: compact ? 16 : 22,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: compact ? 18 : 28,
          alignItems: "center",
          opacity: 0.85,
        }}
      >
        {CUSTOMER_LOGOS.map((c) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={c.src}
            src={c.src}
            alt={c.name}
            width={compact ? 88 : 108}
            height={compact ? 28 : 32}
            style={{
              objectFit: "contain",
              filter: L ? "none" : "brightness(1.15)",
              opacity: L ? 0.7 : 0.65,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center",
          alignItems: "center",
          fontSize: 12,
          color: muted,
        }}
      >
        <span style={{ fontWeight: 600, color: txt }}>Trusted by 200+ teams</span>
        <span aria-hidden style={{ opacity: 0.4 }}>
          ·
        </span>
        <span>50K+ assets managed</span>
        <span aria-hidden style={{ opacity: 0.4 }}>
          ·
        </span>
        <Link
          href="/security"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: "#0891b2",
            textDecoration: "none",
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${border}`,
            background: L ? "rgba(6,182,212,0.06)" : "rgba(6,182,212,0.1)",
          }}
        >
          <ShieldCheck size={13} />
          SOC 2
        </Link>
      </div>
    </div>
  );
}
