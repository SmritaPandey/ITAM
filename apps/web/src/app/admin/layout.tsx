"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, MessageSquare, CreditCard, Shield,
  Activity, LogOut, ChevronRight, ArrowLeft, Sun, Moon, Eye,
} from "lucide-react";
import { LogoIcon } from "@/components/Logo";

const adminNav = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { name: "Tenants", icon: Building2, href: "/admin/tenants" },
  { name: "Users", icon: Users, href: "/admin/users" },
  { name: "Support Inbox", icon: MessageSquare, href: "/admin/support" },
  { name: "Payments", icon: CreditCard, href: "/admin/payments" },
  { name: "Telemetry", icon: Eye, href: "/admin/analytics" },
  { name: "System", icon: Activity, href: "/admin/system" },
];

function decodeJwt(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<"dark"|"light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark"|"light"|null;
    const t = saved || "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    const decoded = decodeJwt(token);
    if (!decoded?.isSuperAdmin) { router.push("/dashboard"); return; }
    setUser(decoded);
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    router.push("/login");
  }

  if (!user) return null;

  const isLight = theme === "light";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)", fontFamily: "'Inter',system-ui,sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: isLight ? "#f8fafc" : "#0d1225",
        borderRight: "1px solid var(--border-primary)",
        display: "flex", flexDirection: "column", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-primary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <LogoIcon size={34} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Platform Console</div>
              <div style={{ fontSize: 10, color: "#06b6d4", fontWeight: 600 }}>OWNER ACCESS</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {adminNav.map(item => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <button key={item.href} onClick={() => router.push(item.href)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8, marginBottom: 2,
                background: active ? (isLight ? "rgba(220,38,38,0.06)" : "rgba(220,38,38,0.1)") : "transparent",
                border: "none", color: active ? "#06b6d4" : "var(--text-secondary)",
                fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
                fontFamily: "inherit", transition: "all 0.15s",
                borderLeft: active ? "3px solid #06b6d4" : "3px solid transparent",
              }}>
                <Icon size={18} style={{ color: active ? "#06b6d4" : "var(--text-tertiary)" }} />
                {item.name}
              </button>
            );
          })}

          <div style={{ borderTop: "1px solid var(--border-primary)", margin: "12px 0" }} />

          <button onClick={() => router.push("/dashboard")} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 8, marginBottom: 2,
            background: "transparent", border: "none",
            color: "var(--text-tertiary)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
        </nav>

        {/* Bottom */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-primary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button onClick={toggleTheme} style={{
              width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer",
              background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
              color: "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {isLight ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <div style={{ flex: 1, fontSize: 11, color: "var(--text-tertiary)" }}>{user.email}</div>
            <button onClick={handleLogout} style={{
              background: "none", border: "none", cursor: "pointer", color: "#06b6d4", padding: 4,
            }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: 240, padding: "24px 32px", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
