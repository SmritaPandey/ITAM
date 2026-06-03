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
        return {
          secret: secret || 'assetcommand-fallback-jwt-secret',
          signOptions: { expiresIn: (configService.get<string>('JWT_EXPIRATION') || '4h') as any },
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
