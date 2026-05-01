import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ServiceCatalogService {
  constructor(private prisma: PrismaService) {}

  async getCatalog(tenantId: string) {
    // Service catalog items stored in tenant settings
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    return settings.serviceCatalog || [
      { id: '1', name: 'New Laptop Request', category: 'Hardware', description: 'Request a new laptop for an employee', sla: '5 business days', approvalRequired: true, icon: 'laptop' },
      { id: '2', name: 'Software Installation', category: 'Software', description: 'Request installation of approved software', sla: '2 business days', approvalRequired: false, icon: 'download' },
      { id: '3', name: 'VPN Access', category: 'Access', description: 'Request VPN access for remote work', sla: '1 business day', approvalRequired: true, icon: 'shield' },
      { id: '4', name: 'Email Distribution List', category: 'Email', description: 'Request creation/modification of email DL', sla: '1 business day', approvalRequired: false, icon: 'mail' },
      { id: '5', name: 'Password Reset', category: 'Access', description: 'Reset password for any enterprise application', sla: '4 hours', approvalRequired: false, icon: 'key' },
      { id: '6', name: 'Office Relocation', category: 'Facility', description: 'Request office/desk relocation', sla: '3 business days', approvalRequired: true, icon: 'map-pin' },
    ];
  }

  async requestService(tenantId: string, userId: string, serviceId: string, body: any) {
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
        category: body.category || 'Service Request',
        subject: body.subject || `Service Request: ${serviceId}`,
        description: body.description || '',
        priority: 'MEDIUM',
        status: 'NEW',
        requesterId: userId,
      },
    });
  }
}
