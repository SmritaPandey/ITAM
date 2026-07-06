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
      unauthorizedCount,
      needsReviewCount,
      eolCount,
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
        where: { tenantId, authorizationStatus: 'UNAUTHORIZED' },
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
      unauthorizedCount,
      needsReviewCount,
      eolCount,
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
}
