import { Controller, Post, Get, UseGuards, Request, Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private emailVerification: EmailVerificationService,
  ) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
}
