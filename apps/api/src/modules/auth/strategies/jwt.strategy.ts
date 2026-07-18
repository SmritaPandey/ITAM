import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';
import { PrismaService } from '../../../common/database/prisma.service';
import { ACCESS_COOKIE } from '../auth-cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        const logger = new Logger(JwtStrategy.name);
        logger.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start in production with an insecure fallback.');
        process.exit(1);
      }
      console.warn('⚠️  WARNING: JWT_SECRET is not set — using insecure fallback. DO NOT run this configuration in production!');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.[ACCESS_COOKIE] || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret || 'assetcommand-fallback-jwt-secret',
    });
  }

  async validate(payload: JwtPayload) {
    // Agent enrollment tokens must NOT inherit the pairing user's interactive admin role
    const isAgentToken =
      payload.role === 'agent' ||
      payload.sub === 'agent-session' ||
      (Array.isArray(payload.permissions) &&
        payload.permissions.length > 0 &&
        payload.permissions.every((p) => String(p).startsWith('discovery:')));

    if (isAgentToken) {
      let user = null;
      if (payload.sub && payload.sub !== 'agent-session') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(payload.sub)) {
          user = await this.prisma.user.findFirst({
            where: { id: payload.sub, tenantId: payload.tenantId, deletedAt: null },
          });
        }
      } else if (payload.email && payload.tenantId) {
        user = await this.prisma.user.findFirst({
          where: { email: payload.email, tenantId: payload.tenantId, deletedAt: null },
        });
      }
      if (user && user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User is not active or has been deleted');
      }
      // Tenant must still exist; user lookup is best-effort for audit attribution
      const tenant = await this.prisma.tenant.findUnique({ where: { id: payload.tenantId } });
      if (!tenant) {
        throw new UnauthorizedException('Invalid agent tenant');
      }
      return {
        sub: user?.id || payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        role: 'agent',
        permissions: (payload.permissions?.length
          ? payload.permissions
          : ['discovery:ingest', 'discovery:heartbeat']) as string[],
        isSuperAdmin: false,
        isAgent: true,
      };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.sub)) {
      throw new UnauthorizedException('Invalid user ID format');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: { role: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active or has been deleted');
    }

    return {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role?.name || 'employee',
      permissions: (user.role?.permissions as string[]) || [],
      isSuperAdmin: user.isSuperAdmin || false,
    };
  }
}
