"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Search, Shield, Lock, Unlock, RotateCcw } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { ACTIVE: "#10b981", INACTIVE: "#64748b", LOCKED: "#ef4444", PENDING: "#f59e0b" };

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resetModal, setResetModal] = useState<any>(null);
  const [newPw, setNewPw] = useState("");

  function load(q?: string) {
    setLoading(true);
    apiFetch(`/admin/users?limit=50${q ? `&search=${encodeURIComponent(q)}` : ""}`).then(d => {
      setUsers(d.data || []); setTotal(d.total || 0);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleSearch(e: React.FormEvent) { e.preventDefault(); load(search); }

  async function toggleLock(user: any) {
    const newStatus = user.status === "LOCKED" ? "ACTIVE" : "LOCKED";
    await apiFetch(`/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load(search);
  }

  async function resetPassword() {
    if (!resetModal || !newPw || newPw.length < 6) { alert("Password must be at least 6 characters"); return; }
    await apiFetch(`/admin/users/${resetModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: newPw }),
    });
    setResetModal(null); setNewPw("");
    alert("Password reset successfully");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>User Management</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{total} users across all tenants</p>
        </div>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
              style={{ padding: "8px 12px 8px 32px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, width: 260, outline: "none" }} />
          </div>
        </form>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
              {["User", "Tenant", "Role", "Status", "Last Login", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.firstName} {u.lastName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{u.email}</div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{u.tenant?.name || "—"}</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{u.tenant?.plan}</div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>{u.role?.name}</span>
                  {u.isSuperAdmin && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>SA</span>}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${STATUS_COLORS[u.status] || "#64748b"}15`, color: STATUS_COLORS[u.status] || "#64748b" }}>{u.status}</span>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--text-tertiary)", fontSize: 12 }}>
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => toggleLock(u)} title={u.status === "LOCKED" ? "Unlock" : "Lock"} style={{
                      width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-primary)", background: "transparent", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: u.status === "LOCKED" ? "#10b981" : "#ef4444",
                    }}>
                      {u.status === "LOCKED" ? <Unlock size={12} /> : <Lock size={12} />}
                    </button>
                    <button onClick={() => { setResetModal(u); setNewPw(""); }} title="Reset Password" style={{
                      width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-primary)", background: "transparent", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b",
                    }}>
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset Password Modal */}
      {resetModal && (
        <>
          <div onClick={() => setResetModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 400, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 14, padding: 28, zIndex: 2001 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Reset Password</h3>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>{resetModal.firstName} {resetModal.lastName} ({resetModal.email})</p>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>New Password</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 6 characters"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, marginBottom: 16, outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setResetModal(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              <button onClick={resetPassword} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#dc2626", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reset</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
