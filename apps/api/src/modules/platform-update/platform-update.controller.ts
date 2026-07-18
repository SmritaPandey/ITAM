import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PlatformUpdateService } from './platform-update.service';

@ApiTags('platform-updates')
@Controller('platform/updates')
export class PlatformUpdateController {
  constructor(private readonly service: PlatformUpdateService) {}

  @Get('owner-status')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  @ApiOperation({ summary: 'Owner console: platform/agent update channel readiness (SaaS + on-prem)' })
  ownerStatus() {
    return this.service.ownerStatus();
  }

  @Get('latest')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'Platform Owner', 'IT Admin')
  @ApiOperation({ summary: 'Get the latest signed on-prem platform release manifest' })
  latest() {
    return this.service.latest();
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'Platform Owner', 'IT Admin')
  @ApiOperation({ summary: 'Get on-prem platform update readiness and signature status' })
  status() {
    return this.service.status();
  }
}
