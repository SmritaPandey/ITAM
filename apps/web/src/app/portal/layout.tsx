"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Ticket, Package, Plus, LogOut, User,
  Bell, Shield, ChevronDown, Search
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }

const portalNav = [
  { name: "My Dashboard", icon: LayoutDashboard, href: "/portal" },
  { name: "My Assets", icon: Package, href: "/portal/assets" },
  { name: "Raise Ticket", icon: Plus, href: "/portal/tickets/new" },
  { name: "My Tickets", icon: Ticket, href: "/portal/tickets" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/"); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // If admin tries to access portal, redirect to dashboard
      if (payload.role !== "Employee") { router.push("/dashboard"); return; }
      setUser(payload);
    } catch { router.push("/"); }
  }, [router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    router.push("/");
  }

  if (!user) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-primary)",
        display: "flex", flexDirection: "column", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 16px", display: "flex", alignItems: "center", gap: 10,
          borderBottom: "1px solid var(--border-primary)",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "white",
          }}>AC</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Employee Portal</div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.03em" }}>ASSETCOMMAND</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {portalNav.map(item => {
            const active = pathname === item.href;
            return (
              <button key={item.href} onClick={() => router.push(item.href)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8, marginBottom: 2,
                background: active ? "var(--bg-active-nav)" : "transparent",
                border: "none", color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
                fontFamily: "inherit", transition: "all 0.15s",
                borderLeft: active ? "3px solid var(--brand-400)" : "3px solid transparent",
              }}>
                <item.icon size={18} style={{ color: active ? "var(--brand-400)" : "var(--text-tertiary)" }} />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div style={{
          padding: "12px 16px", borderTop: "1px solid var(--border-primary)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, var(--brand-500), var(--accent-500))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 12, fontWeight: 700,
          }}>
            {user.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Employee</div>
          </div>
          <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}>
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: 240, padding: "24px 32px", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
