import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({ where: { slug } });
  }

  async create(data: { name: string; slug: string; domain?: string }) {
    return this.prisma.tenant.create({ data });
  }

  async updateSettings(tenantId: string, body: any) {
    const { name, domain, logoUrl, settings } = body;
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name && { name }),
        ...(domain && { domain }),
        ...(logoUrl && { logoUrl }),
        ...(settings && { settings }),
      },
    });
  }
}
