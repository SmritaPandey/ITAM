import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';
import { PrismaService } from '../../../common/database/prisma.service';

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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'assetcommand-fallback-jwt-secret',
    });
  }

  async validate(payload: JwtPayload) {
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
