"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, ZoomIn, ZoomOut, Maximize2, Activity, Package, Server, Monitor, 
  Printer, Wifi, Shield, Ticket, Database, ExternalLink, RefreshCw, Layers,
  Cpu, HardDrive, AlertTriangle, CheckCircle2, Info, Network, ArrowRight
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Node { 
  id: string; 
  name: string; 
  type: string; 
  ip?: string;
  status: string; 
  cpu: number; 
  memory: number; 
  interfaces: number;
  sysName?: string;
  x: number; 
  y: number; 
  vx: number; 
  vy: number; 
  fx?: number | null;
  fy?: number | null;
}

interface Link { 
  source: string; 
  target: string; 
  bandwidth: string;
  utilization: number;
  localPort?: string;
  remotePort?: string;
  discoverySource?: string;
}

const TYPE_COLORS: Record<string, string> = {
  "Core Switch": "#0ea5e9",
  "Switch": "#06b6d4",
  "Firewall": "#ef4444",
  "Router": "#f59e0b",
  "Virtual Server": "#a855f7",
  "Database Server": "#10b981",
  "NAS Storage": "#8b5cf6",
  "Printer": "#ec4899",
  "Laptop": "#6366f1",
  "Server": "#8b5cf6",
  "Unknown": "#64748b"
};

const TYPE_ICONS: Record<string, string> = {
  "Core Switch": "🔌",
  "Switch": "🔗",
  "Firewall": "🛡️",
  "Router": "📡",
  "Virtual Server": "🖥️",
  "Database Server": "🗄️",
  "NAS Storage": "💾",
  "Printer": "🖨️",
  "Laptop": "💻",
  "Server": "🖥️",
};

