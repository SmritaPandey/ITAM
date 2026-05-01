import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class LicensesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, page = 1, limit = 20) {
    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      this.prisma.license.findMany({
        where: { tenantId },
        include: { _count: { select: { assignments: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.license.count({ where: { tenantId } }),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(id: string, tenantId: string) {
    const license = await this.prisma.license.findFirst({
      where: { id, tenantId },
      include: { assignments: true },
    });
    if (!license) throw new NotFoundException('License not found');
    return license;
  }

  async create(tenantId: string, data: any) {
    return this.prisma.license.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: any) {
    await this.findById(id, tenantId);
    return this.prisma.license.update({ where: { id }, data });
  }

  async getCompliance(tenantId: string) {
    const licenses = await this.prisma.license.findMany({ where: { tenantId } });
    const total = licenses.length;
    const compliant = licenses.filter(l => l.usedSeats <= l.totalSeats && l.status === 'ACTIVE').length;
    const overused = licenses.filter(l => l.usedSeats > l.totalSeats).length;
    const expiring = licenses.filter(l => {
      if (!l.expiryDate) return false;
      const daysLeft = (l.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysLeft > 0 && daysLeft <= 30;
    }).length;
    const expired = licenses.filter(l => l.status === 'EXPIRED' || (l.expiryDate && l.expiryDate < new Date())).length;
    const totalCost = licenses.reduce((s, l) => s + Number(l.purchaseCost || 0), 0);

    return { total, compliant, overused, expiring, expired, complianceRate: total > 0 ? Math.round((compliant / total) * 100) : 100, totalCost };
  }

  async getAssignments(licenseId: string) {
    return this.prisma.licenseAssignment.findMany({
      where: { licenseId },
      orderBy: { assignedAt: 'desc' },
    });
  }
}
