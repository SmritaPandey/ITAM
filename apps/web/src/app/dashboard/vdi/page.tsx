"use client";
import { useEffect, useState } from "react";
import {
  Monitor, Cpu, MemoryStick, Power, CheckCircle2, RefreshCw, Loader2, AlertTriangle, Trash2, Search
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { apiFetch } from "@/lib/api";
import SafeChart from "@/components/SafeChart";

export default function VDIPage() {
  const [data, setData] = useState<any>({ data: [], total: 0, running: 0, stopped: 0, avgCpu: 0, avgRam: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedVM, setSelectedVM] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // New VM Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vmName, setVmName] = useState("");
  const [os, setOs] = useState("Ubuntu 24.04 LTS");
  const [host, setHost] = useState("mumbai-hvy-01.qs.internal");
  const [cpu, setCpu] = useState(4);
  const [ram, setRam] = useState(8);
  const [disk, setDisk] = useState(80);
  const [purpose, setPurpose] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleDeleteVM(id: string) {
    if (!confirm("Delete this VM?")) return;
    try {
      await apiFetch(`/monitoring/devices/${id}`, { method: "DELETE" });
      setSelectedVM(null);
      refresh();
    } catch {
      alert("Failed to delete VM.");
    }
  }

  function refresh() {
    apiFetch("/monitoring/vdi").then(setData).catch(console.error).finally(() => setLoading(false));
  }
  useEffect(() => { refresh(); }, []);

  async function handleCreateVM(e: React.FormEvent) {
    e.preventDefault();
    if (!vmName.trim()) {
      setError("VM Name is required");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await apiFetch("/monitoring/devices", {
        method: "POST",
        body: JSON.stringify({
          name: vmName,
          type: "VIRTUAL_MACHINE",
          location: host,
          config: {
            os,
            host,
            purpose,
            vcpus: cpu,
            ramMb: ram * 1024,
            diskGb: disk,
            user: "Unassigned"
          },
        })
      });
      setIsModalOpen(false);
      // Reset form
      setVmName("");
      setPurpose("");
      setCpu(4);
      setRam(8);
      setDisk(80);
      refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to provision VM. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  const vms = data.data || [];

  // Build host-level resource usage from VMs
  const hostMap: Record<string, { cpu: number; ram: number; vms: number }> = {};
  vms.forEach((vm: any) => {
    const host = (vm.config as any)?.host || vm.location || "Unknown";
    if (!hostMap[host]) hostMap[host] = { cpu: 0, ram: 0, vms: 0 };
    hostMap[host].vms++;
    if (vm.status === "ONLINE") {
      hostMap[host].cpu += (vm.metrics as any)?.cpu || 0;
      hostMap[host].ram += (vm.metrics as any)?.ram || 0;
    }
  });
  const resourceUsage = Object.entries(hostMap).map(([host, v]) => ({
    host, cpu: v.vms > 0 ? Math.round(v.cpu / v.vms) : 0, ram: v.vms > 0 ? Math.round(v.ram / v.vms) : 0, vms: v.vms,
  }));

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Virtual Desktop Infrastructure</h1>
          <p className="page-subtitle">{data.total} virtual machines across {resourceUsage.length} hosts</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={14} /> Sync</button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}><Power size={14} /> New VM</button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: "8px 14px" }}>
          <Search size={15} style={{ color: "var(--text-tertiary)" }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by VM name or host..."
            style={{ width: "100%", background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card"><div className="stat-icon cyan"><Monitor size={22} /></div><div className="stat-content"><div className="stat-label">Total VMs</div><div className="stat-value">{data.total}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={22} /></div><div className="stat-content"><div className="stat-label">Running</div><div className="stat-value">{data.running}</div></div></div>
        <div className="stat-card"><div className="stat-icon amber"><Cpu size={22} /></div><div className="stat-content"><div className="stat-label">Avg CPU</div><div className="stat-value">{data.avgCpu}%</div></div></div>
        <div className="stat-card"><div className="stat-icon purple"><MemoryStick size={22} /></div><div className="stat-content"><div className="stat-label">Avg RAM</div><div className="stat-value">{data.avgRam}%</div></div></div>
      </div>

      {/* Host Resources */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title">Host Resource Utilization</div></div>
        <SafeChart height={180}>
<BarChart data={resourceUsage} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,49,80,0.5)" vertical={false} />
              <XAxis dataKey="host" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1f35", border: "1px solid #2a3150", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cpu" fill="#06b6d4" radius={[4, 4, 0, 0]} name="CPU %" />
              <Bar dataKey="ram" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="RAM %" />
            </BarChart>
</SafeChart>
      </div>

      {/* VM Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr><th>VM Name</th><th>OS</th><th>Status</th><th>CPU</th><th>RAM</th><th>Disk</th><th>Host</th><th>Uptime</th><th>User</th></tr>
          </thead>
          <tbody>
            {(() => {
              const q = searchQuery.toLowerCase();
              const filteredVMs = vms.filter((vm: any) => {
                if (!q) return true;
                const cfg = vm.config || {};
                return vm.name?.toLowerCase().includes(q) ||
                       (cfg.host || vm.location || "").toLowerCase().includes(q);
              });
              if (filteredVMs.length === 0) return (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                  <Monitor size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{searchQuery ? "No matching virtual machines" : "No virtual machines configured yet"}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{searchQuery ? "Try adjusting your search query." : "Click New VM to provision a virtual desktop."}</div>
                </td></tr>
              );
              return filteredVMs.map((vm: any) => {
                const cfg = vm.config || {};
                const met = vm.metrics || {};
                return (
                  <tr key={vm.id} style={{ cursor: "pointer" }} onClick={() => setSelectedVM(vm)}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{vm.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{cfg.purpose || "—"}</div>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{cfg.os || "—"}</td>
                    <td><span className={`badge ${vm.status === "ONLINE" ? "green" : "gray"}`}>{vm.status === "ONLINE" ? "Running" : "Stopped"}</span></td>
                    <td><UsageBar value={met.cpu || 0} /></td>
                    <td><UsageBar value={met.ram || 0} /></td>
                    <td><UsageBar value={met.disk || 0} /></td>
                    <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{cfg.host || vm.location || "—"}</td>
                    <td style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{met.uptime || "—"}</td>
                    <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{cfg.user || "—"}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {selectedVM && (() => {
        const cfg = selectedVM.config || {};
        const met = selectedVM.metrics || {};
        return (
          <>
            <div onClick={() => setSelectedVM(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 92vw)", background: "var(--bg-card)", zIndex: 1001, borderLeft: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selectedVM.name}</h2>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{cfg.os || "Virtual Machine"} • {cfg.host || "Unknown Host"}</p>
                </div>
                <button onClick={() => setSelectedVM(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <VRow label="Status" value={<span className={`badge ${selectedVM.status === "ONLINE" ? "green" : "gray"}`}>{selectedVM.status === "ONLINE" ? "Running" : "Stopped"}</span>} />
                  <VRow label="Operating System" value={cfg.os || "—"} />
                  <VRow label="Purpose" value={cfg.purpose || "—"} />
                  <VRow label="Assigned User" value={cfg.user || cfg.assignedUser || "Unassigned"} />
                  <VRow label="Host Server" value={cfg.host || selectedVM.location || "—"} />
                  <VRow label="Pool" value={cfg.pool || "Default"} />
                  <VRow label="IP Address" value={selectedVM.ipAddress || "—"} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, borderBottom: "1px solid var(--border-primary)", paddingBottom: 4 }}>Resources</div>
                  <VRow label="CPU Usage" value={<UsageBar value={met.cpu || 0} />} />
                  <VRow label="RAM Usage" value={<UsageBar value={met.ram || 0} />} />
                  <VRow label="Disk Usage" value={<UsageBar value={met.disk || 0} />} />
                  <VRow label="vCPUs" value={cfg.vcpus || "—"} />
                  <VRow label="RAM Allocated" value={cfg.ramMb ? `${cfg.ramMb} MB` : "—"} />
                  <VRow label="Disk Allocated" value={cfg.diskGb ? `${cfg.diskGb} GB` : "—"} />
                  <VRow label="Uptime" value={met.uptime || "—"} />
                  <VRow label="Last Seen" value={selectedVM.lastSeen ? new Date(selectedVM.lastSeen).toLocaleString() : "Never"} />
                </div>
                <div style={{ marginTop: 20 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#ef4444", borderColor: "rgba(239,68,68,0.3)", fontSize: 13, fontWeight: 600 }}
                    onClick={() => handleDeleteVM(selectedVM.id)}
                  >
                    <Trash2 size={14} /> Delete VM
                  </button>
                </div>
              </div>
            </div>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
          </>
        );
      })()}

      {isModalOpen && (
        <>
          <div onClick={() => setIsModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", zIndex: 1001, overflow: "hidden", backdropFilter: "blur(12px)" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Provision New Virtual Desktop VM</h2>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ padding: "3px 8px" }}>✕</button>
            </div>
            <form onSubmit={handleCreateVM} style={{ padding: 20 }}>
              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, color: "#ef4444" }}>
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
              
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>VM Name</label>
                  <input type="text" value={vmName} onChange={e => setVmName(e.target.value)} placeholder="e.g. dev-workstation-05"
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Operating System</label>
                    <select value={os} onChange={e => setOs(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                      <option value="Ubuntu 24.04 LTS">Ubuntu 24.04 LTS</option>
                      <option value="Windows Server 2022">Windows Server 2022</option>
                      <option value="Debian 12">Debian 12</option>
                      <option value="Rocky Linux 9">Rocky Linux 9</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Hypervisor Host</label>
                    <select value={host} onChange={e => setHost(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                      <option value="mumbai-hvy-01.qs.internal">mumbai-hvy-01.qs.internal</option>
                      <option value="mumbai-hvy-02.qs.internal">mumbai-hvy-02.qs.internal</option>
                      <option value="delhi-hvy-01.qs.internal">delhi-hvy-01.qs.internal</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>vCPU Cores</label>
                    <select value={cpu} onChange={e => setCpu(Number(e.target.value))}
                      style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                      <option value={2}>2 Cores</option>
                      <option value={4}>4 Cores</option>
                      <option value={8}>8 Cores</option>
                      <option value={16}>16 Cores</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>RAM Allocation</label>
                    <select value={ram} onChange={e => setRam(Number(e.target.value))}
                      style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                      <option value={4}>4 GB</option>
                      <option value={8}>8 GB</option>
                      <option value={16}>16 GB</option>
                      <option value={32}>32 GB</option>
                      <option value={64}>64 GB</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Disk Size</label>
                    <select value={disk} onChange={e => setDisk(Number(e.target.value))}
                      style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                      <option value={40}>40 GB</option>
                      <option value={80}>80 GB</option>
                      <option value={160}>160 GB</option>
                      <option value={320}>320 GB</option>
                      <option value={640}>640 GB</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Purpose / Description</label>
                  <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={2} placeholder="e.g. Core banking application development and testing sandbox..."
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Provisioning...</> : <><Power size={14} /> Provision VM</>}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}

function UsageBar({ value }: { value: number }) {
  const color = value > 80 ? "#ef4444" : value > 60 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 50, height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--text-tertiary)", minWidth: 28 }}>{value}%</span>
    </div>
  );
}

function VRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{typeof value === "string" ? value : value}</span>
    </div>
  );
}
