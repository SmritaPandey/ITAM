import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailVerificationService } from './email-verification.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';

// Dynamic OAuth providers — only register if env vars are set
const oauthProviders: any[] = [];

function tryRegisterOAuth() {
  const logger = new Logger('AuthModule');

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleStrategy } = require('./strategies/google.strategy');
    oauthProviders.push(GoogleStrategy);
    logger.log('Google OAuth strategy registered');
  }

  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MicrosoftOAuthStrategy } = require('./strategies/microsoft.strategy');
    oauthProviders.push(MicrosoftOAuthStrategy);
    logger.log('Microsoft OAuth strategy registered');
  }
}

tryRegisterOAuth();

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('AuthModule');
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          if (process.env.NODE_ENV === 'production') {
            logger.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start in production with an insecure fallback.');
            process.exit(1);
          }
          logger.warn('⚠️  WARNING: JWT_SECRET is not set — using insecure fallback. DO NOT run this configuration in production!');
        }
        const rawExpiry = configService.get<string>('JWT_EXPIRATION') || '4h';
        // Ensure minimum 1h expiry for production stability (15m or 900s causes constant 401s)
        const isShortExpiry = (val: string): boolean => {
          const str = val.trim().toLowerCase();
          if (/^\d+$/.test(str)) {
            return parseInt(str, 10) < 3600;
          }
          const match = str.match(/^(\d+)\s*(s|m|h|d|w|y|min|minute|minutes|sec|second|seconds)?$/);
          if (!match) return false;
          const num = parseInt(match[1], 10);
          const unit = match[2];
          if (!unit) return num < 3600;
          if (unit.startsWith('s')) return num < 3600;
          if (unit.startsWith('m')) return num < 60;
          return false;
        };
        const expiresIn = isShortExpiry(rawExpiry) ? '4h' : rawExpiry;
        return {
          secret: secret || 'assetcommand-fallback-jwt-secret',
          signOptions: { expiresIn: expiresIn as any },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    JwtStrategy,
    LocalStrategy,
    ...oauthProviders,
  ],
  exports: [AuthService, EmailVerificationService],
})
export class AuthModule {}
