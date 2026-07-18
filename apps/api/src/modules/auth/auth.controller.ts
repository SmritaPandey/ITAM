import { Controller, Post, Get, UseGuards, Request, Body, HttpCode, HttpStatus, Query, Res, Logger, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { MfaService } from './mfa.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard, MicrosoftAuthGuard } from './guards/oauth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { clearAuthCookies, setAuthCookies, REFRESH_COOKIE } from './auth-cookies';

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
    private mfaService: MfaService,
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
  @ApiOperation({ summary: 'Login with email and password (may return mfaRequired)' })
  @ApiBody({ type: LoginDto })
  async login(@Request() req: any, @Res({ passthrough: true }) res: express.Response) {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const challenge = await this.mfaService.beginChallenge(req.user);
    if (challenge.mfaRequired) {
      if ((challenge as any).mfaEnrollmentRequired) {
        throw new UnauthorizedException(
          (challenge as any).message || 'MFA enrollment is required for this organization',
        );
      }
      return { mfaRequired: true, mfaToken: (challenge as any).mfaToken };
    }
    const tokens = await this.authService.login(req.user, ip, userAgent);
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and revoke refresh tokens' })
  async logout(@Request() req: any, @Res({ passthrough: true }) res: express.Response) {
    await this.authService.logout(req.user.sub);
    clearAuthCookies(res);
  }

  @Post('refresh')
  @Throttle({ long: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(
    @Body() body: { refreshToken?: string },
    @Request() req: any,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken = body.refreshToken || req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new UnauthorizedException('Refresh token required');
    const tokens = await this.authService.refreshToken(refreshToken, req.ip, req.headers['user-agent']);
    setAuthCookies(res, tokens);
    return tokens;
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
  @Throttle({ long: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email (public)' })
  async resendVerification(@Body() body: { email: string }) {
    return this.emailVerification.resendVerification(body.email);
  }

  @Post('forgot-password')
  @Throttle({ long: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate password reset (public)' })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete password reset (public)' })
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body);
  }

  @Post('oauth/exchange')
  @Throttle({ long: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange one-time OAuth code for tokens (public)' })
  async oauthExchange(
    @Body() body: { code: string },
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const tokens = this.authService.consumeOAuthExchangeCode(body.code);
    setAuthCookies(res, tokens);
    return tokens;
  }

  // ─── MFA TOTP ────────────────────────────────────────────────────

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get MFA enrollment status for current user' })
  async mfaStatus(@Request() req: any) {
    return this.mfaService.status(req.user.sub);
  }

  @Post('mfa/enroll')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start TOTP MFA enrollment (returns QR + secret)' })
  async mfaEnroll(@Request() req: any) {
    return this.mfaService.enroll(req.user.sub);
  }

  @Post('mfa/verify-enroll')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm MFA enrollment with first TOTP code' })
  async mfaVerifyEnroll(@Request() req: any, @Body() body: { code: string }) {
    return this.mfaService.verifyEnroll(req.user.sub, body.code);
  }

  @Post('mfa/challenge')
  @Throttle({ long: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login with MFA code after password challenge' })
  async mfaChallenge(
    @Body() body: { mfaToken?: string; mfaChallengeToken?: string; code: string },
    @Request() req: any,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const tokens = await this.mfaService.completeChallenge(
      body.mfaToken || body.mfaChallengeToken || '',
      body.code,
      req.ip || req.connection?.remoteAddress,
      req.headers['user-agent'],
    );
    if (tokens?.accessToken && tokens?.refreshToken) {
      setAuthCookies(res, tokens);
    }
    return tokens;
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA (requires current TOTP code)' })
  async mfaDisable(@Request() req: any, @Body() body: { code: string }) {
    return this.mfaService.disable(req.user.sub, body.code);
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
      const code = this.authService.createOAuthExchangeCode(result, result.isNewUser);
      const params = new URLSearchParams({
        code,
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
      const code = this.authService.createOAuthExchangeCode(result, result.isNewUser);
      const params = new URLSearchParams({
        code,
        new: result.isNewUser ? '1' : '0',
      });
      return res.redirect(`${this.appUrl}/auth/callback?${params.toString()}`);
    } catch (err: any) {
      this.logger.error(`Microsoft OAuth error: ${err.message}`);
      return res.redirect(`${this.appUrl}/login?error=${encodeURIComponent(err.message)}`);
    }
  }
}
