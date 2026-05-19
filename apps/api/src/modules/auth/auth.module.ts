import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailVerificationService } from './email-verification.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MicrosoftOAuthStrategy } from './strategies/microsoft.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'assetcommand-fallback-jwt-secret',
        signOptions: { expiresIn: (configService.get<string>('JWT_EXPIRATION') || '15m') as any },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    JwtStrategy,
    LocalStrategy,
    // OAuth strategies — they gracefully handle missing env vars
    GoogleStrategy,
    MicrosoftOAuthStrategy,
  ],
  exports: [AuthService, EmailVerificationService],
})
export class AuthModule {}
