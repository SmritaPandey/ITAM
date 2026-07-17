export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026.07",
    date: "2026-07-14",
    title: "Trust center & public GTM surfaces",
    items: [
      "Public pricing, security, DPA, SLA, and status pages",
      "First-party conversion events with UTM capture",
      "Sitemap/robots hygiene and security.txt",
      "About, blog, changelog, and customer stories hub",
    ],
  },
  {
    version: "2026.06",
    date: "2026-06-20",
    title: "Enterprise discovery & operations depth",
    items: [
      "Cloud connectors, AD sync, and agentless discovery modes",
      "NOC, NetFlow, and syslog/trap → ticket paths",
      "Vulnerability workflows and patch catalog surfaces",
      "MFA, SSO, and tenant RLS hardening",
    ],
  },
  {
    version: "2026.05",
    date: "2026-05-12",
    title: "ITSM + asset lifecycle",
    items: [
      "Service desk SLA, problems, and changes",
      "CMDB relationships and impact context",
      "Procurement and license visibility",
      "Mobile /scan PWA for barcode workflows",
    ],
  },
];
