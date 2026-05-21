import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings/pricing')
export class PricingController {
  constructor(private service: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get active system pricing configuration' })
  async getPricingSettings() {
    return this.service.getPricingSettings();
  }
}
