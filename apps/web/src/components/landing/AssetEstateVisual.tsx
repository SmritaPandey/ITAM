"use client";

import { useEffect, useState, useRef } from "react";
import {
  Laptop, Server, Monitor, Router, Wifi, Camera,
  Car, Armchair, Cloud, Cpu, Radio, HardDrive,
  type LucideIcon,
} from "lucide-react";

type AssetClass = {
  id: string;
  title: string;
  desc: string;
  accent: string;
  protocol: string;
  count: number;
  countLabel: string;
  icons: { Icon: LucideIcon; label: string }[];
};

const CLASSES: AssetClass[] = [
  {
    id: "it",
    title: "IT Endpoints",
    desc: "Laptops, workstations, and servers discovered by agent or agentless sweep.",
    accent: "#06b6d4",
    protocol: "AGENT",
    count: 12840,
    countLabel: "Endpoints",
    icons: [
      { Icon: Laptop, label: "Laptop" },
      { Icon: Monitor, label: "Workstation" },
      { Icon: Server, label: "Server" },
    ],
  },
  {
    id: "network",
    title: "Network Fabric",
    desc: "Switches, routers, and access points via SNMP topology polling.",
    accent: "#f59e0b",
    protocol: "SNMP",
    count: 2140,
    countLabel: "Devices",
    icons: [
      { Icon: Router, label: "Router" },
      { Icon: Wifi, label: "Access Point" },
      { Icon: HardDrive, label: "Switch" },
    ],
  },
  {
    id: "cctv",
    title: "CCTV & Security",
    desc: "Camera fleets and NVRs with health and stream status.",
    accent: "#14b8a6",
    protocol: "ONVIF",
    count: 1860,
    countLabel: "Cameras",
    icons: [
      { Icon: Camera, label: "Camera" },
      { Icon: HardDrive, label: "NVR" },
      { Icon: Radio, label: "Encoder" },
    ],
  },
  {
    id: "fleet",
    title: "Fleet & GPS",
    desc: "Vehicles with trip history and driver assignment when GPS feeds are live.",
    accent: "#10b981",
    protocol: "GPS",
    count: 420,
    countLabel: "Vehicles",
    icons: [
      { Icon: Car, label: "Vehicle" },
      { Icon: Radio, label: "Tracker" },
      { Icon: Cpu, label: "Telematics" },
    ],
  },
  {
    id: "eam",
    title: "Facilities & EAM",
    desc: "Furniture, HVAC, and QR-tagged equipment across sites.",
    accent: "#475569",
    protocol: "QR",
    count: 9320,
    countLabel: "Assets",
    icons: [
      { Icon: Armchair, label: "Furniture" },
      { Icon: Cpu, label: "HVAC" },
      { Icon: HardDrive, label: "Equipment" },
    ],
  },
  {
    id: "cloud",
    title: "Cloud & VDI",
    desc: "Virtual machines and desktop pools in one inventory model.",
    accent: "#0e7490",
    protocol: "CLOUD",
    count: 3560,
    countLabel: "Instances",
    icons: [
      { Icon: Cloud, label: "VM" },
      { Icon: Monitor, label: "VDI Pool" },
      { Icon: Server, label: "Host" },
    ],
  },
  {
    id: "iot",
    title: "IoT & OT",
    desc: "Sensors, PLCs, and MQTT devices at the edge of the estate.",
    accent: "#d97706",
    protocol: "MQTT",
    count: 4780,
    countLabel: "Nodes",
    icons: [
      { Icon: Radio, label: "Sensor" },
      { Icon: Cpu, label: "PLC" },
      { Icon: Wifi, label: "Gateway" },
    ],
  },
];

const SOURCES = ["Agent", "Agentless", "AD", "Cloud", "IoT/OT"];

function useCountUp(target: number, active: boolean, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

function OrbitNode({
  Icon,
  label,
  accent,
  angle,
  radius,
  active,
  index,
}: {
  Icon: LucideIcon;
  label: string;
  accent: string;
  angle: number;
  radius: number;
  active: boolean;
  index: number;
}) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;
  return (
    <div
      title={label}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: active ? 56 : 44,
        height: active ? 56 : 44,
        marginLeft: -((active ? 56 : 44) / 2),
        marginTop: -((active ? 56 : 44) / 2),
        transform: `translate(${x}px, ${y}px)`,
        borderRadius: 16,
        background: active ? accent : "rgba(255,255,255,0.06)",
        color: active ? "#fff" : "rgba(255,255,255,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        border: active ? "none" : "1px solid rgba(255,255,255,0.1)",
        animation: `estateDrift ${6 + index}s ease-in-out infinite alternate`,
        animationDelay: `${index * 0.35}s`,
      }}
    >
      <Icon size={active ? 24 : 18} strokeWidth={1.75} />
    </div>
  );
}

