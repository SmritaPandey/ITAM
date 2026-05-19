"use client";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, BookOpen, Terminal, Server, Cpu, Network, Monitor, Camera, Car, HardDrive, ExternalLink, ChevronRight } from "lucide-react";

const SECTIONS = [
  {
    title: "Getting Started", icon: BookOpen, items: [
      { title: "Quick Start Guide", desc: "Deploy QS Asset Management in under 10 minutes with Docker", link: "#quickstart" },
      { title: "System Requirements", desc: "Hardware, OS, and network prerequisites", link: "#requirements" },
      { title: "First Scan", desc: "Run your first network discovery scan", link: "#firstscan" },
    ]
  },
  {
    title: "Deployment", icon: Server, items: [
      { title: "Docker Compose (Recommended)", desc: "Production deployment with PostgreSQL and Redis", link: "#docker" },
      { title: "Cloud SaaS", desc: "Use QS Asset Management as a managed SaaS service", link: "#saas" },
      { title: "On-Premise", desc: "Self-hosted deployment behind your firewall", link: "#onprem" },
    ]
  },
  {
    title: "Agent Setup", icon: Cpu, items: [
      { title: "Agent Installation", desc: "Install the QS Asset Management agent on workstations", link: "#agent-install" },
      { title: "Agent Configuration", desc: "Configure reporting intervals and modules", link: "#agent-config" },
      { title: "Agentless Monitoring", desc: "SNMP, ICMP, and Nmap-based discovery", link: "#agentless" },
    ]
  },
  {
    title: "Modules", icon: Monitor, items: [
      { title: "Asset Management", desc: "IT and non-IT asset lifecycle tracking", link: "#assets" },
      { title: "Network Monitoring", desc: "SNMP polling, topology maps, uptime SLAs", link: "#nms" },
      { title: "ITSM Service Desk", desc: "Ticketing, SLAs, and knowledge base", link: "#itsm" },
      { title: "Vulnerability Scanning", desc: "Nmap, CVE detection, and risk scoring", link: "#scanning" },
      { title: "CCTV Management", desc: "Camera fleet health and ONVIF auto-discovery", link: "#cctv" },
      { title: "Fleet GPS", desc: "Vehicle tracking and trip analytics", link: "#fleet" },
    ]
  },
  {
    title: "API Reference", icon: Terminal, items: [
      { title: "REST API Documentation", desc: "Full Swagger/OpenAPI reference", link: "/api/docs", external: true },
      { title: "Authentication", desc: "JWT tokens, refresh flow, and API keys", link: "#api-auth" },
      { title: "WebSocket Events", desc: "Real-time event subscription", link: "#websocket" },
    ]
  },
];

export default function DocsPage() {
  const router = useRouter();
  const bg = "#0a0e1a", card = "rgba(26,31,53,0.7)", border = "rgba(42,49,80,0.5)", muted = "#94a3b8", txt = "#f1f5f9";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: txt, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <nav style={{ padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${border}`, background: "rgba(10,14,26,0.95)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <Shield size={24} style={{ color: "#06b6d4" }} />
          <span style={{ fontSize: 16, fontWeight: 800 }}>QS Asset Management</span>
          <span style={{ fontSize: 12, color: muted, marginLeft: 4 }}>/ Docs</span>
        </div>
        <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
          <ArrowLeft size={14} /> Home
        </button>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Documentation</h1>
          <p style={{ fontSize: 15, color: muted, maxWidth: 520, margin: "0 auto" }}>Everything you need to deploy, configure, and operate QS Asset Management.</p>
        </div>

        {/* Quick Start Banner */}
        <div style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.08),rgba(139,92,246,0.08))", border: `1px solid rgba(6,182,212,0.2)`, borderRadius: 14, padding: "24px 28px", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>⚡ Quick Start</h3>
            <code style={{ fontSize: 13, color: "#06b6d4", background: "rgba(6,182,212,0.1)", padding: "4px 10px", borderRadius: 6 }}>
              SERVER_IP=192.168.1.50 docker compose -f docker-compose.prod.yml up -d --build
            </code>
          </div>
          <ChevronRight size={20} style={{ color: muted }} />
        </div>

        {SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <div key={section.title} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Icon size={18} style={{ color: "#06b6d4" }} />
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>{section.title}</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {section.items.map(item => (
                  <a key={item.title} href={item.link} target={item.external ? "_blank" : undefined}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: 10, background: card, border: `1px solid ${border}`, textDecoration: "none", color: txt, transition: "border-color 0.2s" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: muted }}>{item.desc}</div>
                    </div>
                    {item.external ? <ExternalLink size={14} style={{ color: muted, flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: muted, flexShrink: 0 }} />}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
