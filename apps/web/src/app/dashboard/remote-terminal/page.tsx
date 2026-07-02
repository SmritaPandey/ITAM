"use client";
import { useState, useEffect, useRef } from "react";
import {
  Terminal, Send, Loader2, ChevronDown, Clock, AlertTriangle,
  CheckCircle2, XCircle, Trash2, Monitor, Server,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function RemoteTerminalPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/discovery/agents")
      .then((data) => {
        const agentList = (data.agents || data || []).filter((a: any) => a.status === "ONLINE" || a.lastHeartbeat);
        setAgents(agentList);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function loadHistory(agentId: string) {
    try {
      const data = await apiFetch(`/discovery/agents/${agentId}/command-history`);
      setHistory(data.history || []);
      setPending(data.pending || []);
    } catch {
      setHistory([]);
      setPending([]);
    }
  }

  function selectAgent(agent: any) {
    setSelectedAgent(agent);
    loadHistory(agent.id);
  }

  async function sendCommand() {
    if (!command.trim() || !selectedAgent) return;
    setSending(true);
    try {
      const result = await apiFetch(`/discovery/agents/${selectedAgent.id}/remote-command`, {
        method: "POST",
        body: JSON.stringify({ command: command.trim(), timeout: 30000 }),
      });
      setPending((prev) => [...prev, { command: command.trim(), queuedAt: new Date().toISOString(), status: "QUEUED" }]);
      setCommand("");
    } catch (err: any) {
      setHistory((prev) => [...prev, { command: command.trim(), output: `Error: ${err.message}`, exitCode: -1, executedAt: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  }

  function refreshHistory() {
    if (selectedAgent) loadHistory(selectedAgent.id);
  }

  // Auto-scroll on new history
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history, pending]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Terminal size={22} style={{ color: "var(--brand-400)" }} /> Remote Terminal
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
          Execute commands on managed endpoints remotely. Commands are queued and executed on the next agent heartbeat.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, height: "calc(100vh - 200px)" }}>
        {/* Agent List */}
        <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary)", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
            <Server size={13} style={{ verticalAlign: "middle", marginRight: 6 }} /> Online Agents ({agents.length})
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => selectAgent(agent)}
                style={{
                  padding: "10px 16px", cursor: "pointer",
                  borderBottom: "1px solid var(--border-primary)",
                  background: selectedAgent?.id === agent.id ? "var(--bg-elevated)" : undefined,
                  borderLeft: selectedAgent?.id === agent.id ? "3px solid var(--brand-400)" : "3px solid transparent",
                  transition: "all 0.1s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: agent.status === "ONLINE" ? "#10b981" : "#6b7280",
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {agent.hostname || agent.name || agent.id.slice(0, 8)}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: 16, marginTop: 2 }}>
                  {agent.os || agent.platform || "Unknown"} · {agent.ipAddress || "No IP"}
                </div>
              </div>
            ))}
            {agents.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
                No agents online
              </div>
            )}
          </div>
        </div>

        {/* Terminal */}
        <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {selectedAgent ? (
            <>
              {/* Terminal header */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                    {selectedAgent.hostname || selectedAgent.name} — Remote Terminal
                  </span>
                </div>
                <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 10 }} onClick={refreshHistory}>
                  Refresh
                </button>
              </div>

              {/* Output area */}
              <div ref={outputRef} style={{
                flex: 1, overflowY: "auto", padding: 16, fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                fontSize: 12, lineHeight: 1.6, background: "rgba(0,0,0,0.3)", color: "#e5e7eb",
              }}>
                {/* Welcome message */}
                <div style={{ color: "#6b7280", marginBottom: 16 }}>
                  <div>QS Asset Remote Terminal v1.0</div>
                  <div>Connected to: {selectedAgent.hostname || selectedAgent.name}</div>
                  <div>Commands are queued and execute on the next agent heartbeat (~60s)</div>
                  <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", margin: "8px 0" }} />
                </div>

                {/* Command history */}
                {history.map((entry, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ color: "#10b981" }}>
                      <span style={{ color: "#6366f1" }}>$</span> {entry.command}
                      <span style={{ color: "#6b7280", marginLeft: 8, fontSize: 10 }}>
                        [{entry.executedAt ? new Date(entry.executedAt).toLocaleTimeString() : ""}]
                      </span>
                    </div>
                    <pre style={{
                      margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-all",
                      color: entry.exitCode === 0 ? "#d1d5db" : "#f87171",
                      padding: "4px 0", borderLeft: `2px solid ${entry.exitCode === 0 ? "#374151" : "#7f1d1d"}`, paddingLeft: 8,
                    }}>
                      {entry.output || "(no output)"}
                    </pre>
                    {entry.exitCode !== 0 && entry.exitCode !== undefined && (
                      <span style={{ fontSize: 10, color: "#f87171" }}>Exit code: {entry.exitCode}</span>
                    )}
                  </div>
                ))}

                {/* Pending commands */}
                {pending.map((entry, i) => (
                  <div key={`p-${i}`} style={{ marginBottom: 12, opacity: 0.6 }}>
                    <div style={{ color: "#f59e0b" }}>
                      <span style={{ color: "#6366f1" }}>$</span> {entry.command}
                      <Loader2 size={10} style={{ animation: "spin 1s linear infinite", marginLeft: 6, verticalAlign: "middle" }} />
                      <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 6 }}>Queued — awaiting next heartbeat</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Command input */}
              <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-primary)", display: "flex", gap: 8, background: "rgba(0,0,0,0.2)" }}>
                <span style={{ color: "#6366f1", fontFamily: "monospace", fontSize: 14, lineHeight: "32px" }}>$</span>
                <input
                  type="text" value={command} onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendCommand(); }}
                  placeholder="Type a command... (e.g., hostname, df -h, systeminfo)"
                  style={{
                    flex: 1, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-primary)",
                    background: "transparent", color: "#e5e7eb", fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 13,
                  }}
                  autoFocus
                />
                <button className="btn btn-primary" style={{ padding: "6px 14px" }} onClick={sendCommand} disabled={!command.trim() || sending}>
                  {sending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                </button>
              </div>

              {/* Security note */}
              <div style={{ padding: "6px 16px", background: "rgba(245,158,11,0.08)", borderTop: "1px solid rgba(245,158,11,0.15)", fontSize: 10, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={10} /> Dangerous commands (rm -rf /, format c:, mkfs) are automatically blocked by the agent security policy.
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)" }}>
              <div style={{ textAlign: "center" }}>
                <Terminal size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 500 }}>Select an agent to start</p>
                <p style={{ fontSize: 12 }}>Choose an online agent from the left panel</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
