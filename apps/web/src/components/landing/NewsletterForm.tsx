"use client";

import { useState } from "react";
import { trackEvent } from "@/components/Analytics";

export function NewsletterForm({
  muted,
  txt,
  border,
  L,
  voidBtn,
  voidTxt,
}: {
  muted: string;
  txt: string;
  border: string;
  L: boolean;
  voidBtn: string;
  voidTxt: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setMsg("");
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api/v1";
      const res = await fetch(`${API}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Newsletter",
          email: email.trim(),
          subject: "Newsletter signup",
          message: `Please add ${email.trim()} to product updates / newsletter.`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Signup failed");
      }
      trackEvent("newsletter_signup", { source: "footer_or_page" });
      setStatus("done");
      setMsg("Thanks — you are on the list.");
      setEmail("");
    } catch (err: unknown) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          aria-label="Email for product updates"
          style={{
            flex: 1,
            minWidth: 180,
            padding: "11px 14px",
            borderRadius: 8,
            border: `1px solid ${border}`,
            background: L ? "#fff" : "rgba(0,0,0,0.35)",
            color: txt,
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          style={{
            padding: "11px 18px",
            borderRadius: 8,
            border: "none",
            background: voidBtn,
            color: voidTxt,
            fontSize: 14,
            fontWeight: 600,
            cursor: status === "loading" ? "wait" : "pointer",
          }}
        >
          {status === "loading" ? "…" : "Get updates"}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: status === "error" ? "#ef4444" : muted }}>
        {msg || "Product updates only. No ad networks. Unsubscribe anytime via contact."}
      </p>
    </form>
  );
}
