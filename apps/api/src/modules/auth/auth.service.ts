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

      // 3. Create default roles
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
          name: 'Employee',
          description: 'Standard employee access',
          permissions: ['assets:read', 'tickets:read', 'tickets:write'],
        },
      });

      // 4. Create admin user
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
}

