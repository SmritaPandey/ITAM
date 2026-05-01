import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../common/database/prisma.service';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  tenantId: string;
  role: string;
  permissions: string[];
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
}
