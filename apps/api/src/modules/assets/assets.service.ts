import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters: {
    page?: number; limit?: number; status?: string; assetTypeId?: string;
    search?: string; siteId?: string; departmentId?: string;
  } = {}, userId?: string, role?: string) {
    const { page: rawPage = 1, limit: rawLimit = 20, status, assetTypeId, search, siteId, departmentId } = filters;
    const page = Number(rawPage) || 1;
    const limit = Number(rawLimit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = {
      tenantId,
      deletedAt: null,
      ...(status && { status: status as any }),
      ...(assetTypeId && { assetTypeId }),
      ...(siteId && { siteId }),
      ...(departmentId && { departmentId }),
      // Staff: only see assets assigned to them
      ...(role === 'Employee' && userId && { assignedToId: userId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { assetTag: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
          { hostname: { contains: search, mode: 'insensitive' } },
          { ipAddress: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: {
          assetType: true,
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          site: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, tenantId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        assetType: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        managedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        site: true,
        department: true,
        hardwareDetails: true,
        osDetails: true,
        securityPosture: true,
        softwareInstalls: { include: { software: true } },
        assetHistory: { orderBy: { timestamp: 'desc' }, take: 20 },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async create(tenantId: string, userId: string, data: any) {
    const asset = await this.prisma.asset.create({
      data: {
        ...data,
        tenantId,
        createdById: userId,
      },
      include: { assetType: true },
    });

    // Log creation in asset history
    await this.prisma.assetHistory.create({
      data: {
        tenantId,
        assetId: asset.id,
        eventType: 'CREATED',
        description: `Asset "${asset.name}" created`,
        performedBy: userId,
      },
    });

    return asset;
  }

  async update(id: string, tenantId: string, userId: string, data: Prisma.AssetUpdateInput) {
    const existing = await this.findById(id, tenantId);

    const asset = await this.prisma.asset.update({
      where: { id },
      data,
      include: { assetType: true },
    });

    await this.prisma.assetHistory.create({
      data: {
        tenantId,
        assetId: id,
        eventType: 'UPDATED',
        description: `Asset updated`,
        performedBy: userId,
        details: { changes: data } as any,
      },
    });

    return asset;
  }

  async softDelete(id: string, tenantId: string, userId: string) {
    await this.findById(id, tenantId);
    await this.prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.assetHistory.create({
      data: {
        tenantId,
        assetId: id,
        eventType: 'DELETED',
        description: 'Asset soft-deleted',
        performedBy: userId,
      },
    });
  }

  async getDashboardStats(tenantId: string) {
    const [total, byStatus, byType, recentlyAdded] = await Promise.all([
      this.prisma.asset.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.asset.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),
      this.prisma.asset.groupBy({
        by: ['assetTypeId'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),
      this.prisma.asset.count({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);
    return { total, byStatus, byType, recentlyAdded };
  }

  async bulkImport(tenantId: string, userId: string, assets: any[]) {
    const results = { imported: 0, failed: 0, errors: [] as string[] };

    // Get first asset type as default
    const defaultType = await this.prisma.assetType.findFirst({ where: { tenantId } });
    if (!defaultType) {
      return { ...results, errors: ['No asset types found. Create asset types first.'] };
    }

    for (let i = 0; i < assets.length; i++) {
      const row = assets[i];
      try {
        if (!row.name) {
          results.errors.push(`Row ${i + 1}: Missing required field "name"`);
          results.failed++;
          continue;
        }

        // Find matching asset type or use default
        let assetTypeId = defaultType.id;
        if (row.assetType) {
          const matchedType = await this.prisma.assetType.findFirst({
            where: { tenantId, name: { contains: row.assetType, mode: 'insensitive' } },
          });
          if (matchedType) assetTypeId = matchedType.id;
        }

        await this.prisma.asset.create({
          data: {
            tenantId,
            assetTypeId,
            name: row.name,
            assetTag: row.assetTag || null,
            serialNumber: row.serialNumber || null,
            manufacturer: row.manufacturer || null,
            model: row.model || null,
            ipAddress: row.ipAddress || null,
            macAddress: row.macAddress || null,
            hostname: row.hostname || null,
            status: 'ACTIVE',
            discoverySource: 'CSV_IMPORT',
            createdById: userId,
            notes: row.notes || null,
          },
        });
        results.imported++;
      } catch (err: any) {
        results.errors.push(`Row ${i + 1} (${row.name || 'unnamed'}): ${err.message?.slice(0, 100)}`);
        results.failed++;
      }
    }

    return results;
  }

  async getHistory(assetId: string, tenantId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundException('Asset not found');

    return this.prisma.assetHistory.findMany({
      where: { assetId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  }

  async getRelationships(assetId: string, tenantId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const [asSource, asTarget] = await Promise.all([
      this.prisma.assetRelationship.findMany({
        where: { sourceAssetId: assetId },
        include: { targetAsset: { select: { id: true, name: true, assetTag: true, status: true } } },
      }),
      this.prisma.assetRelationship.findMany({
        where: { targetAssetId: assetId },
        include: { sourceAsset: { select: { id: true, name: true, assetTag: true, status: true } } },
      }),
    ]);

    return { outgoing: asSource, incoming: asTarget };
  }

  async createRelationship(assetId: string, tenantId: string, data: { targetAssetId: string; type: string }) {
    await this.findById(assetId, tenantId);
    return this.prisma.assetRelationship.create({
      data: { tenantId, sourceAssetId: assetId, targetAssetId: data.targetAssetId, relationshipType: data.type as any },
    });
  }

  async exportAssets(tenantId: string, filters: any = {}) {
    const where: Prisma.AssetWhereInput = { tenantId, deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.assetTypeId) where.assetTypeId = filters.assetTypeId;

    const assets = await this.prisma.asset.findMany({
      where,
      include: {
        assetType: { select: { name: true } },
        site: { select: { name: true } },
        department: { select: { name: true } },
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Return CSV-ready flat records
    return assets.map(a => ({
      assetTag: a.assetTag,
      name: a.name,
      type: a.assetType?.name,
      serialNumber: a.serialNumber,
      manufacturer: a.manufacturer,
      model: a.model,
      status: a.status,
      site: a.site?.name,
      department: a.department?.name,
      assignedTo: a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : null,
      ipAddress: a.ipAddress,
      macAddress: a.macAddress,
      purchasePrice: a.purchasePrice,
      warrantyExpiry: a.warrantyExpiry,
      procurementDate: a.procurementDate,
    }));
  }

  // ─── CHECK-IN / CHECK-OUT ──────────────────────────────────────────────
  async checkout(assetId: string, tenantId: string, userId: string, data: { userId: string; expectedReturn?: string; notes?: string }) {
    const asset = await this.findById(assetId, tenantId);
    const active = await this.prisma.assetCheckout.findFirst({ where: { assetId, tenantId, status: 'CHECKED_OUT' } });
    if (active) throw new NotFoundException('Asset is already checked out');

    const checkout = await this.prisma.assetCheckout.create({
      data: {
        tenantId, assetId, userId: data.userId, checkedOutById: userId,
        expectedReturn: data.expectedReturn ? new Date(data.expectedReturn) : null,
        notes: data.notes,
      },
    });

    await this.prisma.asset.update({ where: { id: assetId }, data: { assignedToId: data.userId, status: 'ACTIVE' } });
    await this.prisma.assetHistory.create({ data: { tenantId, assetId, eventType: 'CHECKED_OUT', description: `Asset checked out to user`, performedBy: userId } });
    return checkout;
  }

  async checkin(assetId: string, tenantId: string, userId: string, data: { condition?: string; notes?: string }) {
    const checkout = await this.prisma.assetCheckout.findFirst({ where: { assetId, tenantId, status: 'CHECKED_OUT' } });
    if (!checkout) throw new NotFoundException('No active checkout found');

    const updated = await this.prisma.assetCheckout.update({
      where: { id: checkout.id },
      data: { status: 'RETURNED', actualReturn: new Date(), condition: data.condition || 'GOOD', notes: data.notes },
    });

    await this.prisma.asset.update({ where: { id: assetId }, data: { assignedToId: null, status: data.condition === 'DAMAGED' ? 'IN_MAINTENANCE' : 'IN_STORAGE' } });
    await this.prisma.assetHistory.create({ data: { tenantId, assetId, eventType: 'CHECKED_IN', description: `Asset returned — condition: ${data.condition || 'GOOD'}`, performedBy: userId } });
    return updated;
  }

  async getCheckedOut(tenantId: string) {
    return this.prisma.assetCheckout.findMany({
      where: { tenantId, status: 'CHECKED_OUT' },
      include: { asset: { select: { id: true, name: true, assetTag: true } } },
      orderBy: { checkedOutAt: 'desc' },
    });
  }

  async getOverdue(tenantId: string) {
    return this.prisma.assetCheckout.findMany({
      where: { tenantId, status: 'CHECKED_OUT', expectedReturn: { lt: new Date() } },
      include: { asset: { select: { id: true, name: true, assetTag: true } } },
      orderBy: { expectedReturn: 'asc' },
    });
  }

  // ─── QR / BARCODE ──────────────────────────────────────────────────────
  async getQrData(assetId: string, tenantId: string, baseUrl = 'http://localhost:3100') {
    const asset = await this.findById(assetId, tenantId);
    return {
      assetId: asset.id,
      assetTag: asset.assetTag,
      name: asset.name,
      serialNumber: asset.serialNumber,
      barcode: asset.barcode || asset.assetTag || asset.id.substring(0, 12),
      qrUrl: `${baseUrl}/dashboard/assets/${asset.id}`,
      qrContent: JSON.stringify({ id: asset.id, tag: asset.assetTag, name: asset.name }),
    };
  }

  async lookupByBarcode(tenantId: string, barcode: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { tenantId, deletedAt: null, OR: [{ barcode }, { assetTag: barcode }, { serialNumber: barcode }] },
      include: { assetType: true, assignedTo: { select: { firstName: true, lastName: true } } },
    });
    if (!asset) throw new NotFoundException('No asset found for barcode');
    return asset;
  }

  // ─── BULK OPERATIONS ───────────────────────────────────────────────────
  async bulkUpdate(tenantId: string, userId: string, data: { assetIds: string[]; updates: any }) {
    const { assetIds, updates } = data;
    await this.prisma.asset.updateMany({ where: { id: { in: assetIds }, tenantId }, data: updates });
    for (const id of assetIds) {
      await this.prisma.assetHistory.create({ data: { tenantId, assetId: id, eventType: 'UPDATED', description: 'Bulk update', performedBy: userId } });
    }
    return { updated: assetIds.length };
  }

  async bulkRetire(tenantId: string, userId: string, assetIds: string[]) {
    await this.prisma.asset.updateMany({ where: { id: { in: assetIds }, tenantId }, data: { status: 'RETIRED', disposalDate: new Date() } });
    for (const id of assetIds) {
      await this.prisma.assetHistory.create({ data: { tenantId, assetId: id, eventType: 'RETIRED', description: 'Bulk retirement', performedBy: userId } });
    }
    return { retired: assetIds.length };
  }

  // ─── ATTESTATION ───────────────────────────────────────────────────────
  async createAttestationCampaign(tenantId: string, campaignName: string) {
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null, assignedToId: { not: null }, status: 'ACTIVE' },
      select: { id: true, assignedToId: true },
    });

    const records = assets.map(a => ({
      tenantId, assetId: a.id, userId: a.assignedToId!, campaignName,
    }));

    await this.prisma.assetAttestation.createMany({ data: records });
    return { campaign: campaignName, assetsRequested: records.length };
  }

  async getPendingAttestations(tenantId: string) {
    return this.prisma.assetAttestation.findMany({
      where: { tenantId, response: null },
      include: { asset: { select: { id: true, name: true, assetTag: true } } },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async respondAttestation(id: string, tenantId: string, response: string, notes?: string) {
    return this.prisma.assetAttestation.update({
      where: { id, tenantId },
      data: { response, respondedAt: new Date(), notes },
    });
  }

  // ─── WARRANTY / LEASE EXPIRY ───────────────────────────────────────────
  async getExpiringAssets(tenantId: string, type: 'warranty' | 'lease', days = 30) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);
    const where: any = { tenantId, deletedAt: null };
    if (type === 'warranty') where.warrantyExpiry = { lte: deadline, gte: new Date() };
    else where.leaseEndDate = { lte: deadline, gte: new Date() };
    return this.prisma.asset.findMany({
      where, select: { id: true, name: true, assetTag: true, warrantyExpiry: true, leaseEndDate: true, leaseVendor: true },
      orderBy: type === 'warranty' ? { warrantyExpiry: 'asc' } : { leaseEndDate: 'asc' },
    });
  }
}
