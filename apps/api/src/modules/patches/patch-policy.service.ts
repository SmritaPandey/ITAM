import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class PatchPolicyService {
  private readonly logger = new Logger(PatchPolicyService.name);

  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.patchDeployPolicy.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string) {
    const policy = await this.prisma.patchDeployPolicy.findFirst({
      where: { id, tenantId },
    });
    if (!policy) throw new NotFoundException('Deploy policy not found');
    return policy;
  }

  async create(
    tenantId: string,
    body: {
      name: string;
      pilotAssetIds?: string[];
      stagedAssetIds?: string[];
      scheduleCron?: string;
      autoPromote?: boolean;
    },
  ) {
    if (!body.name?.trim()) throw new BadRequestException('name is required');
    return this.prisma.patchDeployPolicy.create({
      data: {
        tenantId,
        name: body.name.trim(),
        pilotAssetIds: body.pilotAssetIds || [],
        stagedAssetIds: body.stagedAssetIds || [],
        scheduleCron: body.scheduleCron || null,
        autoPromote: body.autoPromote ?? false,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    body: {
      name?: string;
      pilotAssetIds?: string[];
      stagedAssetIds?: string[];
      scheduleCron?: string | null;
      autoPromote?: boolean;
    },
  ) {
    await this.get(tenantId, id);
    return this.prisma.patchDeployPolicy.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.pilotAssetIds !== undefined ? { pilotAssetIds: body.pilotAssetIds } : {}),
        ...(body.stagedAssetIds !== undefined ? { stagedAssetIds: body.stagedAssetIds } : {}),
        ...(body.scheduleCron !== undefined ? { scheduleCron: body.scheduleCron } : {}),
        ...(body.autoPromote !== undefined ? { autoPromote: body.autoPromote } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.patchDeployPolicy.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Resolve target asset IDs for a deploy ring given an optional policy.
   * PILOT → pilotAssetIds; STAGED → pilot+staged; ALL → all active agent assets (or explicit lists + rest).
   */
  async resolveRingAssets(
    tenantId: string,
    ring: string,
    policyId?: string | null,
  ): Promise<string[]> {
    const normalized = (ring || 'ALL').toUpperCase();
    if (!['PILOT', 'STAGED', 'ALL'].includes(normalized)) {
      throw new BadRequestException('ring must be PILOT, STAGED, or ALL');
    }
    let pilotIds: string[] = [];
    let stagedIds: string[] = [];

    if (policyId) {
      const policy = await this.get(tenantId, policyId);
      pilotIds = Array.isArray(policy.pilotAssetIds)
        ? (policy.pilotAssetIds as string[])
        : [];
      stagedIds = Array.isArray(policy.stagedAssetIds)
        ? (policy.stagedAssetIds as string[])
        : [];
    }

    if (normalized === 'PILOT') {
      if (pilotIds.length > 0) return [...new Set(pilotIds)];
      // Fallback: first 5 active agent assets
      const assets = await this.prisma.asset.findMany({
        where: { tenantId, deletedAt: null, agentId: { not: null }, status: 'ACTIVE' },
        select: { id: true },
        take: 5,
        orderBy: { name: 'asc' },
      });
      return assets.map((a) => a.id);
    }

    if (normalized === 'STAGED') {
      const combined = [...new Set([...pilotIds, ...stagedIds])];
      if (combined.length > 0) return combined;
      const assets = await this.prisma.asset.findMany({
        where: { tenantId, deletedAt: null, agentId: { not: null }, status: 'ACTIVE' },
        select: { id: true },
        take: 25,
        orderBy: { name: 'asc' },
      });
      return assets.map((a) => a.id);
    }

    // ALL
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null, agentId: { not: null }, status: 'ACTIVE' },
      select: { id: true },
    });
    return assets.map((a) => a.id);
  }

  /** Promote patch ring PILOT → STAGED → ALL when autoPromote policies apply. */
  async promoteRing(tenantId: string, patchId: string) {
    const patch = await this.prisma.patch.findFirst({ where: { id: patchId, tenantId } });
    if (!patch) throw new NotFoundException('Patch not found');
    const current = (patch.deployRing || 'ALL').toUpperCase();
    if (!['PILOT', 'STAGED', 'ALL'].includes(current)) {
      throw new BadRequestException(`Cannot promote invalid deploy ring ${current}`);
    }
    const next = current === 'PILOT' ? 'STAGED' : current === 'STAGED' ? 'ALL' : null;
    if (!next) {
      return { patch, promoted: false, message: 'Already at ALL ring' };
    }
    const updated = await this.prisma.patch.update({
      where: { id: patchId },
      data: { deployRing: next },
    });
    this.logger.log(`Patch ${patch.patchId} ring promoted ${current} → ${next}`);
    return { patch: updated, promoted: true, from: current, to: next };
  }
}
