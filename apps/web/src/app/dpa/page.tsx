"use client";

import Link from "next/link";
import { PublicShell, MonoEyebrow, usePublicTheme } from "@/components/landing/PublicShell";

const SECTIONS = [
  {
    id: "parties",
    title: "1. Parties & roles",
    body: `This Data Processing Addendum ("DPA") forms part of the agreement between NeurQ AI Labs Private Limited ("Processor", "we") and the customer entity that subscribes to QS Assets ("Controller", "you"). You determine the purposes and means of processing Customer Personal Data; we process it only to provide the QS Assets service.`,
  },
  {
    id: "scope",
    title: "2. Scope of processing",
    body: `We process account identifiers, contact details, authentication data, asset inventory metadata, telemetry necessary for discovery/monitoring, support tickets, and related operational logs. Processing is limited to delivering, securing, supporting, and improving the Service as described in our Privacy Policy.`,
  },
  {
    id: "instructions",
    title: "3. Documented instructions",
    body: `We process Customer Personal Data only on your documented instructions, including configuration you set in the product, unless required by applicable Indian law. Unlawful instructions may be refused with notice.`,
  },
  {
    id: "security",
    title: "4. Security measures",
    body: `We implement appropriate technical and organizational measures including TLS in transit, access controls and MFA/SSO options, tenant isolation (application filters and Postgres RLS), encryption of secrets, vulnerability management, and audit logging. Controls operate under our SOC 2 security program. Details: qsasset.com/security.`,
  },
  {
    id: "personnel",
    title: "5. Personnel",
    body: `Personnel authorized to process Customer Personal Data are bound by confidentiality obligations and receive security awareness appropriate to their role.`,
  },
  {
    id: "subprocessors",
    title: "6. Subprocessors",
    body: `You authorize us to engage subprocessors needed to host and operate the SaaS offering (currently including cloud hosting and transactional email). A current summary appears on the Security Trust Center. We remain responsible for subprocessor performance and will impose data-protection obligations no less protective than this DPA.`,
  },
  {
    id: "transfers",
    title: "7. International transfers",
    body: `Primary SaaS processing for Indian customers is oriented toward India/DPDP Act 2023 requirements. Where processing occurs in other regions for hosting or support, we use contractual and technical safeguards consistent with applicable law and your deployment choices (including self-host / on-premise options).`,
  },
  {
    id: "assistance",
    title: "8. Data subject rights & assistance",
    body: `Taking into account the nature of processing, we will assist you in responding to requests from data principals / data subjects under DPDP and other applicable laws, via product features and reasonable support.`,
  },
  {
    id: "breach",
    title: "9. Personal data breach",
    body: `We will notify you without undue delay after becoming aware of a personal data breach affecting Customer Personal Data, and provide information reasonably available to help you meet your notification obligations.`,
  },
  {
    id: "deletion",
    title: "10. Return & deletion",
    body: `Upon termination of the Service, we will delete or return Customer Personal Data in accordance with the product retention settings and Privacy Policy, except where retention is required by law or for secure backups that age out on a defined schedule.`,
  },
  {
    id: "audit",
    title: "11. Audit & information",
    body: `Upon reasonable written request, we will make available information necessary to demonstrate compliance with this DPA, including relevant security summaries and SOC 2 program attestations under NDA where applicable.`,
  },
  {
    id: "precedence",
    title: "12. Precedence",
    body: `If there is a conflict between this DPA and the Terms of Service regarding data protection, this DPA controls. For general privacy practices see the Privacy Policy. Contact: privacy@qsasset.com or contact@qsasset.com.`,
  },
];

export default function DpaPage() {
  const t = usePublicTheme();

  return (
    <PublicShell maxWidth={800}>
      <MonoEyebrow muted={t.muted} light={t.L}>
        Legal · DPA
      </MonoEyebrow>
      <h1 className="font-serif" style={{ fontSize: "clamp(32px, 4vw, 44px)", lineHeight: 0.95, marginBottom: 12 }}>
        Data Processing Addendum
      </h1>
      <p style={{ fontSize: 14, color: t.muted, marginBottom: 8, fontWeight: 300 }}>
        Last updated: July 14, 2026 · Operated by NeurQ AI Labs Private Limited
      </p>
      <p style={{ fontSize: 14, color: t.muted, marginBottom: 36, lineHeight: 1.6 }}>
        Related:{" "}
        <Link href="/privacy" style={{ color: "#0891b2" }}>
          Privacy
        </Link>
        {" · "}
        <Link href="/security" style={{ color: "#0891b2" }}>
          Security
        </Link>
        {" · "}
        <Link href="/terms" style={{ color: "#0891b2" }}>
          Terms
        </Link>
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: t.txt }}>{s.title}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: t.pTxt, margin: 0, fontWeight: 300 }}>{s.body}</p>
          </section>
        ))}
      </div>
    </PublicShell>
  );
}
