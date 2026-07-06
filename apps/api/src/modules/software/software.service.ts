import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class SoftwareService {
  private readonly logger = new Logger(SoftwareService.name);

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
    } else if (sortBy === 'installCount') {
      orderBy = { installations: { _count: 'desc' } };
    }

    const [data, total] = await Promise.all([
      this.prisma.softwareCatalog.findMany({
        where,
        include: { _count: { select: { installations: true } } },
        orderBy,
        skip,
        take: Number(limit),
      }),
      this.prisma.softwareCatalog.count({ where }),
    ]);

    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async getDashboard(tenantId: string) {
    const [
      totalSoftware,
      authorizedCount,
      requiredCount,
      unauthorizedCount,
      blacklistedCount,
      needsReviewCount,
      eolCount,
      highRiskCount,
      totalInstallations,
      topPublishers,
      topCategories,
      topInstalled,
    ] = await Promise.all([
      this.prisma.softwareCatalog.count({ where: { tenantId } }),
      this.prisma.softwareCatalog.count({
        where: { tenantId, authorizationStatus: 'AUTHORIZED' },
      }),
      this.prisma.softwareCatalog.count({
        where: { tenantId, authorizationStatus: 'REQUIRED' },
      }),
      this.prisma.softwareCatalog.count({
        where: { tenantId, authorizationStatus: { in: ['UNAUTHORIZED', 'BLACKLISTED'] } },
      }),
      this.prisma.softwareCatalog.count({
        where: { tenantId, authorizationStatus: 'BLACKLISTED' },
      }),
      this.prisma.softwareCatalog.count({
        where: { tenantId, authorizationStatus: 'NEEDS_REVIEW' },
      }),
      this.prisma.softwareCatalog.count({
        where: {
          tenantId,
          lifecycleStatus: { in: ['EOL', 'EOS', 'APPROACHING_EOL'] },
        },
      }),
      this.prisma.softwareCatalog.count({
        where: { tenantId, riskScore: { gte: 50 } },
      }),
      this.prisma.softwareInstallation.count({ where: { tenantId } }),
      this.prisma.softwareCatalog.groupBy({
        by: ['publisher'],
        where: { tenantId, publisher: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.softwareCatalog.groupBy({
        by: ['category'],
        where: { tenantId, category: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.softwareCatalog.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          publisher: true,
          _count: { select: { installations: true } },
        },
        orderBy: { installations: { _count: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalSoftware,
      authorizedCount,
      requiredCount,
      unauthorizedCount,
      blacklistedCount,
      needsReviewCount,
      eolCount,
      highRiskCount,
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
        installationCount: s._count.installations,
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

    return this.prisma.softwareCatalog.update({
      where: { id },
      data: updateData,
    });
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

    this.logger.log(`Ingesting ${packages.length} packages for asset ${assetId}`);

    // Process in chunks of 5 to balance speed and DB load
    const CHUNK_SIZE = 5;
    for (let i = 0; i < packages.length; i += CHUNK_SIZE) {
      const chunk = packages.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (pkg) => {
          try {
            // 1. Find or create software in catalog
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
                riskScore: Math.floor(Math.random() * 30), // Initial random risk score
              },
              update: {
                latestVersion: pkg.version,
                description: pkg.description || undefined,
              },
            });

            // 2. Upsert installation record for this asset
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
          } catch (err) {
            this.logger.error(`Failed to ingest software ${pkg.name} for asset ${assetId}: ${err.message}`);
          }
        }),
      );
    }
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentInstallations = await this.prisma.softwareInstallation.findMany({
      where: {
        tenantId,
        installDate: { gte: thirtyDaysAgo },
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
    const [total, authorized, required, unauthorized, blacklisted, needsReview] =
      await Promise.all([
        this.prisma.softwareCatalog.count({ where: { tenantId } }),
        this.prisma.softwareCatalog.count({ where: { tenantId, authorizationStatus: 'AUTHORIZED' } }),
        this.prisma.softwareCatalog.count({ where: { tenantId, authorizationStatus: 'REQUIRED' } }),
        this.prisma.softwareCatalog.count({ where: { tenantId, authorizationStatus: 'UNAUTHORIZED' } }),
        this.prisma.softwareCatalog.count({ where: { tenantId, authorizationStatus: 'BLACKLISTED' } }),
        this.prisma.softwareCatalog.count({ where: { tenantId, authorizationStatus: 'NEEDS_REVIEW' } }),
      ]);

    // Compliance % = (authorized + required) / total * 100
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

    // EOL/EOS breakdown
    const [eolCount, eosCount, approachingEol] = await Promise.all([
      this.prisma.softwareCatalog.count({ where: { tenantId, lifecycleStatus: 'EOL' } }),
      this.prisma.softwareCatalog.count({ where: { tenantId, lifecycleStatus: 'EOS' } }),
      this.prisma.softwareCatalog.count({ where: { tenantId, lifecycleStatus: 'APPROACHING_EOL' } }),
    ]);

    return {
      compliancePercentage,
      total,
      compliantCount,
      breakdown: { authorized, required, unauthorized, blacklisted, needsReview },
      lifecycle: { eolCount, eosCount, approachingEol },
      licenseCompliance: {
        totalLicenses,
        compliantLicenses,
        overUsedLicenses,
        percentage: totalLicenses > 0 ? Math.round((compliantLicenses / totalLicenses) * 100) : 100,
      },
    };
  }
}
