"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NewsletterForm } from "@/components/landing/NewsletterForm";

interface FooterProps {
  theme: "dark" | "light";
}

const SOCIAL_LINKS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/neurq-ai-labs", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
  )},
  { label: "X (Twitter)", href: "https://x.com/neurqailabs", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  )},
  { label: "GitHub", href: "https://github.com/neurq-ai-labs", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
  )},
];

const PRODUCT_LINKS = [
  { label: "Platform", href: "/#platform" },
  { label: "Modules", href: "/#modules-grid" },
  { label: "Pricing", href: "/pricing" },
  { label: "Security", href: "/security" },
];

const COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "Customers", href: "/customers" },
  { label: "Blog", href: "/blog" },
  { label: "Changelog", href: "/changelog" },
  { label: "Contact Sales", href: "/contact" },
  { label: "Documentation", href: "/docs" },
  { label: "Security", href: "/security" },
  { label: "Status", href: "/status" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Data Processing Addendum", href: "/dpa" },
  { label: "Service Level Agreement", href: "/sla" },
];

export default function Footer({ theme }: FooterProps) {
  const L = theme === "light";

  const border = L ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.06)";
  const muted = L ? "#475569" : "#8a8f98";
  const txt = L ? "#0f172a" : "#f3f4f6";

  return (
    <footer style={{
      padding: "80px 6% 36px",
      borderTop: `1.5px solid ${border}`,
      maxWidth: 1240,
      margin: "0 auto",
    }}>
      {/* Main Grid */}
      <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 40 }}>
        {/* Brand Column */}
        <div>
          <Link href="/" style={{ display: "flex", alignItems: "center", marginBottom: 16, textDecoration: "none", color: "inherit" }}>
            <Logo size={34} glow={!L} theme={theme} />
          </Link>
          <p style={{ fontSize: 12.5, color: muted, lineHeight: 1.7, maxWidth: 300, marginBottom: 20 }}>
            Discover, track, and operate IT and non-IT assets — discovery, monitoring, and service workflows in one place. Built by NeurQ AI Labs.
          </p>
          {/* Social Links */}
          <div style={{ display: "flex", gap: 10 }}>
            {SOCIAL_LINKS.map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                style={{
                  width: 36, height: 36,
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  background: L ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: muted,
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#06b6d4"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = muted; e.currentTarget.style.borderColor = border; }}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Product Column */}
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, color: muted }}>Product</h4>
          {PRODUCT_LINKS.map(a => (
            <Link key={a.label} href={a.href}
              style={{ display: "block", fontSize: 13, color: txt, textDecoration: "none", marginBottom: 10, opacity: 0.7, fontWeight: 600, transition: "opacity 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
            >{a.label}</Link>
          ))}
        </div>

        {/* Company Column */}
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, color: muted }}>Company</h4>
          {COMPANY_LINKS.map(a => (
            <Link key={a.label} href={a.href}
              style={{ display: "block", fontSize: 13, color: txt, textDecoration: "none", marginBottom: 10, opacity: 0.7, fontWeight: 600, transition: "opacity 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
            >{a.label}</Link>
          ))}
        </div>

        {/* Legal Column */}
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, color: muted }}>Legal</h4>
          {LEGAL_LINKS.map(a => (
            <Link key={a.label} href={a.href}
              style={{ display: "block", fontSize: 13, color: txt, textDecoration: "none", marginBottom: 10, opacity: 0.7, fontWeight: 600, transition: "opacity 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
            >{a.label}</Link>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: "28px 0 8px",
          marginBottom: 24,
          borderTop: `1px solid ${border}`,
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, color: muted }}>
            Product updates
          </h4>
          <p style={{ fontSize: 12.5, color: muted, lineHeight: 1.6, margin: "0 0 4px" }}>
            Release notes and operational tips. No ad pixels.
          </p>
        </div>
        <NewsletterForm
          muted={muted}
          txt={txt}
          border={border}
          L={L}
          voidBtn={L ? "#0f172a" : "#ffffff"}
          voidTxt={L ? "#ffffff" : "#0f172a"}
        />
      </div>

      {/* Bottom Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, borderTop: `1px solid ${border}`, flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 12, color: muted, margin: 0 }}>&copy; 2026 NeurQ AI Labs Pvt Ltd. All rights reserved. Crafted in India 🇮🇳</p>
        <p style={{ fontSize: 12, color: muted, margin: 0, opacity: 0.6 }}>
          <a href="mailto:contact@qsasset.com" style={{ color: "inherit", textDecoration: "none" }}>contact@qsasset.com</a>
        </p>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
        }
      `}</style>
    </footer>
  );
}
