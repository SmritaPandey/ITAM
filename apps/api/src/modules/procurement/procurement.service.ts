import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(private prisma: PrismaService) {}

  // ─── VENDORS ─────────────────────────────────────────────────────────────
  async getVendors(tenantId: string) {
    return this.prisma.vendor.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, include: { _count: { select: { contracts: true, purchaseOrders: true } } } });
  }

  async createVendor(tenantId: string, data: any) {
    return this.prisma.vendor.create({ data: { tenantId, ...data } });
  }

  async updateVendor(id: string, tenantId: string, data: any) {
    return this.prisma.vendor.update({ where: { id, tenantId }, data });
  }

  async deleteVendor(id: string, tenantId: string) {
    return this.prisma.vendor.delete({ where: { id, tenantId } });
  }

  async getVendorScorecard(id: string, tenantId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, tenantId }, include: { contracts: true, purchaseOrders: true } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const activeContracts = vendor.contracts.filter(c => c.status === 'ACTIVE').length;
    const totalPOs = vendor.purchaseOrders.length;
    const receivedPOs = vendor.purchaseOrders.filter(p => p.status === 'RECEIVED').length;
    const totalSpend = vendor.purchaseOrders.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
    return { vendor: { id: vendor.id, name: vendor.name, rating: vendor.rating, slaScore: vendor.slaScore }, activeContracts, totalPOs, receivedPOs, fulfillmentRate: totalPOs > 0 ? Math.round((receivedPOs / totalPOs) * 100) : 0, totalSpend };
  }

  // ─── CONTRACTS ───────────────────────────────────────────────────────────
  async getContracts(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.prisma.contract.findMany({ where, orderBy: { endDate: 'asc' }, include: { vendor: { select: { name: true } } } });
  }

  async createContract(tenantId: string, data: any) {
    const { startDate, endDate, value, ...rest } = data;
    return this.prisma.contract.create({
      data: {
        tenantId,
        ...rest,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        ...(value !== undefined && { value: parseFloat(value) }),
      },
    });
  }

  async updateContract(id: string, tenantId: string, data: any) {
    return this.prisma.contract.update({ where: { id, tenantId }, data });
  }

  async deleteContract(id: string, tenantId: string) {
    return this.prisma.contract.delete({ where: { id, tenantId } });
  }

  async getExpiringContracts(tenantId: string, days = 30) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);
    return this.prisma.contract.findMany({ where: { tenantId, status: 'ACTIVE', endDate: { lte: deadline } }, include: { vendor: { select: { name: true } } }, orderBy: { endDate: 'asc' } });
  }

  // ─── PURCHASE ORDERS ────────────────────────────────────────────────────
  async getPurchaseOrders(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: 'desc' }, include: { vendor: { select: { name: true } }, items: true, _count: { select: { items: true } } } });
  }

  async getPurchaseOrder(id: string, tenantId: string) {
    return this.prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: { vendor: true, items: true } });
  }

  async createPurchaseOrder(tenantId: string, userId: string, data: any) {
    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO-${String(count + 1).padStart(5, '0')}`;
    const { items, ...poData } = data;
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({ data: { tenantId, poNumber, requestedById: userId, ...poData } });
      if (items?.length) {
        await tx.purchaseOrderItem.createMany({ data: items.map((item: any) => ({ poId: po.id, ...item, totalPrice: (item.quantity || 1) * (item.unitPrice || 0) })) });
      }
      const total = items?.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.unitPrice || 0), 0) || 0;
      return tx.purchaseOrder.update({ where: { id: po.id }, data: { totalAmount: total }, include: { items: true, vendor: true } });
    });
  }

  async approvePO(id: string, tenantId: string, userId: string) {
    return this.prisma.purchaseOrder.update({ where: { id, tenantId }, data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() } });
  }

  async receivePO(id: string, tenantId: string, data: { items?: { id: string; receivedQty: number }[] }) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!po) throw new NotFoundException('PO not found');

    return this.prisma.$transaction(async (tx) => {
      if (data.items) {
        for (const item of data.items) {
          await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.receivedQty } });
        }
      } else {
        for (const item of po.items) {
          await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.quantity } });
        }
      }
      const allReceived = po.items.every(i => (data.items?.find(d => d.id === i.id)?.receivedQty ?? i.quantity) >= i.quantity);
      return tx.purchaseOrder.update({ where: { id }, data: { status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED', receivedDate: new Date() }, include: { items: true } });
    });
  }

  async getProcurementDashboard(tenantId: string) {
    const [vendors, contracts, pos, expiring] = await Promise.all([
      this.prisma.vendor.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.contract.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      this.prisma.purchaseOrder.groupBy({ by: ['status'], where: { tenantId }, _count: true, _sum: { totalAmount: true } }),
      this.getExpiringContracts(tenantId, 30),
    ]);
    return { activeVendors: vendors, contractsByStatus: contracts, posByStatus: pos, expiringContracts: expiring.length, expiringDetails: expiring.slice(0, 5) };
  }

  // ─── CRON: Contract Expiry Checker ──────────────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async checkContractExpiry() {
    this.logger.log('Checking contract expiry...');
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      const contracts = await this.prisma.contract.findMany({
        where: { tenantId: t.id, status: 'ACTIVE', endDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      });
      for (const c of contracts) {
        const daysLeft = Math.ceil((c.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0) {
          await this.prisma.contract.update({ where: { id: c.id }, data: { status: 'EXPIRED' } });
        } else if (daysLeft <= c.renewalAlertDays) {
          await this.prisma.contract.update({ where: { id: c.id }, data: { status: 'PENDING_RENEWAL' } });
        }
      }
    }
  }

  // ─── CRON: Warranty Expiry Checker ──────────────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async checkWarrantyExpiry() {
    this.logger.log('Checking warranty/lease expiry...');
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    const assets = await this.prisma.asset.findMany({
      where: { OR: [{ warrantyExpiry: { lte: deadline, gte: new Date() } }, { leaseEndDate: { lte: deadline, gte: new Date() } }] },
      select: { id: true, name: true, tenantId: true, warrantyExpiry: true, leaseEndDate: true },
    });
    this.logger.log(`Found ${assets.length} assets with expiring warranty/lease`);
  }
}
