import { Injectable, Logger, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../common/database/prisma.service';
import { EmailVerificationService } from './email-verification.service';
import { isPublicSignupDisabled } from '../../common/deployment-mode';

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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function passwordMeetsPolicy(password: string): boolean {
  return password.length >= 8 && password.length <= 128 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Brute-force protection: in-memory + persisted to user.preferences when user exists
  private loginAttempts: Map<string, { count: number; lastAttempt: number; lockedUntil: number }> = new Map();
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minute window

  /** One-time OAuth/SSO exchange codes — never put JWTs in redirect URLs */
  private oauthExchangeCodes = new Map<string, { tokens: AuthTokens; isNewUser: boolean; expiresAt: number }>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private emailVerification: EmailVerificationService,
  ) {
    // Periodic cleanup of expired exchange codes
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.oauthExchangeCodes) {
        if (v.expiresAt < now) this.oauthExchangeCodes.delete(k);
      }
    }, 60_000).unref?.();
  }

  async validateUser(email: string, password: string): Promise<any> {
    const normalizedEmail = email.toLowerCase().trim();
    // Check if account is locked (in-memory fast path)
    const attempts = this.loginAttempts.get(normalizedEmail);
    if (attempts && attempts.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      this.logger.warn(`Blocked login attempt for locked account: ${normalizedEmail}`);
      throw new UnauthorizedException(
        `Account temporarily locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).`
      );
    }

    const user = await this.usersService.findByEmail(email);
    if (user) {
      const prefs = (user.preferences as any) || {};
      const lock = prefs.loginLockout;
      if (lock?.lockedUntil && new Date(lock.lockedUntil).getTime() > Date.now()) {
        const remainingMinutes = Math.ceil((new Date(lock.lockedUntil).getTime() - Date.now()) / 60000);
        throw new UnauthorizedException(
          `Account temporarily locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).`
        );
      }
      if (user.status === 'LOCKED') {
        throw new UnauthorizedException('Account is locked. Contact your administrator.');
      }
    }

    if (!user || !user.passwordHash) {
      this.trackFailedLogin(normalizedEmail, null);
      throw new UnauthorizedException('Invalid credentials');
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      this.trackFailedLogin(normalizedEmail, user.id);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    // Block login for unverified new users (seeded/demo users are pre-verified)
    if (user.emailVerified === false) {
      throw new ForbiddenException('Please verify your email before signing in. Check your inbox for the verification link.');
    }
    // Successful login — clear failed attempts
    this.loginAttempts.delete(normalizedEmail);
    if ((user.preferences as any)?.loginLockout) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          preferences: {
            ...((user.preferences as object) || {}),
            loginLockout: null,
          },
        },
      }).catch(() => {});
    }

    return user;
  }

  private async trackFailedLogin(email: string, userId: string | null): Promise<void> {
    const now = Date.now();
    const existing = this.loginAttempts.get(email);

    if (existing && (now - existing.lastAttempt) < this.ATTEMPT_WINDOW_MS) {
      existing.count++;
      existing.lastAttempt = now;
      if (existing.count >= this.MAX_LOGIN_ATTEMPTS) {
        existing.lockedUntil = now + this.LOCKOUT_DURATION_MS;
        this.logger.warn(`Account locked for ${email} after ${existing.count} failed attempts`);
      }
    } else {
      this.loginAttempts.set(email, { count: 1, lastAttempt: now, lockedUntil: 0 });
    }

    // Persist lockout in preferences so it survives restarts
    if (userId) {
      const entry = this.loginAttempts.get(email)!;
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const prefs = ((user?.preferences as object) || {}) as Record<string, unknown>;
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            preferences: {
              ...prefs,
              loginLockout: {
                count: entry.count,
                lockedUntil: entry.lockedUntil ? new Date(entry.lockedUntil).toISOString() : null,
              },
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to persist login lockout: ${err.message}`);
      }
    }
  }

  async login(user: any, ip?: string, userAgent?: string): Promise<AuthTokens> {
    // MFA is handled by AuthController via MfaService.beginChallenge before this is called.
    return this.issueTokens(user, ip, userAgent);
  }

  async logout(userId: string): Promise<void> {
    // Revoke all refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refreshToken(token: string, ip?: string, userAgent?: string): Promise<AuthTokens> {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    // O(1) lookup via deterministic SHA-256 (UUID refresh tokens have high entropy)
    const tokenHash = sha256(token);
    const rt = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gte: new Date() } },
      include: { user: { include: { role: true } } },
    });

    if (!rt || rt.user.deletedAt || rt.user.status !== 'ACTIVE') {
      // Legacy bcrypt-hashed tokens (pre-migration): one-time O(n) fallback then re-issue as SHA-256
      const legacy = await this.findLegacyRefreshToken(token);
      if (!legacy) throw new UnauthorizedException('Invalid or expired refresh token');
      await this.prisma.refreshToken.update({
        where: { id: legacy.id },
        data: { revokedAt: new Date() },
      });
      return this.issueTokens(legacy.user, ip, userAgent);
    }

    await this.prisma.refreshToken.update({
      where: { id: rt.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(rt.user, ip, userAgent);
  }

  /** Temporary support for refresh tokens hashed with bcrypt before the SHA-256 migration */
  private async findLegacyRefreshToken(token: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gte: new Date() } },
      include: { user: { include: { role: true } } },
      take: 200, // bound CPU cost
    });
    for (const rt of tokens) {
      // SHA-256 hashes are 64 hex chars; bcrypt starts with $2
      if (!rt.tokenHash.startsWith('$2')) continue;
      const isMatch = await bcrypt.compare(token, rt.tokenHash);
      if (isMatch) return rt;
    }
    return null;
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
    if (isPublicSignupDisabled()) {
      throw new ForbiddenException(
        'Public self-registration is disabled on this deployment. Contact your administrator for an invite.',
      );
    }

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
      this.logger.error(`Failed to send verification email to ${result.user.email}: ${err.message}`, err.stack);
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
    tenantIdHint?: string;
    preferredRole?: string;
  }): Promise<AuthTokens & { isNewUser: boolean }> {
    const email = profile.email.toLowerCase();

    // 1. Try to find existing user by OAuth provider ID (optionally scoped to SSO tenant)
    let user = await this.prisma.user.findFirst({
      where: {
        oauthProvider: profile.provider,
        oauthProviderId: profile.providerId,
        deletedAt: null,
        ...(profile.tenantIdHint ? { tenantId: profile.tenantIdHint } : {}),
      },
      include: { role: true },
    });

    if (user) {
      if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
      const tokens = await this.issueTokens(user);
      return { ...tokens, isNewUser: false };
    }

    // 2. Try to find by email — always tenant-scoped when hint present; never cross-tenant link blindly
    if (profile.tenantIdHint) {
      user = await this.prisma.user.findFirst({
        where: { email, tenantId: profile.tenantIdHint, deletedAt: null },
        include: { role: true },
      });
    } else {
      const matches = await this.prisma.user.findMany({
        where: { email, deletedAt: null },
        include: { role: true },
        take: 5,
      });
      if (matches.length > 1) {
        throw new UnauthorizedException(
          'Multiple accounts exist for this email. Sign in with email/password and link OAuth from settings, or use your organization SSO.',
        );
      }
      user = matches[0] || null;
      // Do not auto-link password accounts that never verified email (account takeover risk)
      if (user && user.passwordHash && user.emailVerified === false) {
        throw new ForbiddenException(
          'Verify your email before linking a social login to this account.',
        );
      }
    }

    if (user) {
      if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          oauthProvider: profile.provider,
          oauthProviderId: profile.providerId,
          emailVerified: true,
          avatarUrl: profile.avatarUrl || user.avatarUrl,
        },
      });
      if (profile.preferredRole) {
        const role = await this.prisma.role.findFirst({
          where: { tenantId: user.tenantId, name: profile.preferredRole },
        });
        if (role) {
          await this.prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
          user.roleId = role.id;
          user.role = role;
        }
      }
      const tokens = await this.issueTokens(user);
      return { ...tokens, isNewUser: false };
    }

    // 2b. Tenant-scoped SSO (SAML/OIDC) — provision under that tenant only (never create a new workspace)
    if (profile.tenantIdHint) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: profile.tenantIdHint } });
      if (!tenant) throw new UnauthorizedException('SSO tenant not found');

      let role = profile.preferredRole
        ? await this.prisma.role.findFirst({
            where: { tenantId: tenant.id, name: profile.preferredRole },
          })
        : null;
      if (!role) {
        role = await this.prisma.role.findFirst({
          where: { tenantId: tenant.id, name: { in: ['Employee', 'IT Admin', 'Tenant Admin'] } },
          orderBy: { name: 'asc' },
        });
      }
      if (!role) throw new UnauthorizedException('No role available for SSO user provisioning');

      user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          firstName: profile.firstName || email.split('@')[0],
          lastName: profile.lastName || '',
          roleId: role.id,
          status: 'ACTIVE',
          emailVerified: true,
          oauthProvider: profile.provider,
          oauthProviderId: profile.providerId,
          avatarUrl: profile.avatarUrl || null,
        },
        include: { role: true },
      });
      const tokens = await this.issueTokens(user);
      return { ...tokens, isNewUser: true };
    }

    // 3. New user — create full tenant workspace (same as registerTenant)
    if (isPublicSignupDisabled()) {
      throw new ForbiddenException(
        'Public self-registration is disabled on this deployment. An administrator must invite your account.',
      );
    }

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

    // Login the newly created user (SSO/OAuth bypasses local MFA — IdP is trusted)
    const freshUser = await this.prisma.user.findUnique({
      where: { id: result.user.id },
      include: { role: true },
    });
    const tokens = await this.issueTokens(freshUser!);
    return { ...tokens, isNewUser: true };
  }

  /** Issue JWT pair without MFA challenge (used by OAuth/SAML and after MFA verify). */
  async issueTokens(user: any, ip?: string, userAgent?: string): Promise<AuthTokens> {
    const role = user.role || await this.prisma.role.findUnique({ where: { id: user.roleId } });
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
    const refreshTokenValue = uuidv4();
    const refreshTokenHash = sha256(refreshTokenValue);
    const refreshExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(refreshExpiry) || 7);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });
    return { accessToken, refreshToken: refreshTokenValue };
  }

  /**
   * Store tokens behind a one-time code for OAuth/SSO redirects (never put JWTs in URL query).
   */
  createOAuthExchangeCode(tokens: AuthTokens, isNewUser: boolean): string {
    const code = randomBytes(32).toString('hex');
    this.oauthExchangeCodes.set(code, {
      tokens,
      isNewUser,
      expiresAt: Date.now() + 60_000, // 60s
    });
    return code;
  }

  consumeOAuthExchangeCode(code: string): AuthTokens & { isNewUser: boolean } {
    const entry = this.oauthExchangeCodes.get(code);
    this.oauthExchangeCodes.delete(code);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }
    return { ...entry.tokens, isNewUser: entry.isNewUser };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    // To prevent user enumeration, we return success even if user isn't found
    if (!user) {
      return { message: 'If this email is registered in our directory, a recovery link will be sent shortly.' };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = sha256(token);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: expiry,
      },
    });

    // Trigger branded email (non-blocking) — email contains plaintext token
    try {
      await this.emailVerification.sendResetPasswordEmail(
        user.id,
        user.email,
        user.firstName,
        token,
      );
    } catch (err: any) {
      this.logger.error(`Failed to send password reset email to ${user.email}: ${err.message}`, err.stack);
    }

    return { message: 'If this email is registered in our directory, a recovery link will be sent shortly.' };
  }

  async resetPassword(dto: { token: string; password: string }): Promise<{ message: string }> {
    if (!dto.token || !dto.password) {
      throw new BadRequestException('Token and password are required');
    }
    if (!passwordMeetsPolicy(dto.password)) {
      throw new BadRequestException(
        'Password must be 8–128 characters and include at least one uppercase letter and one number',
      );
    }

    const tokenHash = sha256(dto.token);
    // Support both hashed (new) and legacy plaintext tokens during rollout
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { passwordResetToken: tokenHash },
          { passwordResetToken: dto.token },
        ],
        passwordResetExpiry: { gte: new Date() },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new ForbiddenException('Invalid or expired password reset link.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
        emailVerified: true,
      },
    });

    // Revoke all sessions after password change
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password has been reset successfully. You can now log in.' };
  }

  /**
   * Short-lived agent enrollment token. JwtStrategy reloads role from DB —
   * keep lifetime bounded and prefer real userId over agent-session.
   */
  generateAgentToken(tenantId: string, email: string, userId?: string): string {
    const payload: JwtPayload = {
      sub: userId || 'agent-session',
      email: email,
      tenantId: tenantId,
      role: 'agent',
      permissions: ['discovery:ingest', 'discovery:heartbeat'],
      isSuperAdmin: false,
    };
    return this.jwtService.sign(payload, { expiresIn: '90d' });
  }
}

