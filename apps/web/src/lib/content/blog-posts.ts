export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  body: string[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "it-asset-discovery-without-blind-spots",
    title: "IT asset discovery without blind spots",
    description:
      "How agent + agentless scanning closes gaps across laptops, servers, network gear, and OT devices in one inventory.",
    date: "2026-07-01",
    author: "NeurQ AI Labs",
    tags: ["Discovery", "ITAM"],
    body: [
      "Most IT estates still run on spreadsheets, last-known CMDB records, and tribal knowledge. That works until a laptop ships, a switch is replaced, or an OT controller appears on the LAN without a ticket.",
      "QS Assets combines a lightweight discovery agent (Windows, macOS, Linux) with agentless SNMP, SSH, WMI, and nmap sweeps so you can see both managed endpoints and network-attached gear from one control plane.",
      "Start with a free Starter workspace, connect one subnet you own, and reconcile discoveries into managed assets. From there, ITSM, vulnerability workflows, and monitoring attach to the same inventory — not five disconnected tools.",
      "If you are evaluating discovery for India-based or hybrid SaaS/on-prem deployments, see our Security Trust Center and DPA for how tenant isolation and DPDP-oriented controls are designed.",
    ],
  },
  {
    slug: "unified-itam-itsm-for-lean-it-teams",
    title: "Unified ITAM + ITSM for lean IT teams",
    description:
      "Why splitting asset inventory from the service desk creates silent SLA failures — and how one platform fixes it.",
    date: "2026-06-18",
    author: "NeurQ AI Labs",
    tags: ["ITSM", "Operations"],
    body: [
      "When assets live in one system and tickets in another, technicians waste minutes looking up serials, owners, and warranty status before they can diagnose an incident.",
      "QS Assets keeps the asset record beside the ticket: lifecycle state, last discovery, related CIs, and open changes. Escalation and SLA timers still run on the ITSM side, but context travels with the work item.",
      "Lean teams also benefit from automation rules that open tickets from threshold alerts or USB/port anomalies when agents are installed — without standing up a separate SOAR stack on day one.",
      "Professional plans include unlimited assets and the ITSM + SLA engine; Enterprise adds SSO and on-prem options when policy requires it.",
    ],
  },
  {
    slug: "dpdp-ready-asset-operations",
    title: "DPDP-ready asset operations in India",
    description:
      "Practical controls for asset telemetry, access, and retention when operating under the DPDP Act 2023.",
    date: "2026-05-28",
    author: "NeurQ AI Labs",
    tags: ["Security", "Compliance"],
    body: [
      "Asset platforms collect endpoints, user assignments, and operational telemetry. That data supports availability and security — and it must be handled as personal data when identifiers link to people.",
      "QS Assets is built with RBAC, MFA/SSO options, tenant isolation (including Postgres RLS), activity trails, and retention-minded product settings. Our Privacy Policy and DPA spell out controller/processor roles for B2B customers.",
      "SOC 2 security controls cover access, change, and availability practices on the managed SaaS offering. Self-host deployments keep data on your infrastructure when residency requires it.",
      "Read the Trust Center for subprocessors and disclosure contacts, or talk to sales for enterprise order forms with custom SLA language.",
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
