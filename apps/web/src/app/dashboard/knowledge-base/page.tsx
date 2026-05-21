"use client";
import { useEffect, useState } from "react";
import { BookOpen, Search, ThumbsUp, Eye, Tag, Loader2, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";

const CAT_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  "IT Support": { color: "#22d3ee", bg: "rgba(34, 211, 238, 0.08)", border: "rgba(34, 211, 238, 0.2)" },
  "Network": { color: "#a78bfa", bg: "rgba(167, 139, 250, 0.08)", border: "rgba(167, 139, 250, 0.2)" },
  "Security": { color: "#f87171", bg: "rgba(248, 113, 113, 0.08)", border: "rgba(248, 113, 113, 0.2)" },
  "General": { color: "#34d399", bg: "rgba(52, 211, 153, 0.08)", border: "rgba(52, 211, 153, 0.2)" },
};

function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";

  let inList = false;
  let listItems: string[] = [];

  const parseInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentText = text;
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/;

    while (currentText) {
      const match = currentText.match(regex);
      if (!match) {
        parts.push(currentText);
        break;
      }

      const matchIndex = match.index || 0;
      if (matchIndex > 0) {
        parts.push(currentText.substring(0, matchIndex));
      }

      const matchedString = match[0];
      if (matchedString.startsWith("`") && matchedString.endsWith("`")) {
        parts.push(
          <code key={matchedString} style={{
            background: "rgba(255,255,255,0.06)",
            color: "#22d3ee",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: "12px",
            fontFamily: "monospace",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            {matchedString.slice(1, -1)}
          </code>
        );
      } else if (matchedString.startsWith("**") && matchedString.endsWith("**")) {
        parts.push(<strong key={matchedString} style={{ fontWeight: 700, color: "var(--text-primary)" }}>{matchedString.slice(2, -2)}</strong>);
      } else if (matchedString.startsWith("*") && matchedString.endsWith("*")) {
        parts.push(<em key={matchedString} style={{ fontStyle: "italic" }}>{matchedString.slice(1, -1)}</em>);
      }

      currentText = currentText.substring(matchIndex + matchedString.length);
    }

    return parts;
  };

  const renderList = (items: string[], key: number) => {
    return (
      <ul key={`ul-${key}`} style={{ paddingLeft: "20px", marginBottom: "16px", listStyleType: "disc" }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ marginBottom: "6px", color: "var(--text-secondary)", fontSize: "13px" }}>
            {parseInline(item)}
          </li>
        ))}
      </ul>
    );
  };

  let blockKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        elements.push(
          <div key={`code-${blockKey++}`} style={{
            position: "relative",
            background: "#070a13",
            border: "1px solid rgba(34, 211, 238, 0.15)",
            borderRadius: "8px",
            padding: "14px 16px",
            marginBottom: "16px",
            overflowX: "auto",
            fontFamily: "monospace",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.6)",
          }}>
            {codeBlockLang && (
              <span style={{
                position: "absolute",
                top: 4,
                right: 8,
                fontSize: "10px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.25)",
                textTransform: "uppercase",
              }}>{codeBlockLang}</span>
            )}
            <pre style={{ margin: 0, fontSize: "12px", color: "#a5b4fc", lineHeight: 1.5 }}>
              <code>{codeBlockLines.join("\n")}</code>
            </pre>
          </div>
        );
        codeBlockLines = [];
        codeBlockLang = "";
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      if (!inList) {
        inList = true;
      }
      listItems.push(line.trim().substring(2));
      continue;
    } else {
      if (inList) {
        elements.push(renderList(listItems, blockKey++));
        listItems = [];
        inList = false;
      }
    }

    if (line.trim().startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${blockKey++}`} style={{ fontSize: "20px", fontWeight: 700, marginTop: "24px", marginBottom: "12px", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {parseInline(line.trim().substring(2))}
        </h1>
      );
      continue;
    }
    if (line.trim().startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${blockKey++}`} style={{ fontSize: "16px", fontWeight: 700, marginTop: "20px", marginBottom: "10px", color: "var(--text-primary)", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "4px", letterSpacing: "-0.01em" }}>
          {parseInline(line.trim().substring(3))}
        </h2>
      );
      continue;
    }
    if (line.trim().startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${blockKey++}`} style={{ fontSize: "14px", fontWeight: 700, marginTop: "16px", marginBottom: "8px", color: "var(--text-primary)" }}>
          {parseInline(line.trim().substring(4))}
        </h3>
      );
      continue;
    }

    if (line.trim().startsWith("> ")) {
      let quoteText = line.trim().substring(2);
      let alertType: "note" | "warning" | "important" | "default" = "default";
      if (quoteText.startsWith("[!NOTE]")) {
        alertType = "note";
        quoteText = quoteText.substring(7).trim();
      } else if (quoteText.startsWith("[!WARNING]")) {
        alertType = "warning";
        quoteText = quoteText.substring(10).trim();
      } else if (quoteText.startsWith("[!IMPORTANT]")) {
        alertType = "important";
        quoteText = quoteText.substring(12).trim();
      }

      const quoteLines = [quoteText];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("> ")) {
        quoteLines.push(lines[i + 1].trim().substring(2));
        i++;
      }

      const combinedQuote = quoteLines.join("\n");
      let borderLeft = "3px solid rgba(255,255,255,0.15)";
      let background = "rgba(255,255,255,0.02)";
      let iconColor = "var(--text-secondary)";
      let alertLabel = "";

      if (alertType === "note") {
        borderLeft = "3px solid #22d3ee";
        background = "rgba(34, 211, 238, 0.04)";
        iconColor = "#22d3ee";
        alertLabel = "Note";
      } else if (alertType === "warning") {
        borderLeft = "3px solid #f59e0b";
        background = "rgba(245, 158, 11, 0.04)";
        iconColor = "#f59e0b";
        alertLabel = "Warning";
      } else if (alertType === "important") {
        borderLeft = "3px solid #ec4899";
        background = "rgba(236, 72, 153, 0.04)";
        iconColor = "#ec4899";
        alertLabel = "Important";
      }

      elements.push(
        <div key={`quote-${blockKey++}`} style={{
          borderLeft,
          background,
          padding: "12px 16px",
          borderRadius: "0 8px 8px 0",
          marginBottom: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}>
          {alertLabel && (
            <span style={{ fontSize: "11px", fontWeight: 800, color: iconColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {alertLabel}
            </span>
          )}
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {parseInline(combinedQuote)}
          </div>
        </div>
      );
      continue;
    }

    if (line.trim()) {
      elements.push(
        <p key={`p-${blockKey++}`} style={{ marginBottom: "14px", color: "var(--text-secondary)", lineHeight: 1.6, fontSize: "13px" }}>
          {parseInline(line)}
        </p>
      );
    }
  }

  if (inList) {
    elements.push(renderList(listItems, blockKey++));
  }

  return <div>{elements}</div>;
}

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
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>Knowledge Base</h1>
          <p className="page-subtitle" style={{ color: "var(--text-secondary)" }}>Self-service articles and IT documentation</p>
        </div>
      </div>

      {/* Search + Categories */}
      <div className="card" style={{
        marginBottom: 20,
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--border-primary)",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: 11, color: "var(--text-tertiary)" }} />
            <input placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px 9px 34px", borderRadius: 8, background: "var(--bg-input)",
                border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none",
                transition: "all 0.2s ease",
              }}
              onFocus={e => e.target.style.borderColor = "#22d3ee"}
              onBlur={e => e.target.style.borderColor = "var(--border-primary)"}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setCatFilter("")}
            className={`btn ${!catFilter ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6 }}>All</button>
          {categories.map((c: any) => (
            <button key={c.category} onClick={() => setCatFilter(c.category)}
              className={`btn ${catFilter === c.category ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6 }}>
              {c.category} <span style={{ opacity: 0.6, marginLeft: 4 }}>{c._count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Article Grid */}
      {selected ? (
        <div className="card" style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--border-primary)",
          padding: 24,
        }}>
          <button className="btn btn-secondary" style={{
            marginBottom: 20,
            fontSize: 11,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 6,
            cursor: "pointer",
          }}
            onClick={() => setSelected(null)}>
            <ArrowLeft size={12} /> Back to articles
          </button>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{selected.title}</h2>
          <div style={{ display: "flex", gap: 16, marginBottom: 20, fontSize: 12, color: "var(--text-secondary)", alignItems: "center" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: CAT_COLORS[selected.category]?.bg || "rgba(255,255,255,0.06)",
              color: CAT_COLORS[selected.category]?.color || "var(--text-primary)",
              border: `1px solid ${CAT_COLORS[selected.category]?.border || "rgba(255,255,255,0.1)"}`,
            }}>
              {selected.category}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Eye size={13} /> {selected.viewCount} views</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ThumbsUp size={13} /> {selected.helpfulCount} helpful</span>
          </div>
          {selected.tags?.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {selected.tags.map((t: string) => (
                <span key={t} style={{
                  padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: "rgba(34, 211, 238, 0.06)", color: "#22d3ee", border: "1px solid rgba(34, 211, 238, 0.15)",
                  display: "inline-flex", alignItems: "center", gap: 4
                }}>
                  <Tag size={10} />{t}
                </span>
              ))}
            </div>
          )}
          <div style={{
            padding: 24,
            borderRadius: 12,
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            lineHeight: 1.8,
            fontSize: 13,
            marginBottom: 24,
          }}>
            <MarkdownRenderer content={selected.content} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{
              fontSize: 12,
              padding: "8px 16px",
              borderRadius: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }} onClick={() => markHelpful(selected.id)}>
              <ThumbsUp size={14} /> Was this helpful? ({selected.helpfulCount})
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {articles.length === 0 ? (
            <div className="card" style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: 48,
              color: "var(--text-tertiary)",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-primary)",
            }}>
              <BookOpen size={36} style={{ margin: "0 auto 12px", color: "var(--text-tertiary)", opacity: 0.6 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>No articles found</div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{search ? "Try a different search term" : "No knowledge base articles yet"}</p>
            </div>
          ) : articles.map((a: any) => (
            <div key={a.id} className="card" style={{
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-primary)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
            }}
              onClick={() => viewArticle(a.id)}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "#22d3ee";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(34, 211, 238, 0.05)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--border-primary)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  background: CAT_COLORS[a.category]?.bg || "rgba(255,255,255,0.06)",
                  color: CAT_COLORS[a.category]?.color || "var(--text-primary)",
                  border: `1px solid ${CAT_COLORS[a.category]?.border || "rgba(255,255,255,0.1)"}`,
                }}>
                  {a.category}
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{a.title}</h3>
              <p style={{
                fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16,
                overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                flexGrow: 1,
              }}>
                {a.content.replace(/[#*>\-|]/g, "").substring(0, 150)}...
              </p>
              <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-tertiary)", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10, marginTop: "auto" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Eye size={11} /> {a.viewCount}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ThumbsUp size={11} /> {a.helpfulCount}</span>
                {a.tags?.length > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Tag size={11} /> {a.tags.length} tags</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
