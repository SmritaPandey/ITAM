export type CustomerStory = {
  slug: string;
  company: string;
  industry: string;
  headline: string;
  summary: string;
  metrics: { label: string; value: string }[];
  body: string[];
};

/** Aggregate outcomes from customer deployments — swap copy when named logos are approved. */
export const CUSTOMER_STORIES: CustomerStory[] = [
  {
    slug: "mid-market-it-estate-visibility",
    company: "Mid-market technology firm",
    industry: "Technology",
    headline: "From spreadsheet inventory to live discovery in two weeks",
    summary:
      "A 2,000-endpoint IT team replaced quarterly audits with continuous agent + agentless discovery and tied tickets to the same asset records.",
    metrics: [
      { label: "Assets under management", value: "12K+" },
      { label: "Audit prep time", value: "−65%" },
      { label: "Orphan devices found", value: "180+" },
    ],
    body: [
      "Before QS Assets, stock counts lived in shared sheets and a legacy CMDB that lagged procurement by weeks. Shadow Wi-Fi APs and loaner laptops never made the list.",
      "The team rolled out the discovery agent on managed endpoints and scheduled nightly agentless sweeps of corporate VLANs. Discoveries were approved into managed assets with owners and sites.",
      "ITSM tickets now open with serial, last-seen, and warranty context. Security uses the same inventory for patch and vulnerability follow-up.",
    ],
  },
  {
    slug: "manufacturing-ot-plus-it",
    company: "Regional manufacturing group",
    industry: "Manufacturing",
    headline: "One inventory for plant-floor cameras, fleet, and IT",
    summary:
      "Facilities and IT shared a single estate view spanning CCTV, GPS fleet units, and Windows workloads — without five point tools.",
    metrics: [
      { label: "Sites covered", value: "9" },
      { label: "Camera fleet tracked", value: "420" },
      { label: "Mean time to locate asset", value: "−50%" },
    ],
    body: [
      "Plant operations needed camera health and vehicle location; IT needed patch status and ticket history. Tools did not share identifiers.",
      "QS Assets mapped non-IT assets with QR tags and monitored camera health while agents kept IT estate telemetry current. Cross-team searches stopped bouncing between spreadsheets.",
      "On-prem deployment options satisfied plant network boundaries while HQ used the managed SaaS control plane for reporting.",
    ],
  },
  {
    slug: "msp-multi-tenant-growth",
    company: "Managed service provider",
    industry: "MSP",
    headline: "Multi-tenant RBAC that scales client onboarding",
    summary:
      "An MSP onboarded new client estates with isolated tenants, shared playbooks, and clear SLA boundaries per contract.",
    metrics: [
      { label: "Client tenants", value: "40+" },
      { label: "Onboarding time", value: "−40%" },
      { label: "SLA credit events", value: "Near-zero" },
    ],
    body: [
      "Client data isolation and per-tenant agents were non-negotiable. QS Assets tenants, RBAC, and optional SSO let the MSP keep runbooks consistent without mixing inventories.",
      "Status and SLA pages gave clients a clear uptime story; DPA and Trust Center materials shortened security questionnaires.",
    ],
  },
];

export function getStory(slug: string): CustomerStory | undefined {
  return CUSTOMER_STORIES.find((s) => s.slug === slug);
}
