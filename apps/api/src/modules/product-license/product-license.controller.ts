import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductLicenseService } from './product-license.service';
import { isOnPrem } from '../../common/deployment-mode';
import type { Response } from 'express';

@ApiTags('product-licenses')
@Controller('product-licenses')
export class ProductLicenseController {
  constructor(private service: ProductLicenseService) {}

  // ─── Public ─────────────────────────────────────────────────
  @Post('activate')
  @ApiOperation({ summary: 'Activate a product license key (public; for on-prem installs)' })
  activate(@Body() body: { licenseKey: string; fingerprint: string; installId?: string }) {
    return this.service.activateOnline(body);
  }

  @Get('deployment')
  @ApiOperation({ summary: 'Deployment mode / signup flags (public)' })
  deployment() {
    return this.service.getDeploymentInfo();
  }

  // ─── Instance (on-prem) — before :id routes ─────────────────
  @Get('instance/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'IT Admin', 'Platform Owner')
  @ApiOperation({ summary: 'Current product entitlement status' })
  status() {
    return this.service.getEffectiveEntitlement();
  }

  @Post('instance/upload')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiOperation({ summary: 'Upload offline .lic / signed blob (on-prem)' })
  upload(@Body() body: { licenseFile?: string; licenseBlob?: string; content?: string }) {
    if (!isOnPrem()) {
      throw new BadRequestException('Offline license upload is only for on-prem deployments');
    }
    const raw = body.content || body.licenseBlob || body.licenseFile;
    if (!raw) throw new BadRequestException('licenseFile or licenseBlob required');
    return this.service.applySignedLicense(raw);
  }

  @Post('instance/activate-key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiOperation({ summary: 'Activate license key via LICENSE_SERVER_URL (on-prem)' })
  activateKey(@Body() body: { licenseKey: string }) {
    if (!isOnPrem()) {
      throw new BadRequestException('Online key activation is only for on-prem deployments');
    }
    if (!body?.licenseKey) throw new BadRequestException('licenseKey required');
    return this.service.activateFromLicenseServer(body.licenseKey);
  }

  // ─── SuperAdmin ─────────────────────────────────────────────
  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  @ApiOperation({ summary: 'List product licenses' })
  list(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listLicenses({ limit, offset, search, status });
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  @ApiOperation({ summary: 'Issue a new product license' })
  issue(@Request() req: any, @Body() body: any) {
    return this.service.issueLicense({ ...body, createdBy: req.user?.sub || req.user?.userId });
  }

  @Get(':id/download')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  @ApiOperation({ summary: 'Download offline .lic file' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const file = await this.service.downloadLicense(id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.body);
  }

  @Post(':id/revoke')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  @ApiOperation({ summary: 'Revoke a product license' })
  revoke(@Param('id') id: string) {
    return this.service.revokeLicense(id);
  }

  @Patch(':id/renew')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  @ApiOperation({ summary: 'Renew / extend expiry' })
  renew(@Param('id') id: string, @Body() body: { expiresAt: string }) {
    return this.service.renewLicense(id, body.expiresAt);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  @ApiOperation({ summary: 'Get product license detail + signed file' })
  get(@Param('id') id: string) {
    return this.service.getLicense(id);
  }
}
