import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings/pricing')
export class PricingController {
  constructor(private service: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get active system pricing configuration' })
  async getPricingSettings() {
    return this.service.getPricingSettings();
  }
}
