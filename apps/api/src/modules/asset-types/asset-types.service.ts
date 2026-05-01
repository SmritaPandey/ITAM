import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class AssetTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.assetType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, body: any) {
    return this.prisma.assetType.create({
      data: { tenantId, ...body },
    });
  }

  async update(id: string, body: any) {
    return this.prisma.assetType.update({
      where: { id },
      data: body,
    });
  }
}
