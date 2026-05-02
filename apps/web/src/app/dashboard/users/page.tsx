"use client";
import { useEffect, useState } from "react";
import {
  Users, Shield, UserCheck, UserX, Search, Plus, Clock,
  Mail, MapPin, Building, Key, Eye, MoreVertical, Loader2, RefreshCw,
  UserPlus, Power
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const ROLE_COLORS: Record<string, string> = {
  "Tenant Admin": "red", "IT Admin": "amber", "Employee": "cyan", "Fleet Manager": "green",
};

export default function UsersPage() {
  const [users, setUsers] = useState<any>({ data: [], total: 0 });
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "Welcome@123", roleId: "" });

  async function refresh() {
    try {
      const [u, r] = await Promise.all([apiFetch("/users"), apiFetch("/users/roles")]);
      setUsers(u);
      setRoles(r);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const data = users.data || [];
  const active = data.filter((u: any) => u.status === "ACTIVE").length;
  const filtered = data.filter((u: any) =>
    !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  async function toggleUserStatus(userId: string) {
    await apiFetch(`/users/${userId}/toggle-status`, { method: "POST" });
    refresh();
    setSelectedUser(null);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/users", { method: "POST", body: JSON.stringify(form) });
    setShowInvite(false);
    setForm({ firstName: "", lastName: "", email: "", password: "Welcome@123", roleId: "" });
    refresh();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users & Access</h1>
          <p className="page-subtitle">{users.total || data.length} users across your organization</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setShowInvite(!showInvite)}><UserPlus size={14} /> Invite User</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card"><div className="stat-icon cyan"><Users size={22} /></div><div className="stat-content"><div className="stat-label">Total Users</div><div className="stat-value">{data.length}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><UserCheck size={22} /></div><div className="stat-content"><div className="stat-label">Active</div><div className="stat-value">{active}</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><UserX size={22} /></div><div className="stat-content"><div className="stat-label">Inactive</div><div className="stat-value">{data.length - active}</div></div></div>
        <div className="stat-card"><div className="stat-icon purple"><Shield size={22} /></div><div className="stat-content"><div className="stat-label">Roles</div><div className="stat-value">{new Set(data.map((u: any) => u.role?.name)).size}</div></div></div>
      </div>

      {/* Invite User Form */}
      {showInvite && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Invite New User</h3>
          <form onSubmit={handleInvite} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input required placeholder="First Name *" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <input required placeholder="Last Name *" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <input required type="email" placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <select required value={form.roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
              <option value="">Select Role *</option>
              {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><UserPlus size={14} /> Create User</button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ padding: "10px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <Search size={14} style={{ color: "var(--text-tertiary)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users by name or email..."
          style={{ flex: 1, background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
      </div>

      {/* User Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {loading ? (
          <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", gridColumn: "1 / -1" }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : filtered.map((u: any) => (
          <div key={u.id} className="card" style={{ cursor: "pointer", transition: "border-color 0.15s" }}
            onClick={() => setSelectedUser(u)}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "linear-gradient(135deg, var(--brand-500), var(--accent-500))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 16, fontWeight: 700, flexShrink: 0,
              }}>
                {u.firstName?.[0]}{u.lastName?.[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{u.firstName} {u.lastName}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Mail size={10} /> {u.email}
                </div>
              </div>
              <span className={`badge ${u.status === "ACTIVE" ? "green" : "gray"}`} style={{ fontSize: 10 }}>{u.status}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                <Shield size={11} style={{ color: "var(--brand-400)" }} />
                <span className={`badge ${ROLE_COLORS[u.role?.name] || "gray"}`} style={{ fontSize: 9 }}>{u.role?.name || "—"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                <Building size={11} style={{ color: "var(--text-tertiary)" }} />
                {u.department?.name?.split(" ")[0] || "—"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                <MapPin size={11} style={{ color: "var(--text-tertiary)" }} />
                {u.site?.name?.split(" - ")[1] || u.site?.name || "—"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                <Clock size={11} style={{ color: "var(--text-tertiary)" }} />
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Panel */}
      {selectedUser && (
        <>
          <div onClick={() => setSelectedUser(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 420, background: "var(--bg-card)", zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out" }}>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border-primary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: "linear-gradient(135deg, var(--brand-500), var(--accent-500))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 18, fontWeight: 700,
                  }}>
                    {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selectedUser.firstName} {selectedUser.lastName}</h2>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>{selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "grid", gap: 14 }}>
              <DetailRow icon={<Shield size={13} />} label="Role" value={<span className={`badge ${ROLE_COLORS[selectedUser.role?.name] || "gray"}`}>{selectedUser.role?.name}</span>} />
              <DetailRow icon={<Building size={13} />} label="Department" value={selectedUser.department?.name || "—"} />
              <DetailRow icon={<MapPin size={13} />} label="Site" value={selectedUser.site?.name || "—"} />
              <DetailRow icon={<UserCheck size={13} />} label="Status" value={<span className={`badge ${selectedUser.status === "ACTIVE" ? "green" : "gray"}`}>{selectedUser.status}</span>} />
              <DetailRow icon={<Key size={13} />} label="MFA" value={selectedUser.mfaEnabled ? "✅ Enabled" : "❌ Disabled"} />
              <DetailRow icon={<Clock size={13} />} label="Last Login" value={selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "Never"} />
              <DetailRow icon={<Clock size={13} />} label="Created" value={new Date(selectedUser.createdAt).toLocaleDateString()} />
            </div>
            {/* Actions */}
            <div style={{ padding: 16, borderTop: "1px solid var(--border-primary)", display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12 }}
                onClick={() => toggleUserStatus(selectedUser.id)}>
                <Power size={12} /> {selectedUser.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
          <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>{icon} {label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{typeof value === "string" ? value : value}</span>
    </div>
  );
}
