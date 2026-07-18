import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformUpdateService } from './platform-update.service';

@ApiTags('platform-updates')
@Controller('platform/updates')
export class PlatformUpdateController {
  constructor(private readonly service: PlatformUpdateService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get the latest signed on-prem platform release manifest' })
  latest() {
    return this.service.latest();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get on-prem platform update readiness and signature status' })
  status() {
    return this.service.status();
  }
}
