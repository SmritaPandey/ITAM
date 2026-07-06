import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RiskService } from './risk.service';

@ApiTags('risk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risk')
export class RiskController {
  constructor(private riskService: RiskService) {}

  @Get('top-risks')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get highest risk assets across the organization' })
  async getTopRisks(@Request() req: any, @Query('limit') limit = 10) {
    return this.riskService.getTopRisks(req.user.tenantId, Number(limit));
  }

  @Get('asset/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get detailed risk analysis for a specific asset' })
  async getAssetRisk(@Request() req: any, @Param('id') id: string) {
    return this.riskService.calculateAssetRisk(id, req.user.tenantId);
  }
}
