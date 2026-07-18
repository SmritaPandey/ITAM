import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';

const UNHEALTHY_STATUSES = new Set(['OFFLINE', 'RETIRED', 'DISPOSED', 'LOST']);

@Injectable()
export class CmdbService {
  private readonly logger = new Logger(CmdbService.name);

  constructor(private prisma: PrismaService) {}

  /** Hourly health rollup for all tenants with business services */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledHealthRollup() {
    if (process.env.DISABLE_CRON_JOBS === 'true') return;
    const tenants = await this.prisma.businessService.findMany({
      select: { tenantId: true },
      distinct: ['tenantId'],
    });
    for (const { tenantId } of tenants) {
      try {
        await this.rollupAll(tenantId);
      } catch (err: any) {
        this.logger.warn(`CMDB rollup failed for ${tenantId}: ${err?.message || err}`);
      }
    }
  }

  async listServices(tenantId: string) {
    const services = await this.prisma.withTenant(tenantId, async (tx) =>
      tx.businessService.findMany({
        where: { tenantId },
        include: {
          assets: {
            include: {
              asset: {
                select: {
                  id: true,
                  name: true,
                  assetTag: true,
                  status: true,
                  category: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    );

    return services.map((s) => ({
      ...s,
      health: this.computeHealth(s.assets),
      assetCount: s.assets.length,
    }));
  }

  async getService(id: string, tenantId: string) {
    const service = await this.prisma.businessService.findFirst({
      where: { id, tenantId },
      include: {
        assets: {
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                assetTag: true,
                status: true,
                category: true,
                ipAddress: true,
                hostname: true,
              },
            },
          },
        },
      },
    });
    if (!service) throw new NotFoundException('Business service not found');
    const health = this.computeHealth(service.assets);
    if (health !== service.status) {
      await this.prisma.businessService.update({
        where: { id },
        data: { status: health },
      });
      service.status = health;
    }
    return { ...service, health };
  }

  async createService(tenantId: string, data: any) {
    if (!data.name) throw new BadRequestException('name is required');
    return this.prisma.businessService.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description ?? null,
        criticality: data.criticality || 'MEDIUM',
        ownerId: data.ownerId ?? null,
        status: 'HEALTHY',
      },
    });
  }

  async updateService(id: string, tenantId: string, data: any) {
    await this.getService(id, tenantId);
    return this.prisma.businessService.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.criticality !== undefined && { criticality: data.criticality }),
        ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
      },
    });
  }

  async deleteService(id: string, tenantId: string) {
    await this.getService(id, tenantId);
    await this.prisma.businessService.delete({ where: { id } });
    return { deleted: true };
  }

  async linkAsset(
    serviceId: string,
    tenantId: string,
    data: { assetId: string; role?: string },
  ) {
    await this.getService(serviceId, tenantId);
    const asset = await this.prisma.asset.findFirst({
      where: { id: data.assetId, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const link = await this.prisma.businessServiceAsset.upsert({
      where: {
        businessServiceId_assetId: {
          businessServiceId: serviceId,
          assetId: data.assetId,
        },
      },
      create: {
        businessServiceId: serviceId,
        assetId: data.assetId,
        role: data.role || 'SUPPORTS',
      },
      update: {
        role: data.role || 'SUPPORTS',
      },
      include: {
        asset: {
          select: { id: true, name: true, assetTag: true, status: true },
        },
      },
    });

    await this.rollupServiceHealth(serviceId, tenantId);
    return link;
  }

  async unlinkAsset(serviceId: string, tenantId: string, assetId: string) {
    await this.getService(serviceId, tenantId);
    await this.prisma.businessServiceAsset.deleteMany({
      where: { businessServiceId: serviceId, assetId },
    });
    await this.rollupServiceHealth(serviceId, tenantId);
    return { unlinked: true };
  }

  async rollupAll(tenantId: string) {
    const services = await this.prisma.businessService.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const results = [];
    for (const s of services) {
      results.push(await this.rollupServiceHealth(s.id, tenantId));
    }
    return { updated: results.length, services: results };
  }

  async rollupServiceHealth(serviceId: string, tenantId: string) {
    const service = await this.prisma.businessService.findFirst({
      where: { id: serviceId, tenantId },
      include: {
        assets: {
          include: {
            asset: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });
    if (!service) throw new NotFoundException('Business service not found');

    const health = this.computeHealth(service.assets);
    const updated = await this.prisma.businessService.update({
      where: { id: serviceId },
      data: { status: health },
    });
    return { id: updated.id, name: updated.name, status: health };
  }

  private computeHealth(
    links: Array<{ role: string; asset: { status: string } }>,
  ): string {
    const criticalUnhealthy = links.filter(
      (l) =>
        (l.role === 'CRITICAL' || l.role === 'DEPENDS') &&
        UNHEALTHY_STATUSES.has(String(l.asset.status).toUpperCase()),
    );
    // Critical CI down → OUTAGE (RED); any other unhealthy → DEGRADED
    if (criticalUnhealthy.length > 0) return 'OUTAGE';

    const anyUnhealthy = links.some((l) =>
      UNHEALTHY_STATUSES.has(String(l.asset.status).toUpperCase()),
    );
    if (anyUnhealthy) return 'DEGRADED';
    return 'HEALTHY';
  }

  /**
   * CMDB impact analysis — BFS through DEPENDS_ON / COMPONENT_OF relationships.
   */
  async getImpactAnalysis(assetId: string, tenantId: string, maxDepth = 8) {
    const root = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
      select: { id: true, name: true, assetTag: true, status: true },
    });
    if (!root) throw new NotFoundException('Asset not found');

    const visited = new Set<string>([assetId]);
    const impacted: Array<{
      assetId: string;
      name: string;
      assetTag: string | null;
      status: string;
      depth: number;
      via: string;
    }> = [];
    let frontier = [assetId];
    const IMPACT_TYPES = ['DEPENDS_ON', 'COMPONENT_OF'] as const;

    for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
      const rels = await this.prisma.assetRelationship.findMany({
        where: {
          tenantId,
          relationshipType: { in: [...IMPACT_TYPES] },
          OR: [
            { sourceAssetId: { in: frontier } },
            { targetAssetId: { in: frontier } },
          ],
        },
        include: {
          sourceAsset: { select: { id: true, name: true, assetTag: true, status: true } },
          targetAsset: { select: { id: true, name: true, assetTag: true, status: true } },
        },
      });
      const next: string[] = [];
      for (const r of rels) {
        const neighbors = [
          { node: r.sourceAsset, via: r.relationshipType as string },
          { node: r.targetAsset, via: r.relationshipType as string },
        ];
        for (const { node, via } of neighbors) {
          if (!node || visited.has(node.id)) continue;
          visited.add(node.id);
          next.push(node.id);
          impacted.push({
            assetId: node.id,
            name: node.name,
            assetTag: node.assetTag,
            status: node.status,
            depth,
            via,
          });
        }
      }
      frontier = next;
    }

    return {
      root,
      rootAssetId: assetId,
      impactedCount: impacted.length,
      maxDepth: impacted.reduce((m, i) => Math.max(m, i.depth), 0),
      impacted,
    };
  }
}
