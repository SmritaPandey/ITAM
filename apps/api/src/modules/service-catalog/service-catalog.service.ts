import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ServiceCatalogService {
  private readonly logger = new Logger(ServiceCatalogService.name);

  constructor(private prisma: PrismaService) {}

  private readonly defaultCatalogItems = [
    { name: 'New Laptop Request', category: 'Hardware', description: 'Request a new laptop for an employee', sla: '5 business days', approvalRequired: true, icon: 'laptop' },
    { name: 'Software Installation', category: 'Software', description: 'Request installation of approved software', sla: '2 business days', approvalRequired: false, icon: 'download' },
    { name: 'VPN Access', category: 'Access', description: 'Request VPN access for remote work', sla: '1 business day', approvalRequired: true, icon: 'shield' },
    { name: 'Email Distribution List', category: 'Email', description: 'Request creation/modification of email DL', sla: '1 business day', approvalRequired: false, icon: 'mail' },
    { name: 'Password Reset', category: 'Access', description: 'Reset password for any enterprise application', sla: '4 hours', approvalRequired: false, icon: 'key' },
    { name: 'Office Relocation', category: 'Facility', description: 'Request office/desk relocation', sla: '3 business days', approvalRequired: true, icon: 'map-pin' },
  ];

  /**
   * Seeds default catalog items for a tenant if none exist.
   * Called lazily on first catalog access.
   */
  private async ensureDefaults(tenantId: string): Promise<void> {
    const count = await this.prisma.serviceCatalogItem.count({ where: { tenantId } });
    if (count > 0) return;

    // Check if tenant has legacy JSON catalog in settings and migrate it
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};

    if (Array.isArray(settings.serviceCatalog) && settings.serviceCatalog.length > 0) {
      // Migrate legacy JSON items to DB
      this.logger.log(`Migrating ${settings.serviceCatalog.length} legacy catalog items for tenant ${tenantId}`);
      await this.prisma.serviceCatalogItem.createMany({
        data: settings.serviceCatalog.map((item: any, index: number) => ({
          tenantId,
          name: item.name || 'Untitled Service',
          category: item.category || 'General',
          description: item.description || null,
          sla: item.sla || null,
          approvalRequired: item.approvalRequired ?? false,
          icon: item.icon || 'circle',
          sortOrder: index,
        })),
      });

      // Remove the legacy JSON key to avoid re-migration
      delete settings.serviceCatalog;
      await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings } });
      return;
    }

    // Seed with defaults
    await this.prisma.serviceCatalogItem.createMany({
      data: this.defaultCatalogItems.map((item, index) => ({
        tenantId,
        ...item,
        sortOrder: index,
      })),
    });
    this.logger.log(`Seeded ${this.defaultCatalogItems.length} default catalog items for tenant ${tenantId}`);
  }

  async getCatalog(tenantId: string) {
    await this.ensureDefaults(tenantId);
    return this.prisma.serviceCatalogItem.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getItem(tenantId: string, id: string) {
    const item = await this.prisma.serviceCatalogItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException('Catalog item not found');
    return item;
  }

  async createItem(tenantId: string, data: any) {
    // Get max sort order for this tenant
    const maxSort = await this.prisma.serviceCatalogItem.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });

    return this.prisma.serviceCatalogItem.create({
      data: {
        tenantId,
        name: data.name || 'Untitled Service',
        category: data.category || 'General',
        description: data.description || null,
        sla: data.sla || null,
        approvalRequired: data.approvalRequired ?? false,
        icon: data.icon || 'circle',
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        ...(data.formFields && { formFields: data.formFields }),
      },
    });
  }

  async updateItem(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.serviceCatalogItem.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Catalog item not found');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sla !== undefined) updateData.sla = data.sla;
    if (data.approvalRequired !== undefined) updateData.approvalRequired = data.approvalRequired;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.formFields !== undefined) updateData.formFields = data.formFields;

    return this.prisma.serviceCatalogItem.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteItem(tenantId: string, id: string) {
    const existing = await this.prisma.serviceCatalogItem.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Catalog item not found');

    await this.prisma.serviceCatalogItem.delete({ where: { id } });
    return { deleted: true, item: existing };
  }

  async requestService(tenantId: string, userId: string, serviceId: string, body: any) {
    // Validate the catalog item exists
    const catalogItem = await this.getItem(tenantId, serviceId);

    // Create a ticket from the service catalog request
    const lastTicket = await this.prisma.ticket.findFirst({
      where: { tenantId },
      orderBy: { ticketNumber: 'desc' },
    });
    const nextNum = lastTicket ? parseInt(lastTicket.ticketNumber.replace(/\D/g, '') || '0') + 1 : 1;

    return this.prisma.ticket.create({
      data: {
        tenantId,
        ticketNumber: `SR-${String(nextNum).padStart(5, '0')}`,
        type: 'SERVICE_REQUEST',
        category: catalogItem.category || 'Service Request',
        subject: body.subject || `Service Request: ${catalogItem.name}`,
        description: body.description || catalogItem.description || '',
        priority: 'MEDIUM',
        status: 'NEW',
        requesterId: userId,
      },
    });
  }
}
