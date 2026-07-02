import { Controller, Post, Get, UseGuards, Request, Body, HttpCode, HttpStatus, Query, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard, MicrosoftAuthGuard } from './guards/oauth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly appUrl: string;
  private readonly googleEnabled: boolean;
  private readonly microsoftEnabled: boolean;

  constructor(
    private authService: AuthService,
    private emailVerification: EmailVerificationService,
    private configService: ConfigService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL') || 'https://qsasset.vercel.app';
    this.googleEnabled = !!(this.configService.get<string>('GOOGLE_CLIENT_ID') && this.configService.get<string>('GOOGLE_CLIENT_SECRET'));
    this.microsoftEnabled = !!(this.configService.get<string>('MICROSOFT_CLIENT_ID') && this.configService.get<string>('MICROSOFT_CLIENT_SECRET'));

    if (this.googleEnabled) this.logger.log('Google OAuth enabled');
    if (this.microsoftEnabled) this.logger.log('Microsoft OAuth enabled');
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  async login(@Request() req: any) {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(req.user, ip, userAgent);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and revoke refresh tokens' })
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.sub);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() body: { refreshToken: string }, @Request() req: any) {
    return this.authService.refreshToken(body.refreshToken, req.ip, req.headers['user-agent']);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @Post('register')
  @Throttle({ long: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Self-service tenant registration (public)' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() body: RegisterDto) {
    return this.authService.registerTenant(body);
  }

  // ─── Email Verification ──────────────────────────────────────────

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address with token (public)' })
  async verifyEmail(@Query('token') token: string) {
    return this.emailVerification.verifyToken(token);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email (public)' })
  async resendVerification(@Body() body: { email: string }) {
    return this.emailVerification.resendVerification(body.email);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate password reset (public)' })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete password reset (public)' })
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body);
  }

  // ─── OAuth Providers Status ────────────────────────────────────

  @Get('providers')
  @ApiOperation({ summary: 'Get available OAuth providers' })
  getProviders() {
    return {
      google: this.googleEnabled,
      microsoft: this.microsoftEnabled,
      email: true,
    };
  }

  // ─── Google OAuth ──────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Request() req: any, @Res() res: express.Response) {
    try {
      if (!req.user) {
        return res.redirect(`${this.appUrl}/login?error=google_auth_failed`);
      }
      const result = await this.authService.oauthLogin(req.user);
      const params = new URLSearchParams({
        token: result.accessToken,
        refresh: result.refreshToken,
        new: result.isNewUser ? '1' : '0',
      });
      return res.redirect(`${this.appUrl}/auth/callback?${params.toString()}`);
    } catch (err: any) {
      this.logger.error(`Google OAuth error: ${err.message}`);
      return res.redirect(`${this.appUrl}/login?error=${encodeURIComponent(err.message)}`);
    }
  }

  // ─── Microsoft OAuth ───────────────────────────────────────────

  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  @ApiOperation({ summary: 'Initiate Microsoft OAuth login' })
  async microsoftAuth() {
    // Guard redirects to Microsoft
  }

  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  @ApiOperation({ summary: 'Microsoft OAuth callback' })
  async microsoftCallback(@Request() req: any, @Res() res: express.Response) {
    try {
      if (!req.user) {
        return res.redirect(`${this.appUrl}/login?error=microsoft_auth_failed`);
      }
      const result = await this.authService.oauthLogin(req.user);
      const params = new URLSearchParams({
        token: result.accessToken,
        refresh: result.refreshToken,
        new: result.isNewUser ? '1' : '0',
      });
      return res.redirect(`${this.appUrl}/auth/callback?${params.toString()}`);
    } catch (err: any) {
      this.logger.error(`Microsoft OAuth error: ${err.message}`);
      return res.redirect(`${this.appUrl}/login?error=${encodeURIComponent(err.message)}`);
    }
  }
}
