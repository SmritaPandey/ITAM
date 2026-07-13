import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class SoftwareService {
  private readonly logger = new Logger(SoftwareService.name);
  /** Skip identical package inventories between agent heartbeats (per asset). */
  private readonly ingestFingerprints = new Map<string, string>();
  /** Serialize ingest per asset so heartbeats cannot pile up. */
  private readonly ingestInFlight = new Map<string, Promise<void>>();

  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    search?: string,
    filters?: {
      authorizationStatus?: string;
      lifecycleStatus?: string;
      category?: string;
      publisher?: string;
    },
    sortBy = 'installCount',
  ) {
    this.logger.log(`findAll: tenantId=${tenantId}, page=${page}, limit=${limit}, search=${search}, sortBy=${sortBy}`);
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // installCount sort via relation _count is very expensive on large catalogs —
    // use a single indexed LEFT JOIN instead.
    if (sortBy === 'installCount') {
      return this.findAllByInstallCount(tenantId, skip, take, search, filters);
    }

    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { publisher: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters?.authorizationStatus) {
      where.authorizationStatus = filters.authorizationStatus;
    }
    if (filters?.lifecycleStatus) {
      where.lifecycleStatus = filters.lifecycleStatus;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.publisher) {
      where.publisher = filters.publisher;
    }

    let orderBy: any = { updatedAt: 'desc' };
    if (sortBy === 'name') {
      orderBy = { name: 'asc' };
    } else if (sortBy === 'riskScore') {
      orderBy = { riskScore: 'desc' };
    } else if (sortBy === 'createdAt') {
      orderBy = { createdAt: 'desc' };
    }

    const [data, total] = await Promise.all([
      this.prisma.softwareCatalog.findMany({
        where,
        include: { _count: { select: { installations: true } } },
        orderBy,
        skip,
        take,
      }),
      this.prisma.softwareCatalog.count({ where }),
    ]);

    return { data, total, page: Number(page), limit: take };
  }

  private async findAllByInstallCount(
    tenantId: string,
    skip: number,
    take: number,
    search?: string,
    filters?: {
      authorizationStatus?: string;
      lifecycleStatus?: string;
      category?: string;
      publisher?: string;
    },
  ) {
    const params: any[] = [tenantId];
    const clauses = [`c.tenant_id = $1::uuid`];

    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      clauses.push(`(c.name ILIKE $${i} OR c.publisher ILIKE $${i})`);
    }
    if (filters?.authorizationStatus) {
      params.push(filters.authorizationStatus);
      clauses.push(`c.authorization_status = $${params.length}`);
    }
    if (filters?.lifecycleStatus) {
      params.push(filters.lifecycleStatus);
      clauses.push(`c.lifecycle_status = $${params.length}`);
    }
    if (filters?.category) {
      params.push(filters.category);
      clauses.push(`c.category = $${params.length}`);
    }
    if (filters?.publisher) {
      params.push(filters.publisher);
      clauses.push(`c.publisher = $${params.length}`);
    }

    const whereSql = clauses.join(' AND ');
    params.push(take);
    const takeIdx = params.length;
    params.push(skip);
    const skipIdx = params.length;

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `
      SELECT
        c.id, c.tenant_id AS "tenantId", c.name, c.publisher, c.category,
        c.is_blacklisted AS "isBlacklisted", c.is_authorized AS "isAuthorized",
        c.authorization_status AS "authorizationStatus",
        c.latest_version AS "latestVersion",
        c.eol_date AS "eolDate", c.eos_date AS "eosDate",
        c.lifecycle_status AS "lifecycleStatus",
        c.risk_score AS "riskScore", c.description, c.website,
        c.created_at AS "createdAt", c.updated_at AS "updatedAt",
        COALESCE(ic.cnt, 0)::int AS "installCount"
      FROM software_catalog c
      LEFT JOIN (
        SELECT software_id, COUNT(*)::int AS cnt
        FROM software_installations
        WHERE tenant_id = $1::uuid
        GROUP BY software_id
      ) ic ON ic.software_id = c.id
      WHERE ${whereSql}
      ORDER BY COALESCE(ic.cnt, 0) DESC, c.name ASC
      LIMIT $${takeIdx} OFFSET $${skipIdx}
      `,
      ...params,
    );

    const countParams = params.slice(0, params.length - 2);
    const countRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total FROM software_catalog c WHERE ${whereSql}`,
      ...countParams,
    );

    const data = rows.map((r) => ({
      ...r,
      _count: { installations: r.installCount ?? 0 },
    }));

    return {
      data,
      total: countRows[0]?.total ?? 0,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  async getDashboard(tenantId: string) {
    // Single SQL query for all counts — avoids 12 concurrent Prisma queries that OOM the container
    const countResult: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS "totalSoftware",
        COUNT(*) FILTER (WHERE "authorization_status" = 'AUTHORIZED')::int AS "authorizedCount",
        COUNT(*) FILTER (WHERE "authorization_status" = 'REQUIRED')::int AS "requiredCount",
        COUNT(*) FILTER (WHERE "authorization_status" IN ('UNAUTHORIZED','BLACKLISTED'))::int AS "unauthorizedCount",
        COUNT(*) FILTER (WHERE "authorization_status" = 'BLACKLISTED')::int AS "blacklistedCount",
        COUNT(*) FILTER (WHERE "authorization_status" = 'NEEDS_REVIEW')::int AS "needsReviewCount",
        COUNT(*) FILTER (WHERE "lifecycle_status" IN ('EOL','EOS','APPROACHING_EOL'))::int AS "eolCount",
        COUNT(*) FILTER (WHERE "risk_score" >= 50)::int AS "highRiskCount"
      FROM software_catalog WHERE tenant_id = $1::uuid
    `, tenantId);
    const c = countResult[0] || {};

    const totalInstallations = await this.prisma.softwareInstallation.count({ where: { tenantId } });

    const topPublishers = await this.prisma.softwareCatalog.groupBy({
      by: ['publisher'],
      where: { tenantId, publisher: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topCategories = await this.prisma.softwareCatalog.groupBy({
      by: ['category'],
      where: { tenantId, category: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topInstalled = await this.prisma.$queryRawUnsafe(`
      SELECT c.id, c.name, c.publisher, COALESCE(ic.cnt, 0)::int AS "installCount"
      FROM software_catalog c
      LEFT JOIN (
        SELECT software_id, COUNT(*)::int AS cnt
        FROM software_installations
        WHERE tenant_id = $1::uuid
        GROUP BY software_id
      ) ic ON ic.software_id = c.id
      WHERE c.tenant_id = $1::uuid
      ORDER BY COALESCE(ic.cnt, 0) DESC, c.name ASC
      LIMIT 10
    `, tenantId) as any[];

    return {
      totalSoftware: c.totalSoftware || 0,
      authorizedCount: c.authorizedCount || 0,
      requiredCount: c.requiredCount || 0,
      unauthorizedCount: c.unauthorizedCount || 0,
      blacklistedCount: c.blacklistedCount || 0,
      needsReviewCount: c.needsReviewCount || 0,
      eolCount: c.eolCount || 0,
      highRiskCount: c.highRiskCount || 0,
      totalInstallations,
      topPublishers: topPublishers.map((p) => ({
        publisher: p.publisher,
        count: p._count.id,
      })),
      topCategories: topCategories.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      topInstalled: topInstalled.map((s) => ({
        id: s.id,
        name: s.name,
        publisher: s.publisher,
        installationCount: s.installCount ?? 0,
        installCount: s.installCount ?? 0,
      })),
    };
  }

  async findById(id: string, tenantId: string) {
    const software = await this.prisma.softwareCatalog.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { installations: true } },
        licenses: {
          select: {
            id: true,
            softwareName: true,
            totalSeats: true,
            usedSeats: true,
            actualUsage: true,
            complianceStatus: true,
            status: true,
            expiryDate: true,
          },
        },
      },
    });

    if (!software) throw new NotFoundException('Software not found');

    // Version distribution
    const versionDistribution =
      await this.prisma.softwareInstallation.groupBy({
        by: ['version'],
        where: { softwareId: id, tenantId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

    return {
      ...software,
      versionDistribution: versionDistribution.map((v) => ({
        version: v.version ?? 'Unknown',
        count: v._count.id,
      })),
      licenses: software.licenses.map((l) => ({
        ...l,
        utilization:
          l.totalSeats > 0
            ? Math.round(((l.actualUsage ?? l.usedSeats) / l.totalSeats) * 100)
            : 0,
      })),
    };
  }

  async getAssets(
    softwareId: string,
    tenantId: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      this.prisma.softwareInstallation.findMany({
        where: { softwareId, tenantId },
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              ipAddress: true,
              hostname: true,
              status: true,
              osDetails: {
                select: { osName: true, osVersion: true },
              },
              assignedTo: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { installDate: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.softwareInstallation.count({
        where: { softwareId, tenantId },
      }),
    ]);

    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async getUsers(
    softwareId: string,
    tenantId: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (Number(page) - 1) * Number(limit);

    // Find all installations for this software, then group by user
    const installations = await this.prisma.softwareInstallation.findMany({
      where: { softwareId, tenantId },
      include: {
        asset: {
          select: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Group by user
    const userMap = new Map<
      string,
      { user: any; assetCount: number }
    >();
    for (const inst of installations) {
      const user = inst.asset?.assignedTo;
      if (!user) continue;
      const existing = userMap.get(user.id);
      if (existing) {
        existing.assetCount++;
      } else {
        userMap.set(user.id, { user, assetCount: 1 });
      }
    }

    const allUsers = Array.from(userMap.values());
    const total = allUsers.length;
    const paged = allUsers.slice(skip, skip + Number(limit));

    return {
      data: paged.map((u) => ({
        id: u.user.id,
        firstName: u.user.firstName,
        lastName: u.user.lastName,
        email: u.user.email,
        department: u.user.department?.name ?? null,
        assetCount: u.assetCount,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  async update(id: string, tenantId: string, data: any) {
    await this.findById(id, tenantId);

    const allowedFields: Record<string, boolean> = {
      authorizationStatus: true,
      eolDate: true,
      eosDate: true,
      riskScore: true,
      description: true,
      isAuthorized: true,
      lifecycleStatus: true,
      isBlacklisted: true,
      website: true,
    };

    const updateData: any = {};
    for (const key of Object.keys(data)) {
      if (allowedFields[key]) {
        updateData[key] = data[key];
      }
    }

    // Keep blacklist flags in sync
    if (updateData.authorizationStatus === 'BLACKLISTED') {
      updateData.isBlacklisted = true;
      updateData.isAuthorized = false;
    } else if (updateData.isBlacklisted === true) {
      updateData.authorizationStatus = 'BLACKLISTED';
      updateData.isAuthorized = false;
    } else if (updateData.authorizationStatus && updateData.authorizationStatus !== 'BLACKLISTED') {
      updateData.isBlacklisted = false;
    }

    const updated = await this.prisma.softwareCatalog.update({
      where: { id },
      data: updateData,
    });

    if (updated.isBlacklisted || updated.authorizationStatus === 'BLACKLISTED') {
      await this.enforceBlacklistToAgents(tenantId, updated);
    }

    return updated;
  }

  /**
   * Push KILL_PROCESS + BLOCK_INSTALL actions to agents that have this software installed.
   */
  async enforceBlacklistToAgents(
    tenantId: string,
    software: { id: string; name: string; publisher?: string | null },
  ) {
    const installs = await this.prisma.softwareInstallation.findMany({
      where: { tenantId, softwareId: software.id },
      select: { assetId: true },
    });
    const assetIds = [...new Set(installs.map((i) => i.assetId))];
    if (!assetIds.length) {
      return { enqueued: 0, assets: 0 };
    }

    const agents = await this.prisma.agent.findMany({
      where: { tenantId, assetId: { in: assetIds } },
      select: { id: true, systemInfo: true, assetId: true },
    });

    const processName = this.guessProcessName(software.name);
    let enqueued = 0;
    for (const agent of agents) {
      const info = (agent.systemInfo as any) || {};
      const pending: any[] = Array.isArray(info._pendingActions) ? info._pendingActions : [];
      pending.push({
        type: 'KILL_PROCESS',
        processName,
        reason: `Blacklisted software: ${software.name}`,
        softwareId: software.id,
        timestamp: new Date().toISOString(),
      });
      pending.push({
        type: 'UNINSTALL_PACKAGE',
        packageName: software.name,
        packageId: software.name,
        reason: 'BLACKLIST_ENFORCE',
        softwareId: software.id,
        queuedAt: new Date().toISOString(),
      });
      pending.push({
        type: 'BLOCK_INSTALL',
        softwareName: software.name,
        processName,
        publisher: software.publisher || undefined,
        reason: 'BLACKLISTED',
        timestamp: new Date().toISOString(),
      });
      info._pendingActions = pending;
      const policy = Array.isArray(info._softwarePolicy) ? info._softwarePolicy : [];
      if (!policy.find((p: any) => p.softwareId === software.id || p.name === software.name)) {
        policy.push({
          softwareId: software.id,
          name: software.name,
          action: 'BLOCK',
          processName,
        });
      }
      info._softwarePolicy = policy;
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: { systemInfo: info },
      });
      enqueued++;
    }

    this.logger.log(
      `Blacklist enforce: ${software.name} → ${enqueued} agent(s) across ${assetIds.length} asset(s)`,
    );
    return { enqueued, assets: assetIds.length, processName };
  }

  /** Push full blacklist/whitelist policy snapshot to all online agents for a tenant. */
  async pushSoftwarePolicyToAgents(tenantId: string) {
    const [blacklisted, whitelisted] = await Promise.all([
      this.prisma.softwareCatalog.findMany({
        where: {
          tenantId,
          OR: [{ isBlacklisted: true }, { authorizationStatus: 'BLACKLISTED' }],
        },
        select: { id: true, name: true, publisher: true },
      }),
      this.prisma.softwareCatalog.findMany({
        where: {
          tenantId,
          OR: [{ isAuthorized: true }, { authorizationStatus: { in: ['AUTHORIZED', 'REQUIRED'] } }],
        },
        select: { id: true, name: true },
        take: 500,
      }),
    ]);

    const policy = {
      blacklist: blacklisted.map((s) => ({
        softwareId: s.id,
        name: s.name,
        processName: this.guessProcessName(s.name),
        action: 'BLOCK',
      })),
      whitelist: whitelisted.map((s) => ({ softwareId: s.id, name: s.name })),
      updatedAt: new Date().toISOString(),
    };

    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true, systemInfo: true },
    });

    for (const agent of agents) {
      const info = (agent.systemInfo as any) || {};
      const pending: any[] = Array.isArray(info._pendingActions) ? info._pendingActions : [];
      pending.push({ type: 'SOFTWARE_POLICY', ...policy });
      info._pendingActions = pending;
      info._softwarePolicy = policy.blacklist;
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: { systemInfo: info },
      });
    }

    return {
      agentsUpdated: agents.length,
      blacklistCount: blacklisted.length,
      whitelistCount: whitelisted.length,
    };
  }

  private guessProcessName(softwareName: string): string {
    const base = (softwareName || 'unknown')
      .replace(/[^a-zA-Z0-9._\- ]/g, '')
      .trim()
      .split(/\s+/)[0];
    if (!base) return 'unknown.exe';
    return base.toLowerCase().endsWith('.exe') ? base : `${base}.exe`;
  }

  /**
   * Harvest recommendations: unused installs (stale lastUsedAt) that can be reclaimed.
   */
  async getHarvestRecommendations(tenantId: string, unusedDays = 90) {
    const cutoff = new Date(Date.now() - unusedDays * 86400000);
    const installs = await this.prisma.softwareInstallation.findMany({
      where: {
        tenantId,
        OR: [{ lastUsedAt: { lt: cutoff } }, { lastUsedAt: null }],
        software: {
          licenses: { some: {} },
        },
      },
      include: {
        software: {
          select: {
            id: true,
            name: true,
            publisher: true,
            licenses: {
              select: { id: true, totalSeats: true, usedSeats: true, purchaseCost: true },
            },
          },
        },
        asset: {
          select: {
            id: true,
            name: true,
            assetTag: true,
            hostname: true,
            assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { lastUsedAt: 'asc' },
      take: 200,
    });

    return installs.map((i) => {
      const daysUnused = i.lastUsedAt
        ? Math.floor((Date.now() - new Date(i.lastUsedAt).getTime()) / 86400000)
        : null;
      return {
        installationId: i.id,
        softwareId: i.software.id,
        softwareName: i.software.name,
        publisher: i.software.publisher,
        assetId: i.asset.id,
        assetName: i.asset.name,
        assetTag: i.asset.assetTag,
        hostname: i.asset.hostname,
        assignedTo: i.asset.assignedTo,
        lastUsedAt: i.lastUsedAt,
        daysUnused,
        version: i.version,
        recommendation: 'RECLAIM',
        licenses: i.software.licenses,
      };
    });
  }

  /** Create reclaim ticket and optionally enqueue uninstall on the agent. */
  async reclaimHarvest(
    tenantId: string,
    userId: string,
    data: { installationId: string; createTicket?: boolean; uninstall?: boolean },
  ) {
    const inst = await this.prisma.softwareInstallation.findFirst({
      where: { id: data.installationId, tenantId },
      include: {
        software: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    });
    if (!inst) throw new NotFoundException('Installation not found');

    let ticket: any = null;
    if (data.createTicket !== false) {
      const count = await this.prisma.ticket.count({ where: { tenantId } });
      const ticketNumber = `INC-${String(count + 1).padStart(5, '0')}`;
      ticket = await this.prisma.ticket.create({
        data: {
          tenantId,
          ticketNumber,
          type: 'SERVICE_REQUEST',
          subject: `Reclaim unused license: ${inst.software.name}`,
          description: `Harvest recommendation: ${inst.software.name} on ${inst.asset.name} (${inst.asset.assetTag || inst.asset.id}) appears unused (last used: ${inst.lastUsedAt ? inst.lastUsedAt.toISOString() : 'never'}). Please uninstall and reclaim the seat.`,
          priority: 'LOW',
          status: 'NEW',
          category: 'Software',
          requesterId: userId,
        },
      });
      await this.prisma.ticketAsset.create({
        data: { ticketId: ticket.id, assetId: inst.assetId },
      });
    }

    let agentAction: any = null;
    if (data.uninstall) {
      const agent = await this.prisma.agent.findFirst({
        where: { tenantId, assetId: inst.assetId },
      });
      if (agent) {
        const info = (agent.systemInfo as any) || {};
        const pending: any[] = Array.isArray(info._pendingActions) ? info._pendingActions : [];
        agentAction = {
          type: 'UNINSTALL_SOFTWARE',
          softwareName: inst.software.name,
          processName: this.guessProcessName(inst.software.name),
          installationId: inst.id,
          timestamp: new Date().toISOString(),
        };
        pending.push(agentAction);
        info._pendingActions = pending;
        await this.prisma.agent.update({
          where: { id: agent.id },
          data: { systemInfo: info },
        });
      }
    }

    return {
      installationId: inst.id,
      softwareName: inst.software.name,
      assetId: inst.assetId,
      ticket,
      agentAction,
    };
  }

  async getByUser(userId: string, tenantId: string) {
    // Find all assets assigned to user, then their software installations
    const installations = await this.prisma.softwareInstallation.findMany({
      where: {
        tenantId,
        asset: { assignedToId: userId },
      },
      include: {
        software: {
          select: {
            id: true,
            name: true,
            publisher: true,
            category: true,
            authorizationStatus: true,
            lifecycleStatus: true,
            riskScore: true,
          },
        },
        asset: {
          select: { id: true, name: true, hostname: true },
        },
      },
      orderBy: { installDate: 'desc' },
    });

    return installations;
  }

  async getUtilization(tenantId: string) {
    // For each software with licenses, compare totalSeats vs actual installations
    const softwareWithLicenses =
      await this.prisma.softwareCatalog.findMany({
        where: {
          tenantId,
          licenses: { some: {} },
        },
        select: {
          id: true,
          name: true,
          publisher: true,
          _count: { select: { installations: true } },
          licenses: {
            select: {
              id: true,
              totalSeats: true,
              usedSeats: true,
              actualUsage: true,
              complianceStatus: true,
              status: true,
            },
          },
        },
      });

    return softwareWithLicenses.map((sw) => {
      const totalLicensedSeats = sw.licenses.reduce(
        (sum, l) => sum + l.totalSeats,
        0,
      );
      const actualInstallations = sw._count.installations;
      const utilizationPercent =
        totalLicensedSeats > 0
          ? Math.round((actualInstallations / totalLicensedSeats) * 100)
          : 0;

      return {
        id: sw.id,
        name: sw.name,
        publisher: sw.publisher,
        totalLicensedSeats,
        actualInstallations,
        utilizationPercent,
        status:
          actualInstallations > totalLicensedSeats
            ? 'OVER_LICENSED'
            : actualInstallations < totalLicensedSeats * 0.5
              ? 'UNDER_UTILIZED'
              : 'COMPLIANT',
        licenses: sw.licenses,
      };
    });
  }

  async getEolSoftware(tenantId: string) {
    const now = new Date();

    const software = await this.prisma.softwareCatalog.findMany({
      where: {
        tenantId,
        OR: [
          { lifecycleStatus: { in: ['EOL', 'EOS', 'APPROACHING_EOL'] } },
          { eolDate: { lte: now } },
          { eosDate: { lte: now } },
        ],
      },
      include: { _count: { select: { installations: true } } },
      orderBy: { eolDate: 'asc' },
    });

    return software;
  }

  async getUnauthorized(tenantId: string) {
    const software = await this.prisma.softwareCatalog.findMany({
      where: {
        tenantId,
        OR: [
          { authorizationStatus: 'UNAUTHORIZED' },
          { isBlacklisted: true },
        ],
      },
      include: { _count: { select: { installations: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return software;
  }

  /**
   * Deterministic initial risk score (0-100) for newly discovered software,
   * based on known-risky software classes and publisher trust signals.
   * Refined later by vulnerability correlation and lifecycle (EOL) data.
   */
  private computeInitialRiskScore(name: string, publisher?: string): number {
    const n = (name || '').toLowerCase();
    const p = (publisher || '').toLowerCase();
    let score = 0;

    // High-risk classes: remote access, P2P/torrent, password crackers, keygens, anonymizers
    const highRisk = [
      'teamviewer', 'anydesk', 'ammyy', 'ultraviewer', 'remote utilities',
      'utorrent', 'bittorrent', 'qbittorrent', 'limewire', 'frostwire',
      'keygen', 'crack', 'activator', 'kmspico', 'hacktool',
      'tor browser', 'psiphon', 'ultrasurf', 'hotspot shield',
      'mimikatz', 'cain', 'john the ripper', 'hashcat', 'wireshark',
      'nmap', 'netcat', 'angry ip scanner', 'advanced port scanner',
    ];
    // Medium-risk: file sharing, browser toolbars, unmanaged cloud sync, gaming platforms on corp assets
    const mediumRisk = [
      'dropbox', 'megasync', 'wetransfer', 'sharex',
      'steam', 'epic games', 'battle.net', 'discord',
      'toolbar', 'coupon', 'search protect', 'driver booster', 'driver updater',
      'cheat engine', 'auto clicker',
    ];
    // Trusted publishers reduce baseline risk
    const trustedPublishers = [
      'microsoft', 'apple', 'google', 'adobe', 'mozilla', 'oracle',
      'ibm', 'cisco', 'vmware', 'red hat', 'canonical', 'suse',
      'dell', 'hp', 'lenovo', 'intel', 'nvidia', 'amd', 'jetbrains',
      'atlassian', 'zoom video', 'slack', 'salesforce', 'sap',
    ];

    if (highRisk.some((k) => n.includes(k))) score += 70;
    else if (mediumRisk.some((k) => n.includes(k))) score += 40;

    const isTrusted = trustedPublishers.some((t) => p.includes(t));
    if (!publisher || p === 'unknown' || p.trim() === '') {
      score += 20; // Unknown provenance
    } else if (!isTrusted && score === 0) {
      score += 10; // Unverified third-party publisher
    }
    if (isTrusted) score = Math.max(0, score - 15);

    // Beta/nightly/portable builds carry more operational risk
    if (/\b(beta|alpha|nightly|portable|preview)\b/.test(n)) score += 10;

    return Math.min(100, score);
  }

  async ingestSoftware(
    tenantId: string,
    assetId: string,
    packages: {
      name: string;
      version: string;
      publisher?: string;
      description?: string;
    }[],
  ) {
    if (!packages || !Array.isArray(packages) || packages.length === 0) return;

    const fingerprint = this.packageFingerprint(packages);
    if (this.ingestFingerprints.get(assetId) === fingerprint) {
      return; // unchanged inventory — skip redundant heartbeat upserts
    }

    const existing = this.ingestInFlight.get(assetId);
    if (existing) {
      await existing; // coalesce concurrent heartbeats for same asset
      if (this.ingestFingerprints.get(assetId) === fingerprint) return;
    }

    const run = this.runIngest(tenantId, assetId, packages, fingerprint);
    this.ingestInFlight.set(assetId, run);
    try {
      await run;
    } finally {
      if (this.ingestInFlight.get(assetId) === run) {
        this.ingestInFlight.delete(assetId);
      }
    }
  }

  private packageFingerprint(
    packages: { name: string; version: string; publisher?: string }[],
  ): string {
    return packages
      .map((p) => `${p.name}\0${p.version}\0${p.publisher || ''}`)
      .sort()
      .join('\n');
  }

  private async runIngest(
    tenantId: string,
    assetId: string,
    packages: {
      name: string;
      version: string;
      publisher?: string;
      description?: string;
    }[],
    fingerprint: string,
  ) {
    this.logger.log(`Ingesting ${packages.length} packages for asset ${assetId}`);

    // Process in chunks of 3 to keep connection pool free for UI queries
    const CHUNK_SIZE = 3;
    for (let i = 0; i < packages.length; i += CHUNK_SIZE) {
      const chunk = packages.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (pkg) => {
          try {
            const software = await this.prisma.softwareCatalog.upsert({
              where: {
                tenantId_name_publisher: {
                  tenantId,
                  name: pkg.name,
                  publisher: pkg.publisher || 'Unknown',
                },
              },
              create: {
                tenantId,
                name: pkg.name,
                publisher: pkg.publisher || 'Unknown',
                description: pkg.description,
                latestVersion: pkg.version,
                authorizationStatus: 'NEEDS_REVIEW',
                lifecycleStatus: 'CURRENT',
                riskScore: this.computeInitialRiskScore(pkg.name, pkg.publisher),
              },
              update: {
                latestVersion: pkg.version,
                description: pkg.description || undefined,
              },
            });

            await this.prisma.softwareInstallation.upsert({
              where: {
                tenantId_assetId_softwareId: {
                  tenantId,
                  assetId,
                  softwareId: software.id,
                },
              },
              create: {
                tenantId,
                assetId,
                softwareId: software.id,
                version: pkg.version,
                installDate: new Date(),
                lastUsedAt: new Date(),
              },
              update: {
                version: pkg.version,
                lastUsedAt: new Date(),
              },
            });

            if (
              software.isBlacklisted ||
              software.authorizationStatus === 'BLACKLISTED'
            ) {
              await this.enforceBlacklistToAgents(tenantId, software);
            }
          } catch (err) {
            this.logger.error(`Failed to ingest software ${pkg.name} for asset ${assetId}: ${err.message}`);
          }
        }),
      );
    }

    this.ingestFingerprints.set(assetId, fingerprint);
  }

  /**
   * Queue UNINSTALL_PACKAGE on the agent linked to this asset when blacklisted software is detected.
   */
  async enqueueBlacklistUninstall(
    tenantId: string,
    assetId: string,
    packageName: string,
    version?: string,
  ) {
    const agent = await this.prisma.agent.findFirst({
      where: { tenantId, assetId, status: { in: ['ONLINE', 'STALE'] } },
      select: { id: true, systemInfo: true, hostname: true },
    });
    if (!agent) return { queued: false, reason: 'no_agent' };

    const info = (agent.systemInfo as any) || {};
    const pending: any[] = Array.isArray(info._pendingActions) ? info._pendingActions : [];
    const already = pending.some(
      (a) =>
        a.type === 'UNINSTALL_PACKAGE' &&
        (a.packageName === packageName || a.winget === packageName || a.packageId === packageName),
    );
    if (already) return { queued: false, reason: 'already_queued' };

    pending.push({
      type: 'UNINSTALL_PACKAGE',
      packageName,
      packageId: packageName,
      version: version || undefined,
      reason: 'BLACKLIST_ENFORCE',
      queuedAt: new Date().toISOString(),
    });

    await this.prisma.agent.update({
      where: { id: agent.id },
      data: { systemInfo: { ...info, _pendingActions: pending } },
    });

    try {
      await this.prisma.alertEvent.create({
        data: {
          tenantId,
          severity: 'HIGH',
          category: 'SOFTWARE_BLACKLIST',
          title: `Blacklisted software removed: ${packageName}`,
          message: `Queued uninstall of blacklisted package "${packageName}" on ${agent.hostname || assetId}`,
          source: 'SoftwarePolicy',
          sourceId: assetId,
          metadata: { packageName, version, agentId: agent.id },
        },
      });
    } catch {
      /* alert optional */
    }

    this.logger.warn(
      `Blacklist enforce: queued UNINSTALL_PACKAGE "${packageName}" on agent ${agent.hostname}`,
    );
    return { queued: true, agentId: agent.id };
  }

  /**
   * Manually triggers a re-sync of software installations from the latest
   * discovery enrichment data for all approved assets.
   */
  async syncFromDiscovery(tenantId: string) {
    this.logger.log(`Manual sync initiated for tenant ${tenantId}`);

    const approvedDevices = await this.prisma.discoveredDevice.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        approvedAssetId: { not: null },
        enrichmentStatus: 'ENRICHED',
      },
      select: {
        approvedAssetId: true,
        enrichmentData: true,
      },
    });

    let syncCount = 0;
    for (const device of approvedDevices) {
      const packages = (device.enrichmentData as any)?.software?.packages;
      if (packages && Array.isArray(packages) && packages.length > 0) {
        await this.ingestSoftware(tenantId, device.approvedAssetId!, packages);
        syncCount++;
      }
    }

    return { success: true, processedAssets: syncCount };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Qualys CSAM-Inspired: Risk Distribution, Alerts, Compliance
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Compute TruRisk-style risk distribution across all assets.
   * Scores each asset based on: unauthorized sw (+100), blacklisted (+200),
   * EOL/EOS (+150), needs-review (+25). Buckets into Critical/High/Medium/Low.
   */
  async getRiskDistribution(tenantId: string) {
    // Get all installations with their software's risk attributes
    const installations = await this.prisma.softwareInstallation.findMany({
      where: { tenantId },
      select: {
        assetId: true,
        software: {
          select: {
            authorizationStatus: true,
            lifecycleStatus: true,
            isBlacklisted: true,
            riskScore: true,
          },
        },
      },
    });

    // Compute per-asset risk scores
    const assetRisks: Record<string, number> = {};
    for (const inst of installations) {
      const aid = inst.assetId;
      if (!assetRisks[aid]) assetRisks[aid] = 0;

      const sw = inst.software;
      if (sw.isBlacklisted || sw.authorizationStatus === 'BLACKLISTED') assetRisks[aid] += 200;
      else if (sw.authorizationStatus === 'UNAUTHORIZED') assetRisks[aid] += 100;
      if (sw.lifecycleStatus === 'EOS') assetRisks[aid] += 150;
      else if (sw.lifecycleStatus === 'EOL') assetRisks[aid] += 120;
      else if (sw.lifecycleStatus === 'APPROACHING_EOL') assetRisks[aid] += 40;
      if (sw.authorizationStatus === 'NEEDS_REVIEW') assetRisks[aid] += 25;
      if (sw.riskScore && sw.riskScore >= 50) assetRisks[aid] += sw.riskScore;
    }

    // Bucket into risk levels (0-1000 scale like Qualys TruRisk)
    const buckets = { critical: 0, high: 0, medium: 0, low: 0 };
    const scores = Object.values(assetRisks);
    for (const s of scores) {
      const capped = Math.min(s, 1000);
      if (capped >= 700) buckets.critical++;
      else if (capped >= 400) buckets.high++;
      else if (capped >= 150) buckets.medium++;
      else buckets.low++;
    }

    // Top 10 riskiest assets
    const sortedAssets = Object.entries(assetRisks)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const topRiskyAssetIds = sortedAssets.map(([id]) => id);
    const assetDetails = topRiskyAssetIds.length > 0
      ? await this.prisma.asset.findMany({
          where: { id: { in: topRiskyAssetIds }, tenantId },
          select: { id: true, name: true, assetTag: true, hostname: true, ipAddress: true, status: true },
        })
      : [];

    const topRiskyAssets = sortedAssets.map(([id, score]) => {
      const asset = assetDetails.find((a) => a.id === id);
      return {
        assetId: id,
        riskScore: Math.min(score, 1000),
        name: asset?.name || 'Unknown',
        assetTag: asset?.assetTag || '',
        hostname: asset?.hostname || '',
        ipAddress: asset?.ipAddress || '',
        status: asset?.status || 'UNKNOWN',
      };
    });

    return {
      totalAssetsScored: scores.length,
      averageRisk: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      buckets,
      topRiskyAssets,
    };
  }

  /**
   * Recent unauthorized/blacklisted software detections (last 30 days).
   * Acts as an alerting feed for security operations.
   */
  async getRecentAlerts(tenantId: string) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const recentInstallations = await this.prisma.softwareInstallation.findMany({
      where: {
        tenantId,
        installDate: { gte: ninetyDaysAgo },
        software: {
          OR: [
            { authorizationStatus: 'UNAUTHORIZED' },
            { authorizationStatus: 'BLACKLISTED' },
            { isBlacklisted: true },
            { lifecycleStatus: { in: ['EOL', 'EOS'] } },
          ],
        },
      },
      include: {
        software: {
          select: {
            id: true, name: true, publisher: true,
            authorizationStatus: true, lifecycleStatus: true,
            isBlacklisted: true, riskScore: true,
          },
        },
        asset: {
          select: {
            id: true, name: true, assetTag: true,
            hostname: true, ipAddress: true,
            assignedTo: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { installDate: 'desc' },
      take: 50,
    });

    return recentInstallations.map((inst) => {
      let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 'MEDIUM';
      let alertType = 'NEEDS_ATTENTION';

      if (inst.software.isBlacklisted || inst.software.authorizationStatus === 'BLACKLISTED') {
        severity = 'CRITICAL';
        alertType = 'BLACKLISTED_SOFTWARE';
      } else if (inst.software.authorizationStatus === 'UNAUTHORIZED') {
        severity = 'HIGH';
        alertType = 'UNAUTHORIZED_SOFTWARE';
      } else if (inst.software.lifecycleStatus === 'EOS') {
        severity = 'CRITICAL';
        alertType = 'END_OF_SUPPORT';
      } else if (inst.software.lifecycleStatus === 'EOL') {
        severity = 'HIGH';
        alertType = 'END_OF_LIFE';
      }

      return {
        id: inst.id,
        alertType,
        severity,
        detectedAt: inst.installDate,
        software: inst.software,
        asset: inst.asset,
        version: inst.version,
        installPath: inst.installPath,
      };
    });
  }

  /**
   * Overall compliance summary — percentage of software that is authorized,
   * breakdown by status, license compliance.
   */
  async getComplianceSummary(tenantId: string) {
    // Single SQL for all counts — memory efficient
    const stats: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (WHERE "authorization_status" = 'AUTHORIZED')::int AS "authorized",
        COUNT(*) FILTER (WHERE "authorization_status" = 'REQUIRED')::int AS "required",
        COUNT(*) FILTER (WHERE "authorization_status" = 'UNAUTHORIZED')::int AS "unauthorized",
        COUNT(*) FILTER (WHERE "authorization_status" = 'BLACKLISTED')::int AS "blacklisted",
        COUNT(*) FILTER (WHERE "authorization_status" = 'NEEDS_REVIEW')::int AS "needsReview",
        COUNT(*) FILTER (WHERE "lifecycle_status" = 'EOL')::int AS "eolCount",
        COUNT(*) FILTER (WHERE "lifecycle_status" = 'EOS')::int AS "eosCount",
        COUNT(*) FILTER (WHERE "lifecycle_status" = 'APPROACHING_EOL')::int AS "approachingEol"
      FROM software_catalog WHERE tenant_id = $1::uuid
    `, tenantId);
    const s = stats[0] || {};
    const total = s.total || 0;
    const authorized = s.authorized || 0;
    const required = s.required || 0;

    const compliantCount = authorized + required;
    const compliancePercentage = total > 0 ? Math.round((compliantCount / total) * 100) : 100;

    // License compliance
    const licenses = await this.prisma.license.findMany({
      where: { tenantId },
      select: { totalSeats: true, usedSeats: true, complianceStatus: true },
    });
    const totalLicenses = licenses.length;
    const compliantLicenses = licenses.filter((l) => l.complianceStatus === 'COMPLIANT').length;
    const overUsedLicenses = licenses.filter((l) => (l.usedSeats || 0) > (l.totalSeats || 0)).length;

    return {
      compliancePercentage,
      total,
      compliantCount,
      breakdown: {
        authorized,
        required,
        unauthorized: s.unauthorized || 0,
        blacklisted: s.blacklisted || 0,
        needsReview: s.needsReview || 0,
      },
      lifecycle: {
        eolCount: s.eolCount || 0,
        eosCount: s.eosCount || 0,
        approachingEol: s.approachingEol || 0,
      },
      licenseCompliance: {
        totalLicenses,
        compliantLicenses,
        overUsedLicenses,
        percentage: totalLicenses > 0 ? Math.round((compliantLicenses / totalLicenses) * 100) : 100,
      },
    };
  }
}
