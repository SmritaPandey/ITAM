export type DocTopic = {
  slug: string;
  title: string;
  description: string;
  category: string;
  body: string[];
  hubAnchor: string;
};

/** SEO-friendly doc landings that deep-link into the interactive docs hub. */
export const DOC_TOPICS: DocTopic[] = [
  {
    slug: "quickstart",
    title: "Quick start — deploy QS Assets",
    description: "Stand up a QS Assets evaluation in minutes with Docker Compose, migrations, and login checks.",
    category: "Getting Started",
    hubAnchor: "quickstart",
    body: [
      "QS Assets can run as managed SaaS or self-hosted with Docker and PostgreSQL. For a local evaluation, clone the repository, copy the env template, and start the production-style Compose stack.",
      "After containers are healthy, run database migrations and optional seeds inside the API service. Confirm API health and open the web app to create or sign into a workspace.",
      "Next, install the discovery agent on a lab machine you own, or run an agentless scan against an approved subnet. Approve discoveries into managed assets before enabling automation.",
    ],
  },
  {
    slug: "agent-install",
    title: "Install the QS Discovery Agent",
    description: "Deploy the agent as a Windows service, macOS LaunchDaemon, or Linux systemd unit.",
    category: "Agents",
    hubAnchor: "agent-install",
    body: [
      "Download the platform-specific agent package from your tenant’s Discovery or Admin surfaces. Configure the API base URL and enrollment token issued by your workspace.",
      "On Windows install as a service; on macOS use the LaunchDaemon package; on Linux prefer the systemd unit so the agent starts on boot and reports inventory in the background.",
      "Verify heartbeats in the console. If the agent cannot reach the API, check TLS interception, firewall allow-lists, and clock skew before reissuing tokens.",
    ],
  },
  {
    slug: "agentless",
    title: "Agentless network discovery",
    description: "Find routers, switches, printers, and servers with SNMP, SSH, WMI, and nmap without installing software on targets.",
    category: "Discovery",
    hubAnchor: "agentless",
    body: [
      "Agentless discovery is ideal for network gear and hosts where agents are not permitted. Provide credentials and CIDR ranges you are authorized to scan.",
      "Results appear as discoveries for review. Promote confirmed devices to assets, attach sites/departments, and schedule recurring sweeps.",
      "Always follow your organization’s scanning policy — only probe networks and systems you are permitted to assess.",
    ],
  },
  {
    slug: "api",
    title: "QS Assets REST API overview",
    description: "Authenticate and call the QS Assets API for assets, tickets, discovery, and integrations.",
    category: "API",
    hubAnchor: "api",
    body: [
      "The API is versioned under /api/v1. Use bearer tokens from interactive login or service credentials where issued for your plan.",
      "Common resources include assets, tickets, discovery jobs, and settings. Rate limits and tenant scoping apply to every request.",
      "For SSO and billing administration, use the authenticated admin and settings endpoints documented in the hub.",
    ],
  },
  {
    slug: "onprem",
    title: "On-premise / self-host deployment",
    description: "Run QS Assets on your infrastructure with Docker, PostgreSQL, and optional Redis.",
    category: "Deployment",
    hubAnchor: "onprem",
    body: [
      "Self-host when data residency or network segmentation requires it. Provision PostgreSQL (PostGIS recommended), Redis for queues, and reverse TLS termination at your edge.",
      "Set APP_URL, DATABASE_URL, JWT secrets, and CORS origins to match your domain. Apply migrations before opening traffic.",
      "Enterprise plans include on-prem packaging options — contact sales for license keys and support channels.",
    ],
  },
  {
    slug: "saas-sso",
    title: "SSO and MFA for QS Assets",
    description: "Configure SAML/OIDC SSO and TOTP MFA for tenant administrators and technicians.",
    category: "Security",
    hubAnchor: "saas-sso",
    body: [
      "Enable MFA for privileged roles first. TOTP challenges are enforced at login after password verification.",
      "SSO connects via your IdP using SAML or OIDC redirect/ACS URLs shown in Admin. Map groups to QS Assets roles carefully before forcing SSO-only login.",
      "See the Security Trust Center for broader encryption, RLS, and audit practices.",
    ],
  },
];

export function getDocTopic(slug: string): DocTopic | undefined {
  return DOC_TOPICS.find((t) => t.slug === slug);
}
