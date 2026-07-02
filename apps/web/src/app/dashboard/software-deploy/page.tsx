"use client";
import { useState, useEffect } from "react";
import {
  Download, Package, Search, Loader2, CheckCircle2, XCircle,
  Monitor, Rocket, Server, Globe, Shield, Wrench, MessageSquare,
  Play, Filter, ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const CATEGORY_ICONS: Record<string, any> = {
  Browser: Globe, Utility: Wrench, Development: Server, Communication: MessageSquare,
  Media: Play, Productivity: Package, Security: Shield, "Remote Access": Monitor,
};

const CATEGORY_COLORS: Record<string, string> = {
  Browser: "#3b82f6", Utility: "#8b5cf6", Development: "#10b981", Communication: "#f59e0b",
  Media: "#ec4899", Productivity: "#06b6d4", Security: "#ef4444", "Remote Access": "#6366f1",
};

export default function SoftwareDeployPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<any>(null);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);

  useEffect(() => {
    apiFetch("/patches/software/catalog")
      .then((d) => setCatalog(d.catalog || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categories = ["All", ...Array.from(new Set(catalog.map((c) => c.category)))];

  const filtered = catalog.filter((pkg) => {
    const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || pkg.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  async function deployPackage(pkg: any) {
    setDeploying(pkg.name);
    try {
      const result = await apiFetch("/patches/software/deploy", {
        method: "POST",
        body: JSON.stringify({
          packageName: pkg.winget || pkg.brew || pkg.apt || pkg.name,
          packageUrl: pkg.msiUrl || undefined,
          packageType: pkg.msiUrl ? "msi" : undefined,
          silent: true,
        }),
      });
      setDeployResult({ success: true, message: `"${pkg.name}" queued for ${result.targetCount} device(s)` });
    } catch (err: any) {
      setDeployResult({ success: false, message: `Failed: ${err.message}` });
    } finally {
      setDeploying(null);
    }
  }

  async function deploySelected() {
    if (!selectedPackages.length) return;
    setDeploying("bulk");
    let deployed = 0;
    for (const name of selectedPackages) {
      const pkg = catalog.find((c) => c.name === name);
      if (!pkg) continue;
      try {
        await apiFetch("/patches/software/deploy", {
          method: "POST",
          body: JSON.stringify({
            packageName: pkg.winget || pkg.brew || pkg.apt || pkg.name,
            packageUrl: pkg.msiUrl || undefined,
            packageType: pkg.msiUrl ? "msi" : undefined,
            silent: true,
          }),
        });
        deployed++;
      } catch {}
    }
    setDeployResult({ success: true, message: `${deployed} package(s) queued for deployment` });
    setSelectedPackages([]);
    setDeploying(null);
  }

  function toggleSelection(name: string) {
    setSelectedPackages((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-tertiary)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={22} style={{ color: "var(--brand-400)" }} /> Software Deployment
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
            Push software packages to managed endpoints — supports Windows (winget/MSI), macOS (Homebrew/PKG), Linux (apt/rpm)
          </p>
        </div>
        {selectedPackages.length > 0 && (
          <button className="btn btn-primary" onClick={deploySelected} disabled={deploying === "bulk"}>
            {deploying === "bulk" ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Deploying...</> : <><Rocket size={14} /> Deploy {selectedPackages.length} Selected</>}
          </button>
        )}
      </div>

      {/* Status banner */}
      {deployResult && (
        <div className="card" style={{ padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, borderLeft: `3px solid ${deployResult.success ? "#10b981" : "#ef4444"}` }}>
          {deployResult.success ? <CheckCircle2 size={16} style={{ color: "#10b981" }} /> : <XCircle size={16} style={{ color: "#ef4444" }} />}
          <span style={{ fontSize: 13 }}>{deployResult.message}</span>
          <button onClick={() => setDeployResult(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
          <input
            type="text" placeholder="Search software catalog..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`btn ${selectedCategory === cat ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: 11, padding: "6px 12px" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Software Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {filtered.map((pkg) => {
          const Icon = CATEGORY_ICONS[pkg.category] || Package;
          const color = CATEGORY_COLORS[pkg.category] || "#6b7280";
          const isSelected = selectedPackages.includes(pkg.name);
          const isDeploying = deploying === pkg.name;

          return (
            <div key={pkg.name} className="card" style={{
              padding: 16, display: "flex", gap: 12, cursor: "pointer",
              border: isSelected ? "1px solid var(--brand-400)" : "1px solid var(--border-primary)",
              background: isSelected ? "rgba(99,102,241,0.06)" : undefined,
              transition: "all 0.15s ease",
            }} onClick={() => toggleSelection(pkg.name)}>
              {/* Checkbox */}
              <div style={{
                width: 18, height: 18, borderRadius: 4, border: "2px solid var(--border-primary)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
                background: isSelected ? "var(--brand-400)" : "transparent",
              }}>
                {isSelected && <CheckCircle2 size={12} style={{ color: "#fff" }} />}
              </div>

              {/* Icon */}
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon size={18} style={{ color }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{pkg.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  <span className="badge" style={{ fontSize: 9, padding: "1px 6px", background: `${color}15`, color }}>{pkg.category}</span>
                  <span style={{ marginLeft: 6 }}>
                    {[pkg.winget && "Win", pkg.brew && "Mac", (pkg.apt || pkg.snap) && "Linux"].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>

              {/* Deploy button */}
              <button
                className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 11, flexShrink: 0, alignSelf: "center" }}
                disabled={isDeploying}
                onClick={(e) => { e.stopPropagation(); deployPackage(pkg); }}
              >
                {isDeploying ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <><Rocket size={12} /> Deploy</>}
              </button>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
          <Package size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>No software matches your search</p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