export default function CMDBPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; panStartX: number; panStartY: number }>({ 
    dragging: false, 
    startX: 0, 
    startY: 0, 
    panStartX: 0, 
    panStartY: 0 
  });
  const activeDragNodeRef = useRef<Node | null>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);

  // Fetch from real NestJS SNMP autodiscovery API
  const fetchTopology = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const data = await apiFetch("/monitoring/network/topology");
      if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
        // Resolve positions
        const resolvedNodes: Node[] = data.nodes.map((n: any, idx: number) => {
          const angle = (idx / data.nodes.length) * 2 * Math.PI;
          const radius = 200;
          return {
            id: n.id,
            name: n.name,
            type: n.type || "Switch",
            ip: n.ip || "",
            status: n.status || "ACTIVE",
            cpu: n.cpu || 0,
            memory: n.memory || 0,
            interfaces: n.interfaces || 0,
            sysName: n.sysName || "",
            x: n.x ?? (400 + radius * Math.cos(angle)),
            y: n.y ?? (300 + radius * Math.sin(angle)),
            vx: 0,
            vy: 0,
          };
        });

        setNodes(resolvedNodes);
        nodesRef.current = resolvedNodes;
        setLinks(data.links || []);
      } else {
        setNodes([]);
        nodesRef.current = [];
        setLinks([]);
      }
    } catch (err) {
      console.warn("Could not fetch real topology: ", err);
      setNodes([]);
      nodesRef.current = [];
      setLinks([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  // Continuous physics engine simulation step in requestAnimationFrame
  useEffect(() => {
    if (nodes.length === 0) return;

    let running = true;
    const iterate = () => {
      if (!running) return;

      const ns = [...nodesRef.current];
      const k = 0.015; // spring constant
      const repulsion = 14000;
      const damping = 0.82;
      const cx = 380, cy = 250;

      // 1. Repulsion between all node pairs
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          if (dist < 320) {
            const force = repulsion / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (ns[i].fx === undefined || ns[i].fx === null) { ns[i].vx -= fx; ns[i].vy -= fy; }
            if (ns[j].fx === undefined || ns[j].fx === null) { ns[j].vx += fx; ns[j].vy += fy; }
          }
        }
      }

      // 2. Spring attraction along mapped links
      for (const link of links) {
        const a = ns.find(n => n.id === link.source);
        const b = ns.find(n => n.id === link.target);
        if (!a || !b) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const ideal = 150;
        const force = (dist - ideal) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (a.fx === undefined || a.fx === null) { a.vx += fx; a.vy += fy; }
        if (b.fx === undefined || b.fx === null) { b.vx -= fx; b.vy -= fy; }
      }

      // 3. Gravity attraction toward canvas center & apply velocities
      for (const n of ns) {
        if (n.fx !== undefined && n.fx !== null && n.fy !== undefined && n.fy !== null) {
          n.x = n.fx;
          n.y = n.fy;
          n.vx = 0;
          n.vy = 0;
        } else {
          n.vx += (cx - n.x) * 0.001;
          n.vy += (cy - n.y) * 0.001;
          n.vx *= damping;
          n.vy *= damping;
          n.x += n.vx;
          n.y += n.vy;
        }
      }

      nodesRef.current = ns;
      setNodes([...ns]);
      animRef.current = requestAnimationFrame(iterate);
    };

    animRef.current = requestAnimationFrame(iterate);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [links, nodes.length]);

  // Canvas drawing loop (handles particles, wires, neon glows, grid background)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI Retina displays
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw beautiful cyberpunk background mesh matrix
    ctx.strokeStyle = "rgba(6, 182, 212, 0.04)";
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    const gridCols = Math.ceil(width * 2 / gridSpacing);
    const gridRows = Math.ceil(height * 2 / gridSpacing);
    // Draw offset to cover zoomed/panned viewports
    const startX = -Math.abs(pan.x) - 400;
    const startY = -Math.abs(pan.y) - 400;

    for (let c = 0; c < gridCols * 2; c++) {
      ctx.beginPath();
      ctx.moveTo(startX + c * gridSpacing, startY);
      ctx.lineTo(startX + c * gridSpacing, startY + gridRows * gridSpacing * 2);
      ctx.stroke();
    }
    for (let r = 0; r < gridRows * 2; r++) {
      ctx.beginPath();
      ctx.moveTo(startX, startY + r * gridSpacing);
      ctx.lineTo(startX + gridCols * gridSpacing * 2, startY + r * gridSpacing);
      ctx.stroke();
    }

    // 2. Draw connections (Wires) & glowing telemetry pulse particles
    const time = Date.now();
    for (const link of links) {
      const a = nodes.find(n => n.id === link.source);
      const b = nodes.find(n => n.id === link.target);
      if (!a || !b) continue;

      const isHighlighted = selectedNode && (selectedNode.id === a.id || selectedNode.id === b.id);
      
      // Draw copper line
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);

      let strokeColor = "rgba(71, 85, 105, 0.2)";
      if (isHighlighted) {
        strokeColor = link.utilization > 80 ? "rgba(239, 68, 68, 0.8)" : "rgba(6, 182, 212, 0.8)";
      } else {
        strokeColor = link.utilization > 80 ? "rgba(239, 68, 68, 0.3)" : "rgba(6, 182, 212, 0.3)";
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isHighlighted ? 3.5 : 2.0;

      // Outer glow for wire links
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = isHighlighted ? 12 : 3;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset blur

      // Draw flowing neon particle pulses
      // Speed scales dynamically with physical SNMP port speed (bandwidth)
      let speedFactor = 0.0006;
      if (link.bandwidth.toLowerCase().includes("10gbps")) {
        speedFactor = 0.0024;
      } else if (link.bandwidth.toLowerCase().includes("1gbps")) {
        speedFactor = 0.0012;
      } else if (link.bandwidth.toLowerCase().includes("100mbps")) {
        speedFactor = 0.0004;
      }

      // Density (number of active flowing particles) scales with link utilization percentage
      const particlesCount = Math.max(1, Math.min(5, Math.ceil(link.utilization / 20)));

      for (let pIdx = 0; pIdx < particlesCount; pIdx++) {
        const offset = pIdx / particlesCount;
        const progress = ((time * speedFactor) + offset) % 1.0;

        const px = a.x + (b.x - a.x) * progress;
        const py = a.y + (b.y - a.y) * progress;

        const pColor = link.utilization > 80 ? "#ef4444" : link.utilization > 50 ? "#f59e0b" : "#22d3ee";

        ctx.beginPath();
        ctx.arc(px, py, isHighlighted ? 4.5 : 3.0, 0, Math.PI * 2);
        ctx.fillStyle = pColor;
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 3. Draw Nodes (glowing status rings, interactive colors, icons)
    for (const node of nodes) {
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isDimmed = selectedNode && !isSelected && !links.some(
        l => (l.source === selectedNode.id && l.target === node.id) || (l.target === selectedNode.id && l.source === node.id)
      );

      const color = TYPE_COLORS[node.type] || "#64748b";
      const radius = isSelected ? 26 : isHovered ? 23 : 20;

      // Pulse ring animation for ACTIVE monitored devices
      if (node.status === "ACTIVE" && !isDimmed) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.15 + Math.sin(time / 220) * 0.07})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Outer radial glow for selection or hover
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? `${color}25` : `${color}15`;
        ctx.fill();
      }

      // Main circle fill
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isDimmed ? "rgba(30, 41, 59, 0.4)" : "#0f172a";
      ctx.fill();

      // Colored border ring
      ctx.strokeStyle = isDimmed ? "rgba(71, 85, 105, 0.2)" : color;
      ctx.lineWidth = isSelected ? 3.0 : 2.0;
      ctx.stroke();

      // Draw centered icon (Emoji or Text)
      ctx.fillStyle = isDimmed ? "rgba(255, 255, 255, 0.2)" : "#ffffff";
      ctx.font = `${radius * 0.75}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(TYPE_ICONS[node.type] || "📦", node.x, node.y + (radius * 0.05));

      // Draw text label (Hostname/IP)
      ctx.fillStyle = isDimmed ? "rgba(148, 163, 184, 0.3)" : "rgba(241, 245, 249, 0.95)";
      ctx.font = `bold ${isSelected ? 12 : 10.5}px 'Plus Jakarta Sans', system-ui`;
      ctx.textAlign = "center";
      
      const nodeLabel = node.name.length > 15 ? node.name.slice(0, 13) + "…" : node.name;
      ctx.fillText(nodeLabel, node.x, node.y + radius + 15);

      // Subtle IP Label underneath hostname
      if (node.ip && !isDimmed) {
        ctx.fillStyle = isDimmed ? "rgba(148, 163, 184, 0.15)" : "rgba(148, 163, 184, 0.6)";
        ctx.font = "9px monospace";
        ctx.fillText(node.ip, node.x, node.y + radius + 25);
      }
    }

    ctx.restore();
  }, [nodes, links, selectedNode, hoveredNode, zoom, pan]);

  // Click handler to select node
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;

    // Find node clicked
    const clicked = nodes.find(n => {
      const dx = n.x - mx;
      const dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < 24;
    });

    setSelectedNode(clicked || null);
  }, [nodes, zoom, pan]);

  // Drag start handler (locks node coordinates on drag)
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;

    const clickedNode = nodes.find(n => {
      const dx = n.x - mx;
      const dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < 24;
    });

    if (clickedNode) {
      activeDragNodeRef.current = clickedNode;
      clickedNode.fx = mx;
      clickedNode.fy = my;
    } else {
      dragRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        panStartX: pan.x,
        panStartY: pan.y
      };
    }
  }, [nodes, zoom, pan]);

  // Drag movement handler
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;

    if (activeDragNodeRef.current) {
      activeDragNodeRef.current.fx = mx;
      activeDragNodeRef.current.fy = my;
      activeDragNodeRef.current.x = mx;
      activeDragNodeRef.current.y = my;
      return;
    }

    if (dragRef.current.dragging) {
      setPan({
        x: dragRef.current.panStartX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.panStartY + (e.clientY - dragRef.current.startY)
      });
      return;
    }

    // Hover detection
    const hovered = nodes.find(n => {
      const dx = n.x - mx;
      const dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < 24;
    });
    setHoveredNode(hovered || null);
    canvas.style.cursor = hovered ? "pointer" : dragRef.current.dragging ? "grabbing" : "grab";
  }, [nodes, zoom, pan]);

  // Drag end handler
  const handleMouseUpOrLeave = useCallback(() => {
    if (activeDragNodeRef.current) {
      activeDragNodeRef.current.fx = null;
      activeDragNodeRef.current.fy = null;
      activeDragNodeRef.current = null;
    }
    dragRef.current.dragging = false;
  }, []);

  // Filtered lists for rendering
  const filteredNodes = nodes.filter(
    n => n.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
         (n.ip && n.ip.includes(searchQuery)) ||
         n.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalActiveNodes = nodes.filter(n => n.status === "ACTIVE").length;
  const totalInactiveNodes = nodes.filter(n => n.status !== "ACTIVE").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", width: "100%" }}>
      {/* Header telemetry control bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <Network size={22} color="#06b6d4" /> SNMP Topology &amp; CMDB Map
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
            Physical neighbors autodiscovered via continuous CDP/LLDP MIB SNMP poller cycles
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
            <input
              type="text"
              placeholder="Search assets / IP..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px 8px 30px",
                borderRadius: 8,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                fontSize: 12.5,
                outline: "none"
              }}
            />
          </div>

          <button 
            onClick={() => fetchTopology(true)} 
            disabled={isRefreshing}
            className="btn btn-secondary" 
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "8px 14px", height: 35 }}
          >
            <RefreshCw size={13} className={isRefreshing ? "spin" : ""} style={{ animation: isRefreshing ? "spin 1.5s linear infinite" : "none" }} />
            Poll SNMP
          </button>
          
          <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", padding: 4, borderRadius: 8 }}>
            <button className="btn btn-secondary" style={{ padding: 6, height: 26, width: 26, minWidth: 26 }} onClick={() => setZoom(z => Math.min(z + 0.15, 3.0))}><ZoomIn size={13} /></button>
            <button className="btn btn-secondary" style={{ padding: 6, height: 26, width: 26, minWidth: 26 }} onClick={() => setZoom(z => Math.max(z - 0.15, 0.3))}><ZoomOut size={13} /></button>
            <button className="btn btn-secondary" style={{ padding: "6px 10px", height: 26, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }} onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); setSelectedNode(null); }}>
              <Maximize2 size={11} /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Grid Legend Overlay */}
      <div className="card" style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", fontSize: 11.5 }}>
          <span style={{ fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.05em" }}>TELEMETRY LAYER:</span>
          {Object.keys(TYPE_ICONS).slice(0, 7).map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontWeight: 500 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: TYPE_COLORS[t] || "#64748b", display: "inline-block" }} />
              <span>{TYPE_ICONS[t]} {t}</span>
            </div>
          ))}
          <span style={{ marginLeft: "auto", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 12, height: 1.5, background: "rgba(6,182,212,0.6)" }} /> Flowing pulses = Dynamic Utilization ┄ Copper glowing wires
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 16, flex: 1, minHeight: 520 }}>
        {/* Interactive Canvas HUD */}
        <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative", background: "#030712", border: "1.5px solid var(--border-primary)", display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-tertiary)", gap: 10 }}>
              <Activity size={28} className="spin" style={{ color: "#06b6d4", animation: "spin 1.5s linear infinite" }} />
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Loading continuous SNMP MIB walks...</div>
            </div>
          ) : nodes.length === 0 ? (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "radial-gradient(circle at center, #0b0f19 0%, #02040a 100%)",
              padding: 32,
              textAlign: "center",
              zIndex: 20
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(6, 182, 212, 0.08)",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--brand-400)",
                marginBottom: 20,
                boxShadow: "0 0 20px rgba(6, 182, 212, 0.15)"
              }}>
                <Network size={32} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.01em" }}>
                No Autodiscovered Topology Nodes Found
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 440, lineHeight: 1.6, marginBottom: 24 }}>
                Your IT infrastructure map is currently empty. Run an SNMP discovery subnet scan under Network Discovery to dynamically populate your CMDB map with active switches, firewalls, and servers.
              </p>
              <button
                onClick={() => router.push("/dashboard/discovery")}
                className="btn btn-primary"
                style={{
                  padding: "10px 20px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, var(--brand-500) 0%, #06b6d4 100%)",
                  border: "none",
                  boxShadow: "0 4px 15px rgba(6,182,212,0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer"
                }}
              >
                Go to Network Discovery
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ position: "absolute", top: 12, left: 12, pointerEvents: "none", zIndex: 10, display: "flex", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)", padding: "4px 10px", borderRadius: 20, fontSize: 11, color: "#22d3ee", fontWeight: 700 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  {nodes.length} Discovered Nodes
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", padding: "4px 10px", borderRadius: 20, fontSize: 11, color: "#a78bfa", fontWeight: 700 }}>
                  <Layers size={11} /> {links.length} Relations Persisted
                </span>
              </div>

              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: "100%", minHeight: 500, flex: 1 }}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              />
            </>
          )}
        </div>

        {/* Detailed inspect telemetry panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {selectedNode ? (
            <>
              {/* Detailed Device Telemetry */}
              <div className="card" style={{ border: `1.5px solid ${TYPE_COLORS[selectedNode.type] || "var(--border-primary)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>MONITORED SYSTEM</div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{selectedNode.name}</h3>
                    <code style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{selectedNode.ip || "No IP Address"}</code>
                  </div>
                  <span style={{
                    fontSize: 22,
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: `${TYPE_COLORS[selectedNode.type]}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    {TYPE_ICONS[selectedNode.type] || "📦"}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 10, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-tertiary)" }}>Device Model</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{selectedNode.sysName || selectedNode.type}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-tertiary)" }}>SNMP Status</span>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: selectedNode.status === "ACTIVE" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                      color: selectedNode.status === "ACTIVE" ? "#10b981" : "#ef4444"
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: selectedNode.status === "ACTIVE" ? "#10b981" : "#ef4444" }} />
                      {selectedNode.status === "ACTIVE" ? "POLLING ACTIVE" : "OFFLINE"}
                    </span>
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid var(--border-primary)", margin: "4px 0" }} />

                  {/* CPU Gauge */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}><Cpu size={12} /> CPU Load</span>
                      <span style={{ fontWeight: 700, color: selectedNode.cpu > 80 ? "#ef4444" : "var(--text-primary)" }}>{selectedNode.cpu}%</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        width: `${selectedNode.cpu}%`,
                        height: "100%",
                        background: selectedNode.cpu > 80 ? "#ef4444" : selectedNode.cpu > 50 ? "#f59e0b" : "#06b6d4",
                        borderRadius: 3
                      }} />
                    </div>
                  </div>

                  {/* Memory Gauge */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}><HardDrive size={12} /> RAM Utilization</span>
                      <span style={{ fontWeight: 700, color: selectedNode.memory > 80 ? "#ef4444" : "var(--text-primary)" }}>{selectedNode.memory}%</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        width: `${selectedNode.memory}%`,
                        height: "100%",
                        background: selectedNode.memory > 80 ? "#ef4444" : selectedNode.memory > 50 ? "#f59e0b" : "#8b5cf6",
                        borderRadius: 3
                      }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-tertiary)" }}>Monitored Ports</span>
                    <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{selectedNode.interfaces} Interfaces</span>
                  </div>

                  <div style={{ marginTop: 8, paddingTop: 8 }}>
                    <button
                      onClick={() => router.push(`/dashboard/assets`)}
                      className="btn btn-primary"
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, padding: "9px 12px" }}
                    >
                      <ExternalLink size={13} /> View Full Inventory specs
                    </button>
                  </div>
                </div>
              </div>

              {/* Neighbor Mappings */}
              <div className="card" style={{ flex: 1, overflowY: "auto" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                  Autodiscovered Neighbors ({links.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).length})
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {links
                    .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
                    .map((l, index) => {
                      const otherId = l.source === selectedNode.id ? l.target : l.source;
                      const otherNode = nodes.find(n => n.id === otherId);
                      if (!otherNode) return null;

                      const isCriticalBreach = l.utilization > 80;

                      return (
                        <div
                          key={index}
                          onClick={() => setSelectedNode(otherNode)}
                          style={{
                            padding: "10px",
                            borderRadius: 8,
                            background: "var(--bg-elevated)",
                            border: `1px solid ${isCriticalBreach ? "#ef4444" : "var(--border-primary)"}`,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            transition: "transform 0.15s"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{otherNode.name}</div>
                              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{otherNode.ip}</div>
                            </div>
                            <span style={{ fontSize: 18 }}>{TYPE_ICONS[otherNode.type] || "📦"}</span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: 6, fontSize: 10 }}>
                            <span style={{ color: "var(--text-tertiary)" }}>{l.localPort} 🡘 {l.remotePort}</span>
                            <span style={{ fontWeight: 800, color: isCriticalBreach ? "#ef4444" : "#06b6d4" }}>
                              {l.bandwidth} ({l.utilization}% Util)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          ) : (
            /* Blank inspect panel state */
            <div className="card" style={{ textAlign: "center", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(6,182,212,0.08)",
                color: "#06b6d4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16
              }}>
                <Info size={24} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Select Network Node</h3>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                Click on any switch, firewall, or physical server node to inspect SNMP telemetry bandwidth speeds, port details, and MIB links in real-time.
              </p>
            </div>
          )}

          {/* Global topology stats card */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
              SNMP ENGINE STATUS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>ONLINE DEVICES</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginTop: 2 }}>{totalActiveNodes}</div>
              </div>
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>OFFLINE DEVICES</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444", marginTop: 2 }}>{totalInactiveNodes}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-tertiary)" }}>Autodiscovery Mode</span>
                <span style={{ fontWeight: 600, color: "#10b981" }}>CDP &amp; LLDP MIB Walk</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-tertiary)" }}>Topology Density</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {nodes.length > 0 ? (links.length * 2 / nodes.length).toFixed(1) : "0"} Links/Node
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
