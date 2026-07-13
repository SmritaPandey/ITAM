import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(private prisma: PrismaService) {}

  async getStatus() {
    const tenantCount = await this.prisma.tenant.count();
    return {
      initialized: tenantCount > 0,
      tenantCount,
      version: '1.0.0',
      features: {
        discovery: true,
        automation: true,
        sla: true,
        knowledgeBase: true,
        credentialVault: true,
      },
    };
  }

  async initialize(data: {
    organizationName: string;
    adminEmail: string;
    adminPassword: string;
    adminName: string;
    timezone?: string;
    industry?: string;
  }) {
    // Prevent re-initialization
    const existing = await this.prisma.tenant.count();
    if (existing > 0) {
      throw new ConflictException('System is already initialized. Use the admin panel to manage settings.');
    }

    this.logger.log(`Initializing system for organization: ${data.organizationName}`);

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.organizationName,
        slug: data.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
        plan: process.env.DEPLOYMENT_MODE === 'onprem' ? 'ON_PREMISE' : 'STARTER',
        settings: {
          timezone: data.timezone || 'UTC',
          industry: data.industry || 'Technology',
          dateFormat: 'YYYY-MM-DD',
          businessHours: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] },
          deploymentMode: process.env.DEPLOYMENT_MODE || 'saas',
        },
      },
    });

    // Create default roles
    const roles = await Promise.all([
      this.prisma.role.create({ data: { tenantId: tenant.id, name: 'Tenant Admin', description: 'Full system administrator', permissions: ['*'] } }),
      this.prisma.role.create({ data: { tenantId: tenant.id, name: 'IT Admin', description: 'IT operations administrator', permissions: ['assets.*', 'tickets.*', 'discovery.*', 'patches.*', 'monitoring.*', 'automation.*'] } }),
      this.prisma.role.create({ data: { tenantId: tenant.id, name: 'Staff', description: 'Regular employee', permissions: ['tickets.create', 'tickets.read.own', 'assets.read.own', 'knowledge-base.read', 'service-catalog.read'] } }),
    ]);

    // Create admin user
    const hashedPassword = await bcrypt.hash(data.adminPassword, 12);
    const admin = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: data.adminEmail,
        passwordHash: hashedPassword,
        firstName: data.adminName.split(' ')[0] || data.adminName,
        lastName: data.adminName.split(' ').slice(1).join(' ') || 'Admin',
        roleId: roles[0].id,
        status: 'ACTIVE',
      },
    });

    // Create default site
    await this.prisma.site.create({
      data: { tenantId: tenant.id, name: 'Headquarters', address: '' },
    });

    // Create default department
    await this.prisma.department.create({
      data: { tenantId: tenant.id, name: 'IT Department' },
    });

    // Create default SLA policies
    await this.prisma.slaPolicy.createMany({
      data: [
        { tenantId: tenant.id, name: 'Critical SLA', priority: 'CRITICAL', responseHours: 1, resolutionHours: 4, escalationHours: 2, isDefault: true },
        { tenantId: tenant.id, name: 'High SLA', priority: 'HIGH', responseHours: 4, resolutionHours: 8, escalationHours: 6, isDefault: true },
        { tenantId: tenant.id, name: 'Medium SLA', priority: 'MEDIUM', responseHours: 8, resolutionHours: 24, escalationHours: 16, isDefault: true },
        { tenantId: tenant.id, name: 'Low SLA', priority: 'LOW', responseHours: 24, resolutionHours: 72, escalationHours: 48, isDefault: true },
      ],
    });

    // Create default asset types
    await this.prisma.assetType.createMany({
      data: [
        { tenantId: tenant.id, name: 'Laptop', isItAsset: true },
        { tenantId: tenant.id, name: 'Desktop', isItAsset: true },
        { tenantId: tenant.id, name: 'Server', isItAsset: true },
        { tenantId: tenant.id, name: 'Network Device', isItAsset: true },
        { tenantId: tenant.id, name: 'Printer', isItAsset: true },
        { tenantId: tenant.id, name: 'Furniture', isItAsset: false },
        { tenantId: tenant.id, name: 'Vehicle', isItAsset: false },
      ],
    });

    // Create default automation rules
    await this.prisma.automationRule.createMany({
      data: [
        {
          tenantId: tenant.id, name: 'Auto-ticket on device offline > 1h', description: 'Creates a ticket when a device is offline for more than 1 hour',
          triggerModule: 'Monitoring', triggerEvent: 'device_offline', actionModule: 'Tickets', actionType: 'create_ticket',
          status: 'ACTIVE', cooldownMinutes: 60, actionConfig: {},
        },
        {
          tenantId: tenant.id, name: 'Notify on SLA breach', description: 'Send notification when ticket SLA is breached',
          triggerModule: 'Ticket', triggerEvent: 'sla_breach', actionModule: 'Notifications', actionType: 'send_notification',
          status: 'ACTIVE', cooldownMinutes: 30, actionConfig: {},
        },
        {
          tenantId: tenant.id, name: 'Alert on new unmanaged device', description: 'Notify admin when a new device is discovered',
          triggerModule: 'Discovery', triggerEvent: 'scan_completed', actionModule: 'Notifications', actionType: 'send_notification',
          status: 'ACTIVE', cooldownMinutes: 15, actionConfig: {},
        },
      ],
    });

    this.logger.log(`System initialized: tenant=${tenant.id}, admin=${admin.id}`);

    return {
      success: true,
      tenant: { id: tenant.id, name: tenant.name },
      admin: { id: admin.id, email: admin.email },
      defaults: {
        roles: roles.length,
        slaPolicies: 4,
        assetTypes: 7,
        automationRules: 3,
      },
      message: 'System initialized successfully. You can now log in with your admin credentials.',
    };
  }
}
