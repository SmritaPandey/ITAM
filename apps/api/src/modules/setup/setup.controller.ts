import { Controller, Get, Post, Body, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SetupService } from './setup.service';

@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check if system has been initialized' })
  async getStatus() {
    return this.setupService.getStatus();
  }

  @Post('initialize')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Initialize system with first tenant and admin user' })
  async initialize(@Body() body: {
    organizationName: string;
    adminEmail: string;
    adminPassword: string;
    adminName: string;
    timezone?: string;
    industry?: string;
  }) {
    const status = await this.setupService.getStatus();
    if (status.initialized) {
      throw new ForbiddenException('System is already initialized');
    }
    return this.setupService.initialize(body);
  }
}
