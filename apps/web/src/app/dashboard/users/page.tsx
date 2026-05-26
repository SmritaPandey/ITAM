"use client";
import { useEffect, useState } from "react";
import {
  Users, Shield, UserCheck, UserX, Search, Plus, Clock,
  Mail, MapPin, Building, Key, Eye, MoreVertical, Loader2, RefreshCw,
  UserPlus, Power, X, Check
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

  function getAvatarGradient(roleName: string) {
    switch (roleName) {
      case "Tenant Admin":
        return "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)";
      case "IT Admin":
        return "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)";
      case "Fleet Manager":
        return "linear-gradient(135deg, #10b981 0%, #059669 100%)";
      default:
        return "linear-gradient(135deg, #64748b 0%, #475569 100%)";
    }
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Users & Access</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Manage team profiles, workspace roles, and directory credentials</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={refresh} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, padding: 0, borderRadius: 10 }}>
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowInvite(!showInvite)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, fontWeight: 600 }}>
            <UserPlus size={16} /> Invite User
          </button>
        </div>
      </div>

      {/* Cybernetic Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid var(--border-primary)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative"
        }}>
          <div style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#22d3ee" }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Directory</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>{data.length}</div>
          </div>
        </div>

        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative"
        }}>
          <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Accounts</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399", marginTop: 2 }}>{active}</div>
          </div>
        </div>

        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative"
        }}>
          <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
            <UserX size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Suspended</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f87171", marginTop: 2 }}>{data.length - active}</div>
          </div>
        </div>

        <div style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
          border: "1px solid var(--border-primary)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative"
        }}>
          <div style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa" }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Security Roles</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>{new Set(data.map((u: any) => u.role?.name)).size}</div>
          </div>
        </div>
      </div>

      {/* Invite User Dialog Form */}
      {showInvite && (
        <div className="card" style={{
          marginBottom: 20, padding: 24, borderRadius: 16,
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(20, 26, 46, 0.95) 100%)",
          border: "1px solid var(--brand-500)",
          boxShadow: "0 8px 32px rgba(6, 182, 212, 0.15), inset 0 0 16px rgba(6, 182, 212, 0.02)",
          animation: "fadeIn 0.25s ease-out"
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <UserPlus size={18} style={{ color: "var(--brand-400)" }} /> Invite New Team Member
          </h3>
          <form onSubmit={handleInvite} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>First Name *</label>
              <input required placeholder="e.g. John" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                className="focus-glow" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Last Name *</label>
              <input required placeholder="e.g. Doe" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                className="focus-glow" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Email Address *</label>
              <input required type="email" placeholder="e.g. john.doe@acme.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                className="focus-glow" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Access Role Assignment *</label>
              <select required value={form.roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                className="focus-glow">
                <option value="">Select Security Role...</option>
                {roles
                  .filter((r: any) => {
                    const name = r.name.toLowerCase();
                    return name === "staff" || name === "employee" || name === "admin" || name === "tenant admin";
                  })
                  .map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowInvite(false)} style={{ borderRadius: 10, fontWeight: 600 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, fontWeight: 600 }}>
                <UserPlus size={15} /> Create User Profile
              </button>
            </div>
          </form>
          <style>{`
            .focus-glow:focus {
              border-color: var(--brand-400) !important;
              box-shadow: 0 0 10px rgba(6, 182, 212, 0.15);
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Directory Search Section */}
      <div className="card" style={{
        padding: "10px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center",
        borderRadius: 12, border: "1px solid var(--border-primary)", background: "var(--bg-card)"
      }}>
        <Search size={16} style={{ color: "var(--text-tertiary)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter directory by name, email, or department..."
          style={{ flex: 1, background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
      </div>

      {/* User Directory Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16 }}>
        {loading ? (
          <div className="card" style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)", gridColumn: "1 / -1", border: "1px solid var(--border-primary)" }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)", gridColumn: "1 / -1", border: "1px solid var(--border-primary)" }}>
            <Users size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>No directory records found</div>
            <p style={{ fontSize: 13 }}>No users match the active search filter.</p>
          </div>
        ) : (
          filtered.map((u: any) => {
            const gradient = getAvatarGradient(u.role?.name);
            const activeStatus = u.status === "ACTIVE";
            return (
              <div key={u.id} className="team-matrix-card" style={{
                cursor: "pointer", borderRadius: 16, border: "1px solid var(--border-primary)",
                background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 37, 64, 0.4) 100%)",
                padding: 20, transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
                onClick={() => setSelectedUser(u)}>
                
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                  {/* Glowing dynamic role-gradient avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 15, fontWeight: 800, flexShrink: 0,
                    boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
                  }}>
                    {u.firstName?.[0]}{u.lastName?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 750, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                      {u.firstName} {u.lastName}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, display: "flex", alignItems: "center", gap: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Mail size={11} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} /> <span>{u.email}</span>
                    </div>
                  </div>
                  <span className={`badge ${activeStatus ? "green" : "gray"}`} style={{
                    fontSize: 9, padding: "2px 8px", borderRadius: 6, fontWeight: 750, letterSpacing: "0.04em"
                  }}>{u.status}</span>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: "1px solid var(--border-primary)", paddingTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                    <Shield size={12} style={{ color: "var(--brand-400)", flexShrink: 0 }} />
                    <span className={`badge ${ROLE_COLORS[u.role?.name] || "gray"}`} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 5, fontWeight: 600 }}>{u.role?.name || "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", minWidth: 0 }}>
                    <Building size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.department?.name || "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", minWidth: 0 }}>
                    <MapPin size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.site?.name?.split(" - ")[1] || u.site?.name || "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                    <Clock size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                    <span>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Premium Detail Drawer Slide-In */}
      {selectedUser && (() => {
        const gradient = getAvatarGradient(selectedUser.role?.name);
        const activeStatus = selectedUser.status === "ACTIVE";
        return (
          <>
            {/* Backdrop Blur */}
            <div onClick={() => setSelectedUser(null)} style={{
              position: "fixed", inset: 0, background: "rgba(5, 7, 12, 0.65)", zIndex: 1000,
              backdropFilter: "blur(10px)", animation: "fadeInBlur 0.25s ease-out"
            }} />
            
            <div style={{
              position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px, 92vw)",
              background: "linear-gradient(180deg, #111827 0%, #0c0f1d 100%)",
              zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column",
              boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.6)",
              animation: "slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}>
              {/* Header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 16, fontWeight: 800,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                  }}>
                    {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{selectedUser.firstName} {selectedUser.lastName}</h2>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>{selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border-primary)",
                  borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s"
                }} className="btn-close-drawer">
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Content */}
              <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 6 }}>
                    Access & Affiliation
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <LRow label="Access Role" value={
                      <span className={`badge ${ROLE_COLORS[selectedUser.role?.name] || "gray"}`} style={{ padding: "3px 8px", borderRadius: 6, fontWeight: 650 }}>
                        {selectedUser.role?.name || "Employee"}
                      </span>
                    } />
                    <LRow label="Department" value={selectedUser.department?.name || "—"} />
                    <LRow label="Assigned Site" value={selectedUser.site?.name || "—"} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 6 }}>
                    Authentication Status
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <LRow label="Account Status" value={
                      <span className={`badge ${activeStatus ? "green" : "gray"}`} style={{ padding: "3px 8px", borderRadius: 6, fontWeight: 650 }}>
                        {selectedUser.status}
                      </span>
                    } />
                    <LRow label="MFA Verification" value={
                      selectedUser.mfaEnabled ? (
                        <span style={{ color: "#34d399", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <Check size={14} /> Verified MFA
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>Not configured</span>
                      )
                    } />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, borderBottom: "1px solid var(--border-primary)", paddingBottom: 6 }}>
                    System Timeline
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <LRow label="Last Activity" value={selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "Never active"} />
                    <LRow label="Member Since" value={new Date(selectedUser.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} />
                  </div>
                </div>

                {/* Info Block 5: Timestamps */}
                <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 16, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)" }}>
                  <span>User Record: {selectedUser.id.substring(0, 12)}...</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ padding: 20, borderTop: "1px solid var(--border-primary)", background: "rgba(0,0,0,0.1)" }}>
                <button style={{
                  width: "100%", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
                  background: activeStatus ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                  border: `1px solid ${activeStatus ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                  color: activeStatus ? "#f87171" : "#34d399", transition: "all 0.2s"
                }}
                  className="btn-status-toggle"
                  onClick={() => toggleUserStatus(selectedUser.id)}>
                  <Power size={14} />
                  {activeStatus ? "Suspend Account Access" : "Re-activate User Access"}
                </button>
              </div>
            </div>
            
            <style>{`
              @keyframes fadeInBlur {
                from { opacity: 0; backdrop-filter: blur(0); }
                to { opacity: 1; backdrop-filter: blur(10px); }
              }
              @keyframes slideInLeft {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
              .btn-close-drawer:hover {
                background: var(--bg-card-hover) !important;
                color: var(--text-primary) !important;
              }
              .btn-status-toggle:hover {
                background: ${activeStatus ? "rgba(239, 68, 68, 0.18)" : "rgba(16, 185, 129, 0.18)"} !important;
              }
            `}</style>
          </>
        );
      })()}

      <style>{`
        .team-matrix-card:hover {
          transform: translateY(-2px);
          border-color: rgba(6,182,212,0.25) !important;
          box-shadow: 0 6px 20px rgba(0,0,0,0.25), 0 0 12px rgba(6,182,212,0.02);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

function LRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>{label}</span>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
        {typeof value === "string" || typeof value === "number" ? value : value}
      </div>
    </div>
  );
}
