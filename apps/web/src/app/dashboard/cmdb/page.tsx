"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Search, ZoomIn, ZoomOut, Maximize2, Activity, Package, Server, Monitor, Printer, Wifi, Truck, Armchair } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }

interface Node { id: string; name: string; type: string; status: string; x: number; y: number; vx: number; vy: number; }
interface Edge { from: string; to: string; label: string; }

const TYPE_COLORS: Record<string, string> = {
  Laptop: "#6366f1", Server: "#8b5cf6", Printer: "#a855f7",
  Switch: "#06b6d4", "Network Device": "#0ea5e9", Vehicle: "#10b981",
  Furniture: "#f97316", Hardware: "#3b82f6", "Facility Asset": "#f59e0b",
};

const TYPE_ICONS: Record<string, string> = {
  Laptop: "💻", Server: "🖥️", Printer: "🖨️", Switch: "🔗",
  "Network Device": "📡", Vehicle: "🚗", Furniture: "🪑", Hardware: "⚙️",
};

export default function CMDBPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; panStartX: number; panStartY: number }>({ dragging: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0 });
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);

  useEffect(() => {
    fetch(`${API}/assets?limit=50`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => {
        setAssets(d.data || []);
        buildGraph(d.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function buildGraph(assetData: any[]) {
    const cx = 400, cy = 300;
    const newNodes: Node[] = assetData.map((a, i) => {
      const angle = (2 * Math.PI * i) / assetData.length;
      const radius = 140 + Math.random() * 80;
      return {
        id: a.id,
        name: a.name,
        type: a.assetType?.name || "Unknown",
        status: a.status,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0, vy: 0,
      };
    });

    // Build edges: connect assets in same department/site + network relationships
    const newEdges: Edge[] = [];
    for (let i = 0; i < assetData.length; i++) {
      for (let j = i + 1; j < assetData.length; j++) {
        const a = assetData[i], b = assetData[j];
        if (a.siteId && a.siteId === b.siteId && a.departmentId === b.departmentId) {
          newEdges.push({ from: a.id, to: b.id, label: "same-dept" });
        } else if (a.siteId && a.siteId === b.siteId) {
          newEdges.push({ from: a.id, to: b.id, label: "same-site" });
        }
        // Network adjacency: similar IP subnets
        if (a.ipAddress && b.ipAddress) {
          const subA = a.ipAddress.split(".").slice(0, 3).join(".");
          const subB = b.ipAddress.split(".").slice(0, 3).join(".");
          if (subA === subB && !newEdges.find(e => (e.from === a.id && e.to === b.id))) {
            newEdges.push({ from: a.id, to: b.id, label: "network" });
          }
        }
      }
    }

    setNodes(newNodes);
    nodesRef.current = newNodes;
    setEdges(newEdges);
  }

  // Simple force-directed simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    let running = true;
    const iterate = () => {
      if (!running) return;
      const ns = [...nodesRef.current];
      const k = 0.01; // spring constant
      const repulsion = 8000;
      const damping = 0.85;
      const cx = 400, cy = 300;

      // Repulsion between all nodes
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = repulsion / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          ns[i].vx -= fx; ns[i].vy -= fy;
          ns[j].vx += fx; ns[j].vy += fy;
        }
      }

      // Spring attraction along edges
      for (const edge of edges) {
        const a = ns.find(n => n.id === edge.from);
        const b = ns.find(n => n.id === edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ideal = 180;
        const force = (dist - ideal) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Center gravity
      for (const n of ns) {
        n.vx += (cx - n.x) * 0.001;
        n.vy += (cy - n.y) * 0.001;
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;
      }

      nodesRef.current = ns;
      setNodes([...ns]);
      animRef.current = requestAnimationFrame(iterate);
    };

    // Run for 120 frames then stop
    let frame = 0;
    const limitedIterate = () => {
      if (!running || frame > 120) return;
      iterate();
      frame++;
    };
    const interval = setInterval(limitedIterate, 16);

    return () => { running = false; clearInterval(interval); cancelAnimationFrame(animRef.current); };
  }, [edges]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    for (const edge of edges) {
      const a = nodes.find(n => n.id === edge.from);
      const b = nodes.find(n => n.id === edge.to);
      if (!a || !b) continue;

      const isHighlighted = selectedNode && (selectedNode.id === a.id || selectedNode.id === b.id);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isHighlighted
        ? (edge.label === "network" ? "#06b6d4" : "#8b5cf6")
        : "rgba(100,116,139,0.15)";
      ctx.lineWidth = isHighlighted ? 2 : 0.8;
      if (edge.label === "network") ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw nodes
    for (const node of nodes) {
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isConnected = selectedNode && edges.some(
        e => (e.from === selectedNode.id && e.to === node.id) || (e.to === selectedNode.id && e.from === node.id)
      );
      const isDimmed = selectedNode && !isSelected && !isConnected;

      const color = TYPE_COLORS[node.type] || "#64748b";
      const radius = isSelected ? 28 : isHovered ? 24 : 20;

      // Glow
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = `${color}20`;
        ctx.fill();
      }

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isDimmed ? `${color}30` : color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#ffffff" : `${color}60`;
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.stroke();

      // Icon
      ctx.fillStyle = isDimmed ? "rgba(255,255,255,0.3)" : "#ffffff";
      ctx.font = `${isSelected ? 16 : 13}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(TYPE_ICONS[node.type] || "📦", node.x, node.y);

      // Label
      ctx.fillStyle = isDimmed ? "rgba(148,163,184,0.3)" : "rgba(241,245,249,0.9)";
      ctx.font = `${isSelected ? 12 : 10}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(node.name.length > 16 ? node.name.slice(0, 14) + "…" : node.name, node.x, node.y + radius + 14);
    }

    ctx.restore();
  }, [nodes, edges, selectedNode, hoveredNode, zoom, pan]);

  // Mouse events
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;

    const clicked = nodes.find(n => {
      const dx = n.x - mx, dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < 24;
    });
    setSelectedNode(clicked || null);
  }, [nodes, zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current.dragging) {
      setPan({
        x: dragRef.current.panStartX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.panStartY + (e.clientY - dragRef.current.startY),
      });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;

    const hovered = nodes.find(n => {
      const dx = n.x - mx, dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < 24;
    });
    setHoveredNode(hovered || null);
    canvas.style.cursor = hovered ? "pointer" : "grab";
  }, [nodes, zoom, pan]);

  const filteredTypes = [...new Set(nodes.map(n => n.type))];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">CMDB Topology</h1>
          <p className="page-subtitle">{nodes.length} assets • {edges.length} relationships mapped</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setZoom(z => Math.min(z + 0.2, 3))}><ZoomIn size={14} /></button>
          <button className="btn btn-secondary" onClick={() => setZoom(z => Math.max(z - 0.2, 0.3))}><ZoomOut size={14} /></button>
          <button className="btn btn-secondary" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedNode(null); }}><Maximize2 size={14} /> Reset</button>
        </div>
      </div>

      {/* Legend */}
      <div className="card" style={{ marginBottom: 16, padding: "10px 16px" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>LEGEND:</span>
          {filteredTypes.map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: TYPE_COLORS[t] || "#64748b", display: "inline-block" }} />
              {TYPE_ICONS[t] || "📦"} {t}
            </div>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)" }}>
            — solid = same dept &nbsp; ┄ dashed = network
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
        {/* Canvas */}
        <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 500, color: "var(--text-tertiary)" }}>
              <Activity size={24} style={{ animation: "spin 2s linear infinite" }} />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{ width: "100%", height: 500, cursor: "grab" }}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseDown={e => { dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, panStartX: pan.x, panStartY: pan.y }; }}
              onMouseUp={() => { dragRef.current.dragging = false; }}
              onMouseLeave={() => { dragRef.current.dragging = false; setHoveredNode(null); }}
            />
          )}
        </div>

        {/* Details Panel */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {selectedNode ? (
            <>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">{selectedNode.name}</div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <DetailRow label="Type" value={<span className="badge cyan">{selectedNode.type}</span>} />
                  <DetailRow label="Status" value={<span className={`badge ${selectedNode.status === "ACTIVE" ? "green" : "gray"}`}>{selectedNode.status}</span>} />
                  <DetailRow label="Connections" value={String(edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length)} />
                </div>
              </div>
              <div className="card">
                <div className="card-header"><div className="card-title">Connected Assets</div></div>
                <div style={{ display: "grid", gap: 6 }}>
                  {edges
                    .filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
                    .map(e => {
                      const otherId = e.from === selectedNode.id ? e.to : e.from;
                      const other = nodes.find(n => n.id === otherId);
                      if (!other) return null;
                      return (
                        <div key={e.from + e.to} onClick={() => setSelectedNode(other)} style={{
                          padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: 6,
                          border: "1px solid var(--border-primary)", cursor: "pointer",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{other.name}</div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{other.type}</div>
                          </div>
                          <span className="badge gray" style={{ fontSize: 9 }}>{e.label}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <Package size={32} style={{ color: "var(--text-tertiary)", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Select an Asset</div>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Click a node on the graph to view its details and relationships</p>
            </div>
          )}

          {/* Stats */}
          <div className="card">
            <div className="card-header"><div className="card-title">Graph Stats</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              <DetailRow label="Total Nodes" value={String(nodes.length)} />
              <DetailRow label="Total Edges" value={String(edges.length)} />
              <DetailRow label="Asset Types" value={String(filteredTypes.length)} />
              <DetailRow label="Avg Connections" value={nodes.length > 0 ? (edges.length * 2 / nodes.length).toFixed(1) : "0"} />
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>
        {typeof value === "string" ? value : value}
      </span>
    </div>
  );
}
