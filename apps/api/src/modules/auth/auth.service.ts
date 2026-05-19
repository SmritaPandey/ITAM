import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../common/database/prisma.service';
import { EmailVerificationService } from './email-verification.service';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  tenantId: string;
  role: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private emailVerification: EmailVerificationService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    // Block login for unverified new users (seeded/demo users are pre-verified)
    if (user.emailVerified === false) {
      throw new ForbiddenException('Please verify your email before signing in. Check your inbox for the verification link.');
    }
    return user;
  }

  async login(user: any, ip?: string, userAgent?: string): Promise<AuthTokens> {
    const role = await this.prisma.role.findUnique({ where: { id: user.roleId } });
    const permissions = (role?.permissions as string[]) || [];

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: role?.name || 'employee',
      permissions,
      isSuperAdmin: user.isSuperAdmin || false,
    };

    const accessToken = this.jwtService.sign(payload);

    // Create refresh token
    const refreshTokenValue = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshTokenValue, 10);
    const refreshExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(refreshExpiry));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    return { accessToken, refreshToken: refreshTokenValue };
  }

  async logout(userId: string): Promise<void> {
    // Revoke all refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refreshToken(token: string, ip?: string, userAgent?: string): Promise<AuthTokens> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gte: new Date() } },
      include: { user: { include: { role: true } } },
    });

    for (const rt of tokens) {
      const isMatch = await bcrypt.compare(token, rt.tokenHash);
      if (isMatch) {
        // Revoke the used token (rotation)
        await this.prisma.refreshToken.update({
          where: { id: rt.id },
          data: { revokedAt: new Date() },
        });
        // Issue new tokens
        return this.login(rt.user, ip, userAgent);
      }
    }
    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatarUrl: true, status: true, lastLoginAt: true,
        department: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        role: { select: { id: true, name: true, permissions: true } },
        tenant: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  /**
   * Self-service tenant registration — creates tenant, roles, and admin user.
   */
  async registerTenant(dto: {
    companyName: string;
    fullName: string;
    email: string;
    password: string;
  }) {
    // Check if email already exists
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new UnauthorizedException('An account with this email already exists');
    }

    const slug = dto.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);

    // Check slug uniqueness
    const slugExists = await this.prisma.tenant.findFirst({
      where: { slug: { startsWith: slug } },
    });
    const finalSlug = slugExists ? `${slug}-${Date.now().toString(36)}` : slug;

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const [firstName, ...rest] = dto.fullName.trim().split(' ');
    const lastName = rest.join(' ') || '';

    // Create everything in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          slug: finalSlug,
          plan: 'STARTER',
          status: 'ACTIVE',
          settings: {
            maxAssets: 100,
            maxUsers: 5,
            features: ['assets', 'tickets', 'discovery', 'reports'],
          },
        },
      });

      // 2. Create default site
      await tx.site.create({
        data: { tenantId: tenant.id, name: 'Headquarters', isHq: true },
      });

      // 3. Create default department
      await tx.department.create({
        data: { tenantId: tenant.id, name: 'IT Department' },
      });

      // 4. Create default roles (Admin + IT Admin + Staff + Employee)
      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Tenant Admin',
          description: 'Full administrative access',
          permissions: [
            'assets:read', 'assets:write', 'assets:delete',
            'tickets:read', 'tickets:write', 'tickets:delete',
            'users:read', 'users:write', 'users:delete',
            'settings:read', 'settings:write',
            'reports:read', 'reports:export',
            'monitoring:read', 'monitoring:write',
            'scanning:read', 'scanning:execute',
            'admin:full',
          ],
        },
      });

      await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'IT Admin',
          description: 'IT operations administrator',
          permissions: [
            'assets:read', 'assets:write', 'assets:delete',
            'tickets:read', 'tickets:write', 'tickets:delete',
            'monitoring:read', 'monitoring:write',
            'scanning:read', 'scanning:execute',
            'reports:read', 'reports:export',
          ],
        },
      });

      await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Staff',
          description: 'Regular staff member',
          permissions: [
            'assets:read',
            'tickets:read', 'tickets:write',
          ],
        },
      });

      await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Employee',
          description: 'Standard employee access',
          permissions: ['assets:read', 'tickets:read', 'tickets:write'],
        },
      });

      // 5. Create admin user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          roleId: adminRole.id,
          status: 'ACTIVE',
        },
      });

      // 6. Create default asset types
      await tx.assetType.createMany({
        data: [
          { tenantId: tenant.id, name: 'Laptop', isItAsset: true, icon: 'laptop', color: '#6366f1' },
          { tenantId: tenant.id, name: 'Desktop', isItAsset: true, icon: 'monitor', color: '#3b82f6' },
          { tenantId: tenant.id, name: 'Server', isItAsset: true, icon: 'server', color: '#8b5cf6' },
          { tenantId: tenant.id, name: 'Network Device', isItAsset: true, icon: 'router', color: '#0ea5e9' },
          { tenantId: tenant.id, name: 'Printer', isItAsset: true, icon: 'printer', color: '#a855f7' },
          { tenantId: tenant.id, name: 'Furniture', isItAsset: false, icon: 'armchair', color: '#f97316' },
          { tenantId: tenant.id, name: 'Vehicle', isItAsset: false, icon: 'car', color: '#10b981' },
        ],
      });

      // 7. Create default SLA policies
      await tx.slaPolicy.createMany({
        data: [
          { tenantId: tenant.id, name: 'Critical SLA', priority: 'CRITICAL', responseHours: 1, resolutionHours: 4, escalationHours: 2, isDefault: true },
          { tenantId: tenant.id, name: 'High SLA', priority: 'HIGH', responseHours: 4, resolutionHours: 8, escalationHours: 6, isDefault: true },
          { tenantId: tenant.id, name: 'Medium SLA', priority: 'MEDIUM', responseHours: 8, resolutionHours: 24, escalationHours: 16, isDefault: true },
          { tenantId: tenant.id, name: 'Low SLA', priority: 'LOW', responseHours: 24, resolutionHours: 72, escalationHours: 48, isDefault: true },
        ],
      });

      // 8. Create default automation rules
      await tx.automationRule.createMany({
        data: [
          {
            tenantId: tenant.id, name: 'Auto-ticket on device offline > 1h',
            description: 'Creates a ticket when a monitored device goes offline',
            triggerModule: 'Monitoring', triggerEvent: 'device_offline',
            actionModule: 'Tickets', actionType: 'create_ticket',
            status: 'ACTIVE', cooldownMinutes: 60, actionConfig: {},
          },
          {
            tenantId: tenant.id, name: 'Notify on SLA breach',
            description: 'Send notification when ticket SLA is breached',
            triggerModule: 'Ticket', triggerEvent: 'sla_breach',
            actionModule: 'Notifications', actionType: 'send_notification',
            status: 'ACTIVE', cooldownMinutes: 30, actionConfig: {},
          },
          {
            tenantId: tenant.id, name: 'Alert on new unmanaged device',
            description: 'Notify admin when network scan discovers new devices',
            triggerModule: 'Discovery', triggerEvent: 'scan_completed',
            actionModule: 'Notifications', actionType: 'send_notification',
            status: 'ACTIVE', cooldownMinutes: 15, actionConfig: {},
          },
        ],
      });

      return { tenant, user };
    });

    // Send verification email (non-blocking)
    try {
      await this.emailVerification.sendVerificationEmail(
        result.user.id,
        result.user.email,
        firstName,
      );
    } catch (err: any) {
      // Don't fail registration if email sending fails
    }

    return {
      message: 'Account created successfully. Please check your email to verify your account.',
      tenantId: result.tenant.id,
      tenantSlug: result.tenant.slug,
      userId: result.user.id,
      requiresVerification: true,
    };
  }

  /**
   * OAuth login/registration — handles both existing users and new tenant creation.
   * If user exists: link OAuth provider, login.
   * If new: create full tenant workspace (same as registerTenant), then login.
   */
  async oauthLogin(profile: {
    provider: string;
    providerId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  }): Promise<AuthTokens & { isNewUser: boolean }> {
    const email = profile.email.toLowerCase();

    // 1. Try to find existing user by OAuth provider ID
    let user = await this.prisma.user.findFirst({
      where: {
        oauthProvider: profile.provider,
        oauthProviderId: profile.providerId,
        deletedAt: null,
      },
      include: { role: true },
    });

    if (user) {
      // Existing OAuth user — just login
      const tokens = await this.login(user);
      return { ...tokens, isNewUser: false };
    }

    // 2. Try to find by email (user registered via email, now linking OAuth)
    user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    });

    if (user) {
      // Link OAuth to existing account
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          oauthProvider: profile.provider,
          oauthProviderId: profile.providerId,
          emailVerified: true, // OAuth proves email ownership
          avatarUrl: profile.avatarUrl || user.avatarUrl,
        },
      });
      const tokens = await this.login(user);
      return { ...tokens, isNewUser: false };
    }

    // 3. New user — create full tenant workspace (same as registerTenant)
    const companyName = `${profile.firstName}'s Organization`;
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);
    const slugExists = await this.prisma.tenant.findFirst({
      where: { slug: { startsWith: slug } },
    });
    const finalSlug = slugExists ? `${slug}-${Date.now().toString(36)}` : slug;

    const result = await this.prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug: finalSlug,
          plan: 'STARTER',
          status: 'ACTIVE',
          settings: {
            maxAssets: 100,
            maxUsers: 5,
            features: ['assets', 'tickets', 'discovery', 'reports'],
          },
        },
      });

      // Default site
      await tx.site.create({
        data: { tenantId: tenant.id, name: 'Headquarters', isHq: true },
      });

      // Default department
      await tx.department.create({
        data: { tenantId: tenant.id, name: 'IT Department' },
      });

      // Roles
      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Tenant Admin',
          description: 'Full administrative access',
          permissions: [
            'assets:read', 'assets:write', 'assets:delete',
            'tickets:read', 'tickets:write', 'tickets:delete',
            'users:read', 'users:write', 'users:delete',
            'settings:read', 'settings:write',
            'reports:read', 'reports:export',
            'monitoring:read', 'monitoring:write',
            'scanning:read', 'scanning:execute',
            'admin:full',
          ],
        },
      });

      await tx.role.createMany({
        data: [
          {
            tenantId: tenant.id, name: 'IT Admin', description: 'IT operations administrator',
            permissions: ['assets:read', 'assets:write', 'assets:delete', 'tickets:read', 'tickets:write', 'tickets:delete', 'monitoring:read', 'monitoring:write', 'scanning:read', 'scanning:execute', 'reports:read', 'reports:export'],
          },
          {
            tenantId: tenant.id, name: 'Staff', description: 'Regular staff member',
            permissions: ['assets:read', 'tickets:read', 'tickets:write'],
          },
          {
            tenantId: tenant.id, name: 'Employee', description: 'Standard employee access',
            permissions: ['assets:read', 'tickets:read', 'tickets:write'],
          },
        ],
      });

      // Create admin user (no password — OAuth user)
      const newUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          firstName: profile.firstName || 'User',
          lastName: profile.lastName || '',
          roleId: adminRole.id,
          status: 'ACTIVE',
          emailVerified: true, // OAuth proves email
          oauthProvider: profile.provider,
          oauthProviderId: profile.providerId,
          avatarUrl: profile.avatarUrl,
        },
      });

      // Default asset types
      await tx.assetType.createMany({
        data: [
          { tenantId: tenant.id, name: 'Laptop', isItAsset: true, icon: 'laptop', color: '#6366f1' },
          { tenantId: tenant.id, name: 'Desktop', isItAsset: true, icon: 'monitor', color: '#3b82f6' },
          { tenantId: tenant.id, name: 'Server', isItAsset: true, icon: 'server', color: '#8b5cf6' },
          { tenantId: tenant.id, name: 'Network Device', isItAsset: true, icon: 'router', color: '#0ea5e9' },
          { tenantId: tenant.id, name: 'Printer', isItAsset: true, icon: 'printer', color: '#a855f7' },
          { tenantId: tenant.id, name: 'Furniture', isItAsset: false, icon: 'armchair', color: '#f97316' },
          { tenantId: tenant.id, name: 'Vehicle', isItAsset: false, icon: 'car', color: '#10b981' },
        ],
      });

      // Default SLA policies
      await tx.slaPolicy.createMany({
        data: [
          { tenantId: tenant.id, name: 'Critical SLA', priority: 'CRITICAL', responseHours: 1, resolutionHours: 4, escalationHours: 2, isDefault: true },
          { tenantId: tenant.id, name: 'High SLA', priority: 'HIGH', responseHours: 4, resolutionHours: 8, escalationHours: 6, isDefault: true },
          { tenantId: tenant.id, name: 'Medium SLA', priority: 'MEDIUM', responseHours: 8, resolutionHours: 24, escalationHours: 16, isDefault: true },
          { tenantId: tenant.id, name: 'Low SLA', priority: 'LOW', responseHours: 24, resolutionHours: 72, escalationHours: 48, isDefault: true },
        ],
      });

      // Default automation rules
      await tx.automationRule.createMany({
        data: [
          {
            tenantId: tenant.id, name: 'Auto-ticket on device offline > 1h',
            description: 'Creates a ticket when a monitored device goes offline',
            triggerModule: 'Monitoring', triggerEvent: 'device_offline',
            actionModule: 'Tickets', actionType: 'create_ticket',
            status: 'ACTIVE', cooldownMinutes: 60, actionConfig: {},
          },
          {
            tenantId: tenant.id, name: 'Notify on SLA breach',
            description: 'Send notification when ticket SLA is breached',
            triggerModule: 'Ticket', triggerEvent: 'sla_breach',
            actionModule: 'Notifications', actionType: 'send_notification',
            status: 'ACTIVE', cooldownMinutes: 30, actionConfig: {},
          },
          {
            tenantId: tenant.id, name: 'Alert on new unmanaged device',
            description: 'Notify admin when network scan discovers new devices',
            triggerModule: 'Discovery', triggerEvent: 'scan_completed',
            actionModule: 'Notifications', actionType: 'send_notification',
            status: 'ACTIVE', cooldownMinutes: 15, actionConfig: {},
          },
        ],
      });

      return { tenant, user: newUser };
    });

    // Login the newly created user
    const freshUser = await this.prisma.user.findUnique({
      where: { id: result.user.id },
      include: { role: true },
    });
    const tokens = await this.login(freshUser!);
    return { ...tokens, isNewUser: true };
  }
}
