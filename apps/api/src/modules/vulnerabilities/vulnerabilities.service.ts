import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { TicketsService } from '../tickets/tickets.service';

const NVD_API_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const PAGE_SIZE = 100;
const MAX_PAGES = 5; // ~500 recent CVEs per ingest (v1)

@Injectable()
export class VulnerabilitiesService {
  private readonly logger = new Logger(VulnerabilitiesService.name);
  private ingesting = false;

  constructor(
    private prisma: PrismaService,
    @Optional() private ticketsService?: TicketsService,
  ) {}

  // ─── NVD Ingest ───────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledIngest() {
    if (process.env.DISABLE_CRON_JOBS === 'true') return;
    this.logger.log('Scheduled NVD CVE ingest starting…');
    try {
      await this.ingestFromNvd();
    } catch (err: any) {
      this.logger.error(`Scheduled NVD ingest failed: ${err?.message || err}`);
    }
  }

  async ingestFromNvd(opts?: { daysBack?: number }) {
    if (this.ingesting) {
      return { status: 'already_running', upserted: 0 };
    }
    this.ingesting = true;
    const daysBack = opts?.daysBack ?? 7;
    let upserted = 0;
    let startIndex = 0;
    let totalResults = Infinity;

    try {
      const apiKey = process.env.NVD_API_KEY?.trim() || '';
      const formatNvdDate = (d: Date) =>
        d.toISOString().replace(/\.\d{3}Z$/, '.000');
      const pubStartDate = formatNvdDate(new Date(Date.now() - daysBack * 86400000));
      const pubEndDate = formatNvdDate(new Date());

      for (let page = 0; page < MAX_PAGES && startIndex < totalResults; page++) {
        const url = new URL(NVD_API_URL);
        url.searchParams.set('resultsPerPage', String(PAGE_SIZE));
        url.searchParams.set('startIndex', String(startIndex));
        url.searchParams.set('pubStartDate', pubStartDate);
        url.searchParams.set('pubEndDate', pubEndDate);

        const headers: Record<string, string> = {
          Accept: 'application/json',
          'User-Agent': 'QS-Asset-Vulnerability-Engine/1.0',
        };
        if (apiKey) headers['apiKey'] = apiKey;

        this.logger.log(`NVD fetch startIndex=${startIndex} page=${page + 1}`);
        const res = await fetch(url.toString(), { headers });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`NVD API ${res.status}: ${body.slice(0, 200)}`);
        }

        const data: any = await res.json();
        totalResults = data.totalResults ?? 0;
        const vulns: any[] = data.vulnerabilities || [];

        for (const item of vulns) {
          const cve = item?.cve;
          if (!cve?.id) continue;

          const metrics = cve.metrics || {};
          const cvss =
            metrics.cvssMetricV31?.[0]?.cvssData ||
            metrics.cvssMetricV30?.[0]?.cvssData ||
            metrics.cvssMetricV2?.[0]?.cvssData ||
            null;

          const cvssScore = cvss?.baseScore != null ? Number(cvss.baseScore) : null;
          const severity = this.normalizeSeverity(
            cvss?.baseSeverity || metrics.cvssMetricV2?.[0]?.baseSeverity,
            cvssScore,
          );

          const descriptions: any[] = cve.descriptions || [];
          const enDesc =
            descriptions.find((d) => d.lang === 'en')?.value ||
            descriptions[0]?.value ||
            null;

          const cpeMatches = this.extractCpeMatches(cve);
          const references = (cve.references || []).slice(0, 20).map((r: any) => ({
            url: r.url,
            source: r.source,
            tags: r.tags || [],
          }));

          await this.prisma.vulnerability.upsert({
            where: { cveId: cve.id },
            create: {
              cveId: cve.id,
              title: enDesc ? enDesc.slice(0, 200) : cve.id,
              description: enDesc,
              cvssScore,
              severity,
              publishedAt: cve.published ? new Date(cve.published) : null,
              modifiedAt: cve.lastModified ? new Date(cve.lastModified) : null,
              cpeMatches,
              references,
            },
            update: {
              title: enDesc ? enDesc.slice(0, 200) : cve.id,
              description: enDesc,
              cvssScore,
              severity,
              publishedAt: cve.published ? new Date(cve.published) : null,
              modifiedAt: cve.lastModified ? new Date(cve.lastModified) : null,
              cpeMatches,
              references,
            },
          });
          upserted++;
        }

        startIndex += PAGE_SIZE;
        // Respect NVD rate limits (no key: ~5 req/30s; with key: higher)
        if (startIndex < totalResults && page < MAX_PAGES - 1) {
          await this.sleep(apiKey ? 600 : 6500);
        }
      }

      this.logger.log(`NVD ingest complete: upserted=${upserted}, totalAvailable=${totalResults}`);
      return { status: 'ok', upserted, totalAvailable: totalResults };
    } finally {
      this.ingesting = false;
    }
  }

  private extractCpeMatches(cve: any): string[] {
    const out: string[] = [];
    const configs = cve.configurations || [];
    for (const cfg of configs) {
      for (const node of cfg.nodes || []) {
        for (const match of node.cpeMatch || []) {
          if (match.criteria) out.push(match.criteria);
          else if (match.cpe23Uri) out.push(match.cpe23Uri);
        }
      }
    }
    return [...new Set(out)].slice(0, 100);
  }

  private normalizeSeverity(raw?: string | null, score?: number | null): string {
    const s = (raw || '').toUpperCase();
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(s)) return s;
    if (score == null) return 'MEDIUM';
    if (score >= 9) return 'CRITICAL';
    if (score >= 7) return 'HIGH';
    if (score >= 4) return 'MEDIUM';
    return 'LOW';
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ─── Matching ─────────────────────────────────────────────────

  async matchAssetSoftware(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
      include: {
        osDetails: true,
        softwareInstalls: { include: { software: true } },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const products: { name: string; version?: string | null; label: string }[] = [];

    for (const inst of asset.softwareInstalls) {
      const name = inst.software?.name?.trim();
      if (!name || name.length < 3) continue;
      products.push({
        name: name.toLowerCase(),
        version: inst.version,
        label: `${name}${inst.version ? ` ${inst.version}` : ''}`,
      });
    }

    if (asset.osDetails?.osName) {
      const osName = asset.osDetails.osName.trim();
      products.push({
        name: osName.toLowerCase(),
        version: asset.osDetails.osVersion,
        label: `${osName}${asset.osDetails.osVersion ? ` ${asset.osDetails.osVersion}` : ''}`,
      });
    }

    if (products.length === 0) {
      return { assetId, matched: 0, products: 0 };
    }

    // Load recent/global CVE cache (bounded for v1 heuristic matching)
    const vulns = await this.prisma.vulnerability.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }] },
      orderBy: [{ cvssScore: 'desc' }, { publishedAt: 'desc' }],
      take: 2000,
      select: {
        id: true,
        cveId: true,
        description: true,
        title: true,
        cpeMatches: true,
        severity: true,
      },
    });

    let matched = 0;
    const now = new Date();

    for (const vuln of vulns) {
      const haystack = this.buildHaystack(vuln);
      for (const prod of products) {
        if (!this.heuristicMatch(haystack, prod.name, prod.version)) continue;

        await this.prisma.assetVulnerability.upsert({
          where: {
            assetId_vulnerabilityId: {
              assetId,
              vulnerabilityId: vuln.id,
            },
          },
          create: {
            tenantId,
            assetId,
            vulnerabilityId: vuln.id,
            status: 'OPEN',
            matchedSoftware: prod.label,
            firstSeenAt: now,
            lastSeenAt: now,
          },
          update: {
            lastSeenAt: now,
            matchedSoftware: prod.label,
          },
        });
        matched++;
        break; // one product match per CVE is enough
      }
    }

    return { assetId, matched, products: products.length, cvesChecked: vulns.length };
  }

  private buildHaystack(vuln: {
    description: string | null;
    title: string;
    cpeMatches: any;
  }): string {
    const cpes = Array.isArray(vuln.cpeMatches)
      ? vuln.cpeMatches.join(' ')
      : typeof vuln.cpeMatches === 'string'
        ? vuln.cpeMatches
        : JSON.stringify(vuln.cpeMatches || []);
    return `${vuln.title || ''} ${vuln.description || ''} ${cpes}`.toLowerCase();
  }

  /**
   * v1 matching: prefer CPE 2.3 product/vendor tokens, then description heuristics.
   */
  private heuristicMatch(
    haystack: string,
    productName: string,
    version?: string | null,
  ): boolean {
    // Normalize common noise from software names
    const cleaned = productName
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\b(inc|llc|ltd|corp|corporation|for\s+windows|x64|x86|64-bit|32-bit)\b/gi, ' ')
      .replace(/[^a-z0-9.\s+-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length < 3) return false;

    // CPE-style: cpe:2.3:a:vendor:product:version
    const cpeProduct = cleaned.replace(/\s+/g, '_').replace(/-/g, '_');
    const cpeTokens = cleaned.split(' ').filter((t) => t.length > 2);
    const cpeHit =
      haystack.includes(`:${cpeProduct}:`) ||
      (cpeTokens.length >= 2 &&
        haystack.includes(`:${cpeTokens[cpeTokens.length - 1]}:`) &&
        haystack.includes(cpeTokens[0]));

    // Prefer longer token sequences (first 2–4 significant words)
    const tokens = cleaned.split(' ').filter((t) => t.length > 1);
    const phrase = tokens.slice(0, Math.min(4, tokens.length)).join(' ');
    let nameHit = phrase.length >= 3 && haystack.includes(phrase);
    if (!nameHit) {
      const distinctive = tokens.find((t) => t.length >= 5);
      nameHit = !!(distinctive && haystack.includes(distinctive));
    }

    if (!cpeHit && !nameHit) return false;

    if (version && version.trim().length >= 2) {
      const ver = version.trim().toLowerCase();
      if (!haystack.includes(ver)) {
        const majorMinor = ver.match(/^(\d+\.\d+)/)?.[1];
        // Version absence in CVE text is common — still accept name/CPE hit
        void majorMinor;
      }
    }

    return true;
  }

  async scanTenant(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { softwareInstalls: { some: {} } },
          { osDetails: { isNot: null } },
        ],
      },
      select: { id: true },
      take: 500,
    });

    const results: any[] = [];
    let totalMatched = 0;
    for (const a of assets) {
      try {
        const r = await this.matchAssetSoftware(tenantId, a.id);
        totalMatched += r.matched;
        results.push(r);
      } catch (err: any) {
        this.logger.warn(`Match failed for asset ${a.id}: ${err?.message}`);
      }
    }

    return {
      status: 'ok',
      assetsScanned: assets.length,
      totalMatches: totalMatched,
      results,
    };
  }

  /**
   * Agent-authenticated product scan: match installed products against CVE catalog.
   * Auto-creates tickets for CRITICAL findings.
   */
  async agentProductScan(
    tenantId: string,
    body: {
      assetId?: string;
      hostname?: string;
      agentId?: string;
      products: { name: string; version?: string }[];
      autoTicket?: boolean;
      requesterId?: string;
    },
  ) {
    if (!body.products?.length) {
      throw new BadRequestException('products array is required');
    }

    let assetId = body.assetId;
    if (!assetId && body.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: body.agentId, tenantId },
        select: { assetId: true },
      });
      assetId = agent?.assetId || undefined;
    }
    if (!assetId && body.hostname) {
      const asset = await this.prisma.asset.findFirst({
        where: { tenantId, deletedAt: null, hostname: body.hostname },
        select: { id: true },
      });
      assetId = asset?.id;
    }
    if (!assetId) {
      throw new BadRequestException('Could not resolve assetId from request');
    }

    const products = body.products
      .filter((p) => p.name && p.name.trim().length >= 2)
      .map((p) => ({
        name: p.name.trim().toLowerCase(),
        version: p.version || null,
        label: `${p.name.trim()}${p.version ? ` ${p.version}` : ''}`,
      }));

    const vulns = await this.prisma.vulnerability.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }] },
      orderBy: [{ cvssScore: 'desc' }, { publishedAt: 'desc' }],
      take: 3000,
      select: {
        id: true,
        cveId: true,
        description: true,
        title: true,
        cpeMatches: true,
        severity: true,
        cvssScore: true,
      },
    });

    let matched = 0;
    const findings: any[] = [];
    const criticalFindingIds: string[] = [];
    const now = new Date();

    for (const vuln of vulns) {
      const haystack = this.buildHaystack(vuln);
      for (const prod of products) {
        if (!this.heuristicMatch(haystack, prod.name, prod.version)) continue;

        const row = await this.prisma.assetVulnerability.upsert({
          where: {
            assetId_vulnerabilityId: {
              assetId,
              vulnerabilityId: vuln.id,
            },
          },
          create: {
            tenantId,
            assetId,
            vulnerabilityId: vuln.id,
            status: 'OPEN',
            matchedSoftware: prod.label,
            firstSeenAt: now,
            lastSeenAt: now,
          },
          update: {
            lastSeenAt: now,
            matchedSoftware: prod.label,
          },
        });
        matched++;
        findings.push({
          findingId: row.id,
          cveId: vuln.cveId,
          severity: vuln.severity,
          matchedSoftware: prod.label,
        });
        if (vuln.severity === 'CRITICAL' && row.status === 'OPEN') {
          criticalFindingIds.push(row.id);
        }
        break;
      }
    }

    const tickets: any[] = [];
    const shouldTicket = body.autoTicket !== false;
    if (shouldTicket && this.ticketsService && criticalFindingIds.length > 0) {
      // Prefer a system/admin user for agent-originated tickets
      let requesterId = body.requesterId;
      if (!requesterId) {
        const admin = await this.prisma.user.findFirst({
          where: {
            tenantId,
            status: 'ACTIVE',
            role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
          },
          select: { id: true },
        });
        requesterId = admin?.id;
      }
      if (requesterId) {
        for (const findingId of criticalFindingIds.slice(0, 20)) {
          try {
            const t = await this.createTicketFromFinding(tenantId, findingId, requesterId);
            tickets.push(t.ticket?.id || t);
          } catch (err: any) {
            this.logger.warn(`Auto-ticket failed for ${findingId}: ${err?.message}`);
          }
        }
      }
    }

    return {
      status: 'ok',
      assetId,
      productsChecked: products.length,
      matched,
      critical: criticalFindingIds.length,
      ticketsCreated: tickets.length,
      findings: findings.slice(0, 100),
    };
  }

  // ─── Queries ──────────────────────────────────────────────────

  async listForTenant(
    tenantId: string,
    query: { severity?: string; status?: string; limit?: number; offset?: number } = {},
  ) {
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.severity) {
      where.vulnerability = { severity: query.severity.toUpperCase() };
    }

    const [data, total] = await Promise.all([
      this.prisma.assetVulnerability.findMany({
        where,
        include: {
          vulnerability: true,
          asset: { select: { id: true, name: true, assetTag: true, hostname: true } },
        },
        orderBy: [
          { vulnerability: { cvssScore: 'desc' } },
          { lastSeenAt: 'desc' },
        ],
        take: Math.min(query.limit || 50, 200),
        skip: query.offset || 0,
      }),
      this.prisma.assetVulnerability.count({ where }),
    ]);

    return { data, total };
  }

  async listForAsset(tenantId: string, assetId: string) {
    return this.prisma.assetVulnerability.findMany({
      where: { tenantId, assetId },
      include: { vulnerability: true },
      orderBy: [{ vulnerability: { cvssScore: 'desc' } }, { lastSeenAt: 'desc' }],
    });
  }

  async getDashboard(tenantId: string) {
    const [open, statusGroups, openFindings, recent, cveCount] = await Promise.all([
      this.prisma.assetVulnerability.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.assetVulnerability.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.assetVulnerability.findMany({
        where: { tenantId, status: 'OPEN' },
        select: { vulnerability: { select: { severity: true } } },
      }),
      this.prisma.assetVulnerability.findMany({
        where: { tenantId, status: 'OPEN' },
        include: {
          vulnerability: true,
          asset: { select: { id: true, name: true } },
        },
        orderBy: { lastSeenAt: 'desc' },
        take: 10,
      }),
      this.prisma.vulnerability.count(),
    ]);

    const bySeverity: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };
    for (const row of openFindings) {
      const sev = row.vulnerability.severity;
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }

    const byStatus: Record<string, number> = {};
    for (const g of statusGroups) {
      byStatus[g.status] = g._count;
    }

    return {
      open,
      cveCatalogSize: cveCount,
      bySeverity,
      byStatus,
      recent,
    };
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: string,
  ) {
    const allowed = ['OPEN', 'ACKNOWLEDGED', 'REMEDIATED', 'FALSE_POSITIVE'];
    const next = status.toUpperCase();
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Invalid status. Allowed: ${allowed.join(', ')}`);
    }

    const finding = await this.prisma.assetVulnerability.findFirst({
      where: { id, tenantId },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    return this.prisma.assetVulnerability.update({
      where: { id },
      data: { status: next },
      include: {
        vulnerability: true,
        asset: { select: { id: true, name: true } },
      },
    });
  }

  async createTicketFromFinding(
    tenantId: string,
    findingId: string,
    requesterId: string,
  ) {
    const finding = await this.prisma.assetVulnerability.findFirst({
      where: { id: findingId, tenantId },
      include: {
        vulnerability: true,
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    if (!this.ticketsService) {
      return { status: 'tickets_unavailable', finding };
    }

    const v = finding.vulnerability;
    const priority =
      v.severity === 'CRITICAL'
        ? 'CRITICAL'
        : v.severity === 'HIGH'
          ? 'HIGH'
          : v.severity === 'LOW'
            ? 'LOW'
            : 'MEDIUM';

    const ticket = await this.ticketsService.create(tenantId, requesterId, {
      type: 'INCIDENT',
      category: 'Vulnerability',
      subject: `${v.cveId}: ${v.title}`.slice(0, 200),
      description: [
        `Vulnerability finding on asset ${finding.asset.name}`,
        `CVE: ${v.cveId}`,
        `Severity: ${v.severity} (CVSS ${v.cvssScore ?? 'n/a'})`,
        `Matched software: ${finding.matchedSoftware || 'n/a'}`,
        '',
        v.description || '',
      ].join('\n'),
      priority,
      assetIds: [finding.assetId],
    });

    return { ticket, finding };
  }

  /** Count open critical/high findings for an asset (used by risk engine). */
  async countOpenHighCritical(tenantId: string, assetId: string) {
    const rows = await this.prisma.assetVulnerability.findMany({
      where: {
        tenantId,
        assetId,
        status: 'OPEN',
        vulnerability: { severity: { in: ['CRITICAL', 'HIGH'] } },
      },
      select: { id: true, vulnerability: { select: { severity: true } } },
    });
    return {
      critical: rows.filter((r) => r.vulnerability.severity === 'CRITICAL').length,
      high: rows.filter((r) => r.vulnerability.severity === 'HIGH').length,
      total: rows.length,
    };
  }
}
