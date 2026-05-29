"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useTheme } from "@/components/ThemeProvider";

export default function NotFoundPage() {
  const { theme, toggleTheme } = useTheme();

  const L = theme === "light";
  const bg = L ? "#f9fafb" : "#020205";
  const txt = L ? "#0f172a" : "#f3f4f6";
  const muted = L ? "#475569" : "#8a8f98";
  const border = L ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.06)";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: txt, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif", transition: "background 0.5s, color 0.5s" }}>
      <Header theme={theme} onToggleTheme={toggleTheme} />

      <section style={{ paddingTop: 180, paddingBottom: 120, textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 24px" }}>
          <div style={{
            fontSize: 120,
            fontWeight: 900,
            letterSpacing: "-0.06em",
            lineHeight: 1,
            background: "linear-gradient(135deg, #06b6d4 10%, #8b5cf6 90%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: 24,
          }}>
            404
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16, letterSpacing: "-0.03em" }}>
            Page Not Found
          </h1>
          <p style={{ fontSize: 16, color: muted, lineHeight: 1.7, marginBottom: 40, maxWidth: 480, margin: "0 auto 40px" }}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back to safety.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/" style={{
              padding: "14px 32px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white",
              fontSize: 15, fontWeight: 800, textDecoration: "none",
              boxShadow: "0 6px 28px rgba(6, 182, 212, 0.3)",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              ← Back to Home
            </Link>
            <Link href="/contact" style={{
              padding: "14px 32px", borderRadius: 10,
              border: `1.5px solid ${border}`, background: "transparent",
              color: txt, fontSize: 15, fontWeight: 800, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              Contact Support
            </Link>
          </div>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