export default function AssetEstateVisual({ light = true }: { light?: boolean }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const active = CLASSES[activeIdx];
  const count = useCountUp(active.count, true);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % CLASSES.length);
    }, 2800);
    return () => clearInterval(id);
  }, [paused]);

  const angles = [0, 120, 240];
  const radius = 118;

  return (
    <section
      id="estate"
      aria-label="Asset estate coverage"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{
        padding: "0 6% 80px",
        maxWidth: 1200,
        margin: "0 auto",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div
        ref={regionRef}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${active.title}: ${active.desc}`}
        style={{
          borderRadius: 30,
          background: light ? "#1a1d21" : "#12151a",
          color: "#f5f5f7",
          padding: "48px 40px",
          outline: "none",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36, position: "relative", zIndex: 2 }}>
          <div
            className="font-mono-label"
            style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}
          >
            One estate · every class
          </div>
          <h2
            className="font-serif"
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              marginBottom: 12,
              color: "#f5f5f7",
            }}
          >
            From laptops to <em style={{ fontStyle: "italic" }}>PLCs</em>.
          </h2>
          <p style={{ fontSize: 16, fontWeight: 300, color: "#9f9fa0", maxWidth: 480, margin: "0 auto", lineHeight: 1.5 }}>
            IT, facilities, fleet, cameras, cloud, and OT — one inventory model, many discovery paths.
          </p>
        </div>

        <div
          className="estate-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 40,
            alignItems: "center",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Constellation */}
          <div
            style={{
              position: "relative",
              height: 320,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                width: 260,
                height: 260,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                width: 180,
                height: 180,
                borderRadius: "50%",
                border: "1px dashed rgba(255,255,255,0.06)",
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: `${active.accent}22`,
                border: `1px solid ${active.accent}55`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s ease, border-color 0.2s ease",
              }}
            >
              <div
                className="font-mono-label"
                style={{ fontSize: 10, color: active.accent, letterSpacing: "0.16em" }}
              >
                {active.protocol}
              </div>
            </div>
            {active.icons.map((item, i) => (
              <OrbitNode
                key={`${active.id}-${item.label}`}
                Icon={item.Icon}
                label={item.label}
                accent={active.accent}
                angle={angles[i]}
                radius={radius}
                active
                index={i}
              />
            ))}
          </div>

          {/* Detail panel */}
          <div>
            <div
              key={active.id}
              style={{
                animation: "estateReveal 0.55s cubic-bezier(0.455, 0.03, 0.515, 0.955) both",
              }}
            >
              <div
                className="font-mono-label"
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  padding: "6px 14px",
                  borderRadius: 9999,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fafafa",
                  marginBottom: 16,
                }}
              >
                {active.protocol} · {active.title}
              </div>
              <h3
                className="font-serif"
                style={{ fontSize: 32, lineHeight: 1, marginBottom: 10, color: "#fff" }}
              >
                {active.title}
              </h3>
              <p style={{ fontSize: 15, color: "#9f9fa0", lineHeight: 1.55, marginBottom: 24, fontWeight: 300 }}>
                {active.desc}
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <span
                  className="font-mono-label"
                  style={{
                    fontSize: 36,
                    letterSpacing: "-0.04em",
                    color: active.accent,
                    fontWeight: 500,
                    textTransform: "none",
                  }}
                >
                  {count.toLocaleString("en-IN")}
                </span>
                <span className="font-mono-label" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {active.countLabel}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 28 }}>
                Illustrative estate mix — your numbers come from live discovery.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {CLASSES.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={i === activeIdx}
                  onClick={() => setActiveIdx(i)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: i === activeIdx ? `1px solid ${c.accent}` : "1px solid rgba(255,255,255,0.1)",
                    background: i === activeIdx ? `${c.accent}22` : "transparent",
                    color: i === activeIdx ? "#fff" : "rgba(255,255,255,0.55)",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "var(--font-mono), monospace",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    transition: "all 0.2s ease",
                  }}
                >
                  {c.title.split(" ")[0]}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SOURCES.map((s) => (
                <span
                  key={s}
                  className="font-mono-label"
                  style={{
                    fontSize: 10,
                    padding: "5px 12px",
                    borderRadius: 9999,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Counter strip */}
        <div
          className="estate-counters"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginTop: 40,
            paddingTop: 28,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            position: "relative",
            zIndex: 2,
          }}
        >
          {CLASSES.slice(0, 4).map((c) => (
            <div key={c.id} style={{ textAlign: "center" }}>
              <div
                className="font-mono-label"
                style={{
                  fontSize: 18,
                  color: c.accent,
                  letterSpacing: "-0.02em",
                  textTransform: "none",
                  marginBottom: 4,
                }}
              >
                {(c.count / 1000).toFixed(1)}k
              </div>
              <div className="font-mono-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                {c.countLabel}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes estateDrift {
          from { filter: brightness(1); }
          to { filter: brightness(1.08); }
        }
        @keyframes estateReveal {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 800px) {
          .estate-grid { grid-template-columns: 1fr !important; }
          .estate-counters { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </section>
  );
}
