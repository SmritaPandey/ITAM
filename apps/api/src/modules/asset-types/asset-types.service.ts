import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  async findById(id: string, tenantId: string) {
    const assetType = await this.prisma.assetType.findFirst({
      where: { id, tenantId },
    });
    if (!assetType) throw new NotFoundException('Asset type not found');
    return assetType;
  }

  async create(tenantId: string, body: any) {
    return this.prisma.assetType.create({
      data: { tenantId, ...body },
    });
  }

  async update(id: string, tenantId: string, body: any) {
    await this.findById(id, tenantId);
    return this.prisma.assetType.update({
      where: { id, tenantId },
      data: body,
    });
  }

  async delete(id: string, tenantId: string) {
    await this.findById(id, tenantId);

    // FK guard: check if any assets use this type before allowing deletion
    const assetCount = await this.prisma.asset.count({
      where: { assetTypeId: id, tenantId, deletedAt: null },
    });
    if (assetCount > 0) {
      throw new BadRequestException(
        `Cannot delete asset type: ${assetCount} asset(s) are still using this type. Reassign them first.`,
      );
    }

    return this.prisma.assetType.delete({
      where: { id, tenantId },
    });
  }
}
