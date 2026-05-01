"use client";
import { useEffect, useState } from "react";
import { BookOpen, Search, ThumbsUp, Eye, Tag, Loader2, Plus } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : ""; }
function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...opts?.headers } }).then(r => r.json());
}

const CAT_COLORS: Record<string, string> = {
  "IT Support": "#06b6d4", "Network": "#8b5cf6", "Security": "#ef4444", "General": "#10b981",
};

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (catFilter) params.set("category", catFilter);
    const res = await apiFetch(`/knowledge-base?${params}`);
    setArticles(res.data || []);
    setCategories(res.categories || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [search, catFilter]);

  async function viewArticle(id: string) {
    const data = await apiFetch(`/knowledge-base/${id}`);
    setSelected(data);
  }

  async function markHelpful(id: string) {
    await apiFetch(`/knowledge-base/${id}/helpful`, { method: "POST" });
    if (selected?.id === id) setSelected({ ...selected, helpfulCount: (selected.helpfulCount || 0) + 1 });
  }

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
          <h1 className="page-title">Knowledge Base</h1>
          <p className="page-subtitle">Self-service articles and IT documentation</p>
        </div>
      </div>

      {/* Search + Categories */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: 10, color: "var(--text-tertiary)" }} />
            <input placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px 8px 34px", borderRadius: 8, background: "var(--bg-input)",
                border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none",
              }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setCatFilter("")}
            className={`btn ${!catFilter ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 11, padding: "4px 12px" }}>All</button>
          {categories.map((c: any) => (
            <button key={c.category} onClick={() => setCatFilter(c.category)}
              className={`btn ${catFilter === c.category ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: 11, padding: "4px 12px" }}>
              {c.category} <span style={{ opacity: 0.6, marginLeft: 4 }}>{c._count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Article Grid */}
      {selected ? (
        <div className="card">
          <button className="btn btn-secondary" style={{ marginBottom: 16, fontSize: 11 }}
            onClick={() => setSelected(null)}>&larr; Back to articles</button>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{selected.title}</h2>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 11, color: "var(--text-tertiary)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLORS[selected.category] || "#888" }} />
              {selected.category}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye size={12} /> {selected.viewCount} views</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><ThumbsUp size={12} /> {selected.helpfulCount} helpful</span>
          </div>
          {selected.tags?.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {selected.tags.map((t: string) => (
                <span key={t} style={{
                  padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                  background: "rgba(6,182,212,0.08)", color: "var(--brand-400)", border: "1px solid rgba(6,182,212,0.2)",
                }}><Tag size={8} style={{ marginRight: 2 }} />{t}</span>
              ))}
            </div>
          )}
          <div style={{
            padding: 20, borderRadius: 12, background: "var(--bg-elevated)",
            border: "1px solid var(--border-primary)", lineHeight: 1.7, fontSize: 13, whiteSpace: "pre-wrap",
          }}>
            {selected.content}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => markHelpful(selected.id)}>
              <ThumbsUp size={14} /> Helpful ({selected.helpfulCount})
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {articles.length === 0 ? (
            <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
              <BookOpen size={36} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No articles found</div>
              <p style={{ fontSize: 12 }}>{search ? "Try a different search term" : "No knowledge base articles yet"}</p>
            </div>
          ) : articles.map((a: any) => (
            <div key={a.id} className="card" style={{ cursor: "pointer", transition: "border-color 0.15s" }}
              onClick={() => viewArticle(a.id)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--brand-400)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-primary)")}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: CAT_COLORS[a.category] || "#888",
                }} />
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500 }}>{a.category}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>{a.title}</h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10,
                overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                {a.content.replace(/[#*>\-|]/g, "").substring(0, 150)}...
              </p>
              <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--text-tertiary)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye size={10} /> {a.viewCount}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><ThumbsUp size={10} /> {a.helpfulCount}</span>
                {a.tags?.length > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Tag size={10} /> {a.tags.length} tags</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
