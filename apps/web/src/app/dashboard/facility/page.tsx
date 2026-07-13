"use client";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { eamApi } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

type Tab = "overview" | "floor" | "spares" | "consumables" | "pm";

export default function FacilityPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [floorPlan, setFloorPlan] = useState<any>(null);
  const [spares, setSpares] = useState<any[]>([]);
  const [consumables, setConsumables] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [processingPm, setProcessingPm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dash, siteList, spareList, consList, pmList] = await Promise.all([
        eamApi.facilityDashboard(),
        eamApi.listSites(),
        eamApi.listSpareParts(),
        eamApi.listConsumables(),
        eamApi.listMaintenance(),
      ]);
      setDashboard(dash);
      setSites(Array.isArray(siteList) ? siteList : []);
      setSpares(Array.isArray(spareList) ? spareList : []);
      setConsumables(Array.isArray(consList) ? consList : []);
      setSchedules(Array.isArray(pmList) ? pmList : []);
      if (!selectedSiteId && Array.isArray(siteList) && siteList.length) {
        const withPlan = siteList.find((s: any) => s.floorPlanUrl) || siteList[0];
        setSelectedSiteId(withPlan.id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load facility data");
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedSiteId) {
      setFloorPlan(null);
      return;
    }
    eamApi
      .getFloorPlan(selectedSiteId)
      .then(setFloorPlan)
      .catch(() => setFloorPlan(null));
  }, [selectedSiteId]);

  async function processDuePm() {
    setProcessingPm(true);
    try {
      await eamApi.processDueMaintenance();
      await load();
    } catch (err: any) {
      alert(err?.message || "Failed to process due PM");
    } finally {
      setProcessingPm(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "floor", label: "Floor Plan" },
    { id: "pm", label: "PM Schedules" },
    { id: "spares", label: "Spare Parts" },
    { id: "consumables", label: "Consumables" },
  ];

  if (loading && !dashboard) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 10, color: "var(--text-secondary)" }}>
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        Loading facility dashboard…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 4px 40px" }}>
      <PageHeader
        eyebrow="EAM"
        title="Facility Manager"
        description="Preventive maintenance, spare stock, consumables, and floor-plan asset pins."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={processDuePm}
              disabled={processingPm}
              style={btnSecondary}
            >
              {processingPm ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Wrench size={14} />}
              Process due PM
            </button>
            <button onClick={load} style={btnSecondary}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard icon={<Calendar size={16} />} label="PM overdue" value={dashboard?.pmOverdue ?? 0} tone="#ef4444" />
        <StatCard icon={<Calendar size={16} />} label="PM due (7d)" value={dashboard?.pmDueSoon ?? 0} tone="#f59e0b" />
        <StatCard icon={<Wrench size={16} />} label="Open PM WOs" value={dashboard?.openPmWorkOrders ?? 0} tone="#3b82f6" />
        <StatCard icon={<Package size={16} />} label="Low spares" value={dashboard?.lowSpareParts?.length ?? 0} tone="#f97316" />
        <StatCard icon={<AlertTriangle size={16} />} label="Reorder consumables" value={dashboard?.lowConsumables?.length ?? 0} tone="#eab308" />
        <StatCard icon={<MapPin size={16} />} label="Pinned assets" value={dashboard?.pinnedAssets ?? 0} tone="#10b981" />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              ...btnSecondary,
              background: tab === t.id ? "var(--brand-500)" : "var(--bg-elevated)",
              color: tab === t.id ? "#fff" : "var(--text-primary)",
              borderColor: tab === t.id ? "var(--brand-500)" : "var(--border-default)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
          <Panel title="Upcoming preventive maintenance">
            {(dashboard?.upcomingPm || []).length === 0 ? (
              <EmptyState title="No PM schedules" description="Create maintenance schedules from the PM tab." />
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Schedule</th>
                    <th style={th}>Asset</th>
                    <th style={th}>Next due</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.upcomingPm.map((row: any) => (
                    <tr key={row.id}>
                      <td style={td}>{row.name}</td>
                      <td style={td}>{row.asset?.name || "—"}</td>
                      <td style={td}>
                        <DueBadge date={row.nextDueAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Panel title="Low spare parts">
              {(dashboard?.lowSpareParts || []).length === 0 ? (
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>All spares above minimum stock.</div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {dashboard.lowSpareParts.map((p: any) => (
                    <li key={p.id} style={listRow}>
                      <span>{p.name} <span style={{ color: "var(--text-secondary)" }}>({p.sku})</span></span>
                      <span style={{ color: "#f97316", fontWeight: 600 }}>{p.quantityOnHand}/{p.minStock}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Consumables to reorder">
              {(dashboard?.lowConsumables || []).length === 0 ? (
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>No reorder alerts.</div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {dashboard.lowConsumables.map((c: any) => (
                    <li key={c.id} style={listRow}>
                      <span>{c.name}</span>
                      <span style={{ color: "#eab308", fontWeight: 600 }}>{c.quantityOnHand} &lt; {c.reorderPoint}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      {tab === "floor" && (
        <Panel
          title="Floor plan pins"
          actions={
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.floorPlanUrl ? "" : " (no plan)"}
                </option>
              ))}
            </select>
          }
        >
          {!selectedSiteId ? (
            <EmptyState title="Select a site" description="Choose a site with a floor plan URL to view asset pins." />
          ) : !floorPlan?.site?.floorPlanUrl ? (
            <EmptyState
              title="No floor plan"
              description="Set floorPlanUrl on this site (Settings or PATCH /eam/facility/sites/:id/floor-plan)."
              icon={<Building2 size={28} />}
            />
          ) : (
            <div style={{ position: "relative", width: "100%", maxWidth: 900, margin: "0 auto", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
              <img
                src={floorPlan.site.floorPlanUrl}
                alt={`${floorPlan.site.name} floor plan`}
                style={{ display: "block", width: "100%", height: "auto", cursor: "crosshair" }}
                onClick={async (e) => {
                  const assetId = prompt("Asset ID to pin at this location:");
                  if (!assetId?.trim()) return;
                  const rect = (e.target as HTMLImageElement).getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width;
                  const y = (e.clientY - rect.top) / rect.height;
                  try {
                    await eamApi.updateAssetPin(assetId.trim(), {
                      floorPinX: Math.round(x * 1000) / 1000,
                      floorPinY: Math.round(y * 1000) / 1000,
                      siteId: selectedSiteId,
                    });
                    const refreshed = await eamApi.getFloorPlan(selectedSiteId);
                    setFloorPlan(refreshed);
                  } catch (err: any) {
                    alert(err?.message || "Failed to place pin");
                  }
                }}
              />
              {(floorPlan.pins || []).map((pin: any) => {
                const x = Number(pin.floorPinX);
                const y = Number(pin.floorPinY);
                if (Number.isNaN(x) || Number.isNaN(y)) return null;
                const left = x <= 1 ? x * 100 : x;
                const top = y <= 1 ? y * 100 : y;
                return (
                  <a
                    key={pin.id}
                    href={`/dashboard/assets/${pin.id}`}
                    title={`${pin.name}${pin.assetTag ? ` (${pin.assetTag})` : ""} — ${pin.status}`}
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      top: `${top}%`,
                      transform: "translate(-50%, -50%)",
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: pin.status === "ACTIVE" ? "#10b981" : pin.status === "IN_MAINTENANCE" ? "#f59e0b" : "#ef4444",
                      border: "2px solid #fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                      cursor: "pointer",
                    }}
                  />
                );
              })}
              <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", borderTop: "1px solid var(--border-default)" }}>
                {(floorPlan.pins || []).length} pinned asset(s) on {floorPlan.site.name}. Click the plan to place a pin; click a pin to open the asset.
              </div>
            </div>
          )}
        </Panel>
      )}

      {tab === "pm" && (
        <Panel title="Maintenance schedules">
          <CreatePmForm onCreated={load} />
          {schedules.length === 0 ? (
            <EmptyState title="No schedules" description="Create a preventive maintenance schedule above." />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Asset</th>
                  <th style={th}>Interval</th>
                  <th style={th}>Next due</th>
                  <th style={th}>Auto WO</th>
                  <th style={th}>Active</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td style={td}>{s.name}</td>
                    <td style={td}>{s.asset?.name || "—"}</td>
                    <td style={td}>{s.intervalDays ? `${s.intervalDays}d` : s.scheduleType}</td>
                    <td style={td}><DueBadge date={s.nextDueAt} /></td>
                    <td style={td}>{s.autoCreateWo ? "Yes" : "No"}</td>
                    <td style={td}>{s.isActive ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === "spares" && (
        <Panel title="Spare parts inventory">
          <CreateSpareForm onCreated={load} />
          {spares.length === 0 ? (
            <EmptyState title="No spare parts" description="Add a spare part SKU above to start tracking stock." />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>SKU</th>
                  <th style={th}>Name</th>
                  <th style={th}>On hand</th>
                  <th style={th}>Min</th>
                  <th style={th}>Location</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {spares.map((p) => (
                  <tr key={p.id}>
                    <td style={td}>{p.sku}</td>
                    <td style={td}>{p.name}</td>
                    <td style={{ ...td, color: p.quantityOnHand < p.minStock ? "#f97316" : undefined, fontWeight: p.quantityOnHand < p.minStock ? 700 : 400 }}>
                      {p.quantityOnHand}
                    </td>
                    <td style={td}>{p.minStock}</td>
                    <td style={td}>{p.location || "—"}</td>
                    <td style={td}>
                      <button
                        style={{ ...btnSecondary, padding: "4px 8px", fontSize: 11 }}
                        onClick={async () => {
                          const qty = prompt("Receive quantity?");
                          if (!qty) return;
                          try {
                            await eamApi.receiveSpare(p.id, Number(qty));
                            await load();
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }}
                      >
                        Receive
                      </button>{" "}
                      <button
                        style={{ ...btnSecondary, padding: "4px 8px", fontSize: 11 }}
                        onClick={async () => {
                          const qty = prompt("Consume quantity?");
                          if (!qty) return;
                          try {
                            await eamApi.consumeSpare(p.id, Number(qty));
                            await load();
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }}
                      >
                        Consume
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === "consumables" && (
        <Panel title="Consumables">
          <CreateConsumableForm onCreated={load} />
          {consumables.length === 0 ? (
            <EmptyState title="No consumables" description="Add a consumable above to track reorder points." />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>SKU</th>
                  <th style={th}>Name</th>
                  <th style={th}>On hand</th>
                  <th style={th}>Reorder point</th>
                  <th style={th}>Reorder qty</th>
                  <th style={th}>Adjust</th>
                </tr>
              </thead>
              <tbody>
                {consumables.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>{c.sku}</td>
                    <td style={td}>{c.name}</td>
                    <td style={{ ...td, color: c.quantityOnHand < c.reorderPoint ? "#eab308" : undefined, fontWeight: c.quantityOnHand < c.reorderPoint ? 700 : 400 }}>
                      {c.quantityOnHand}
                    </td>
                    <td style={td}>{c.reorderPoint}</td>
                    <td style={td}>{c.reorderQty}</td>
                    <td style={td}>
                      <button
                        style={{ ...btnSecondary, padding: "4px 8px", fontSize: 11 }}
                        onClick={async () => {
                          const delta = prompt("Adjust by (e.g. -5 or 20)?");
                          if (delta === null || delta === "") return;
                          try {
                            await eamApi.adjustConsumable(c.id, Number(delta));
                            await load();
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }}
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderRadius: 12,
      border: "1px solid var(--border-default)",
      background: "var(--bg-surface)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: tone, marginBottom: 8, fontSize: 12, fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display), inherit" }}>
        {value}
      </div>
    </div>
  );
}

function Panel({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div style={{
      border: "1px solid var(--border-default)",
      borderRadius: 12,
      background: "var(--bg-surface)",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-default)",
      }}>
        <div style={{ fontWeight: 650, fontSize: 14 }}>{title}</div>
        {actions}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function DueBadge({ date }: { date?: string | null }) {
  if (!date) return <span style={{ color: "var(--text-secondary)" }}>—</span>;
  const d = new Date(date);
  const overdue = d.getTime() < Date.now();
  return (
    <span style={{
      color: overdue ? "#ef4444" : "#f59e0b",
      fontWeight: 600,
      fontSize: 12,
    }}>
      {d.toLocaleDateString()}{overdue ? " (overdue)" : ""}
    </span>
  );
}

function CreatePmForm({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [name, setName] = useState("");
  const [assetId, setAssetId] = useState("");
  const [intervalDays, setIntervalDays] = useState("90");
  const [saving, setSaving] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      <input placeholder="Schedule name" value={name} onChange={(e) => setName(e.target.value)} style={formInput} />
      <input placeholder="Asset UUID" value={assetId} onChange={(e) => setAssetId(e.target.value)} style={{ ...formInput, minWidth: 220 }} />
      <input placeholder="Interval days" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} style={{ ...formInput, width: 110 }} />
      <button
        className="btn btn-primary"
        style={{ fontSize: 12 }}
        disabled={saving}
        onClick={async () => {
          if (!name.trim() || !assetId.trim()) { alert("Name and asset ID required"); return; }
          setSaving(true);
          try {
            const days = parseInt(intervalDays, 10) || 90;
            await eamApi.createMaintenance({
              name: name.trim(),
              assetId: assetId.trim(),
              scheduleType: "CALENDAR",
              intervalDays: days,
              nextDueAt: new Date(Date.now() + days * 86400000).toISOString(),
              autoCreateWo: true,
            });
            setName("");
            setAssetId("");
            await onCreated();
          } catch (err: any) {
            alert(err?.message || "Failed to create schedule");
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Add schedule"}
      </button>
    </div>
  );
}

function CreateSpareForm({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [qty, setQty] = useState("0");
  const [saving, setSaving] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      <input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} style={formInput} />
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={formInput} />
      <input placeholder="On hand" value={qty} onChange={(e) => setQty(e.target.value)} style={{ ...formInput, width: 90 }} />
      <input placeholder="Min stock" value={minStock} onChange={(e) => setMinStock(e.target.value)} style={{ ...formInput, width: 90 }} />
      <button
        className="btn btn-primary"
        style={{ fontSize: 12 }}
        disabled={saving}
        onClick={async () => {
          if (!sku.trim() || !name.trim()) { alert("SKU and name required"); return; }
          setSaving(true);
          try {
            await eamApi.createSparePart({
              sku: sku.trim(),
              name: name.trim(),
              quantityOnHand: parseInt(qty, 10) || 0,
              minStock: parseInt(minStock, 10) || 0,
            });
            setSku("");
            setName("");
            await onCreated();
          } catch (err: any) {
            alert(err?.message || "Failed to create spare part");
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Add spare"}
      </button>
    </div>
  );
}

function CreateConsumableForm({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("0");
  const [reorderPoint, setReorderPoint] = useState("10");
  const [reorderQty, setReorderQty] = useState("50");
  const [saving, setSaving] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      <input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} style={formInput} />
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={formInput} />
      <input placeholder="On hand" value={qty} onChange={(e) => setQty(e.target.value)} style={{ ...formInput, width: 90 }} />
      <input placeholder="Reorder point" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} style={{ ...formInput, width: 110 }} />
      <input placeholder="Reorder qty" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} style={{ ...formInput, width: 100 }} />
      <button
        className="btn btn-primary"
        style={{ fontSize: 12 }}
        disabled={saving}
        onClick={async () => {
          if (!sku.trim() || !name.trim()) { alert("SKU and name required"); return; }
          setSaving(true);
          try {
            await eamApi.createConsumable({
              sku: sku.trim(),
              name: name.trim(),
              quantityOnHand: parseInt(qty, 10) || 0,
              reorderPoint: parseInt(reorderPoint, 10) || 0,
              reorderQty: parseInt(reorderQty, 10) || 0,
            });
            setSku("");
            setName("");
            await onCreated();
          } catch (err: any) {
            alert(err?.message || "Failed to create consumable");
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Add consumable"}
      </button>
    </div>
  );
}

const formInput: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  fontSize: 12,
  minWidth: 120,
};

const btnSecondary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const selectStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  fontSize: 13,
};

const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border-default)",
  color: "var(--text-secondary)",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const td: CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid var(--border-default)",
  color: "var(--text-primary)",
};
const listRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid var(--border-default)",
  fontSize: 13,
};
