import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, domain: true, plan: true, settings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return {
      tenantId: tenant.id,
      orgName: tenant.name,
      domain: tenant.domain,
      plan: tenant.plan,
      ...(typeof tenant.settings === 'object' ? tenant.settings as Record<string, any> : {}),
    };
  }

  async updateSettings(tenantId: string, data: Record<string, any>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Merge with existing settings
    const existing = typeof tenant.settings === 'object' ? (tenant.settings as Record<string, any>) : {};
    const merged = { ...existing, ...data };

    // Update org-level fields if provided
    const update: any = { settings: merged };
    if (data.orgName) update.name = data.orgName;
    if (data.domain) update.domain = data.domain;

    const result = await this.prisma.tenant.update({ where: { id: tenantId }, data: update });
    return {
      tenantId: result.id,
      orgName: result.name,
      domain: result.domain,
      plan: result.plan,
      ...(typeof result.settings === 'object' ? result.settings as Record<string, any> : {}),
    };
  }

  async getSites(tenantId: string) {
    return this.prisma.site.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async getDepartments(tenantId: string) {
    return this.prisma.department.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }
}
