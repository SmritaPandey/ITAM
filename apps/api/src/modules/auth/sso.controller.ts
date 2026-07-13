import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { SsoService } from './sso.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@ApiTags('auth')
@Controller('auth/sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);
  private readonly appUrl: string;

  constructor(
    private ssoService: SsoService,
    private configService: ConfigService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3100';
  }

  @Get('providers')
  @ApiOperation({ summary: 'List SSO / OAuth providers for the login page (public)' })
  async providers(@Query('tenant') tenant?: string) {
    return this.ssoService.listPublicProviders(tenant);
  }

  // ─── Admin CRUD ────────────────────────────────────────────────

  @Get('configs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List SSO configs for tenant' })
  async listConfigs(@Request() req: any) {
    return this.ssoService.listConfigs(req.user.tenantId);
  }

  @Post('configs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create SSO config (SAML metadata / OIDC client)' })
  async createConfig(@Request() req: any, @Body() body: any) {
    return this.ssoService.createConfig(req.user.tenantId, body);
  }

  @Patch('configs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update SSO config' })
  async updateConfig(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.ssoService.updateConfig(id, req.user.tenantId, body);
  }

  @Delete('configs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete SSO config' })
  async deleteConfig(@Request() req: any, @Param('id') id: string) {
    return this.ssoService.deleteConfig(id, req.user.tenantId);
  }

  // ─── OIDC flow ─────────────────────────────────────────────────

  @Get('oidc/:id/start')
  @ApiOperation({ summary: 'Start OIDC authorization-code flow' })
  async oidcStart(@Param('id') id: string, @Res() res: express.Response) {
    const { url } = await this.ssoService.buildOidcStartUrl(id);
    return res.redirect(url);
  }

  @Get('oidc/callback')
  @ApiOperation({ summary: 'OIDC authorization-code callback' })
  async oidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: express.Response,
  ) {
    try {
      if (error) {
        return res.redirect(`${this.appUrl}/login?error=${encodeURIComponent(error)}`);
      }
      if (!code || !state) {
        return res.redirect(`${this.appUrl}/login?error=missing_oidc_code`);
      }
      const result = await this.ssoService.handleOidcCallback(code, state);
      const params = new URLSearchParams({
        token: result.accessToken,
        refresh: result.refreshToken,
        new: result.isNewUser ? '1' : '0',
      });
      return res.redirect(`${this.appUrl}/auth/callback?${params.toString()}`);
    } catch (err: any) {
      this.logger.error(`OIDC callback error: ${err.message}`);
      return res.redirect(`${this.appUrl}/login?error=${encodeURIComponent(err.message || 'oidc_failed')}`);
    }
  }

  // ─── SAML (SP-initiated AuthnRequest + ACS) ───────────────────

  @Get('saml/:id/start')
  @ApiOperation({ summary: 'Start SAML SSO — redirects to IdP if ssoUrl configured' })
  async samlStart(@Param('id') id: string, @Res() res: express.Response) {
    const result = await this.ssoService.buildSamlStart(id);
    if (result.url) return res.redirect(result.url);
    return res.status(501).json(result);
  }

  @Post('saml/callback')
  @ApiOperation({ summary: 'SAML Assertion Consumer Service (ACS)' })
  async samlCallback(@Body() body: any, @Res() res: express.Response) {
    try {
      const result = await this.ssoService.handleSamlAcs(body);
      const params = new URLSearchParams({
        token: result.accessToken,
        refresh: result.refreshToken,
        new: result.isNewUser ? '1' : '0',
      });
      return res.redirect(`${this.appUrl}/auth/callback?${params.toString()}`);
    } catch (err: any) {
      this.logger.error(`SAML ACS error: ${err.message}`);
      return res.redirect(`${this.appUrl}/login?error=${encodeURIComponent(err.message || 'saml_failed')}`);
    }
  }
}
