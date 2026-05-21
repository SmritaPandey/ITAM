"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogoIcon } from "@/components/Logo";
import { Sun, Moon, ArrowRight, Menu, X } from "lucide-react";

interface HeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

const NAV_SECTIONS = [
  { label: "Platform", hash: "nerve-system" },
  { label: "Security", hash: "immune-system" },
  { label: "Pricing", hash: "pricing" },
  { label: "Modules", hash: "modules-grid" },
];

const NAV_PAGES = [
  { label: "Docs", href: "/docs" },
  { label: "Contact", href: "/contact" },
];

export default function Header({ theme, onToggleTheme }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const L = theme === "light";
  const isHome = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);

  const border = L ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.06)";
  const muted = L ? "#475569" : "#8a8f98";

  function sectionHref(hash: string) {
    return isHome ? `#${hash}` : `/#${hash}`;
  }

  function handleNavClick() {
    setMobileOpen(false);
  }

  return (
    <>
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "16px 6%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: L ? "rgba(255,255,255,0.75)" : "rgba(2, 2, 5, 0.65)",
        backdropFilter: "blur(30px) saturate(1.8)",
        WebkitBackdropFilter: "blur(30px) saturate(1.8)",
        borderBottom: `1px solid ${border}`,
        boxShadow: L ? "0 4px 30px rgba(15, 23, 42, 0.03)" : "none",
        transition: "background 0.3s"
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <LogoIcon size={32} glow={!L} />
          <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.04em" }}>QS Asset</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="header-desktop-nav" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {NAV_SECTIONS.map(t => (
            <a key={t.label} href={sectionHref(t.hash)} style={{ fontSize: 13, fontWeight: 600, color: muted, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = L ? "#0f172a" : "#f3f4f6")}
              onMouseLeave={e => (e.currentTarget.style.color = muted)}
            >{t.label}</a>
          ))}
          {NAV_PAGES.map(t => (
            <Link key={t.label} href={t.href} style={{ fontSize: 13, fontWeight: 600, color: pathname === t.href ? "#06b6d4" : muted, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#06b6d4")}
              onMouseLeave={e => (e.currentTarget.style.color = pathname === t.href ? "#06b6d4" : muted)}
            >{t.label}</Link>
          ))}

          <button onClick={onToggleTheme} aria-label="Toggle theme" style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${border}`, cursor: "pointer", background: L ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)", color: muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {L ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <button onClick={() => router.push("/login")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(6, 182, 212, 0.2)", display: "flex", alignItems: "center", gap: 6, letterSpacing: "-0.01em" }}>
            Sign In <ArrowRight size={13} />
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="header-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          style={{
            display: "none",
            width: 40, height: 40, borderRadius: 10,
            border: `1px solid ${border}`,
            background: L ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
            color: muted, cursor: "pointer",
            alignItems: "center", justifyContent: "center",
          }}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 98,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
          }}
        />
      )}

      {/* Mobile Drawer */}
      <div style={{
        position: "fixed",
        top: 0, right: 0, bottom: 0,
        width: "min(320px, 85vw)",
        zIndex: 99,
        background: L ? "#ffffff" : "#0a0e1a",
        borderLeft: `1px solid ${border}`,
        transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column",
        padding: "80px 24px 32px",
        gap: 8,
        overflowY: "auto",
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Navigation</div>

        {NAV_SECTIONS.map(t => (
          <a key={t.label} href={sectionHref(t.hash)} onClick={handleNavClick}
            style={{ display: "block", padding: "12px 16px", borderRadius: 10, fontSize: 15, fontWeight: 700, color: L ? "#0f172a" : "#f3f4f6", textDecoration: "none", background: L ? "#f8fafc" : "rgba(255,255,255,0.03)", border: `1px solid ${border}` }}
          >{t.label}</a>
        ))}

        <div style={{ fontSize: 10, fontWeight: 800, color: muted, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 16, marginBottom: 8 }}>Pages</div>

        {NAV_PAGES.map(t => (
          <Link key={t.label} href={t.href} onClick={handleNavClick}
            style={{ display: "block", padding: "12px 16px", borderRadius: 10, fontSize: 15, fontWeight: 700, color: pathname === t.href ? "#06b6d4" : (L ? "#0f172a" : "#f3f4f6"), textDecoration: "none", background: pathname === t.href ? (L ? "rgba(6,182,212,0.06)" : "rgba(6,182,212,0.08)") : (L ? "#f8fafc" : "rgba(255,255,255,0.03)"), border: `1px solid ${pathname === t.href ? "rgba(6,182,212,0.2)" : border}` }}
          >{t.label}</Link>
        ))}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={() => { onToggleTheme(); }} style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${border}`, cursor: "pointer", background: L ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)", color: muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
            {L ? <Moon size={16} /> : <Sun size={16} />}
            {L ? "Dark Mode" : "Light Mode"}
          </button>
          <button onClick={() => { setMobileOpen(false); router.push("/login"); }} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(6, 182, 212, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            Sign In <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .header-desktop-nav { display: none !important; }
          .header-mobile-toggle { display: flex !important; }
        }
      `}</style>
    </>
  );
}
