import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Initialize system with first tenant and admin user' })
  async initialize(@Body() body: {
    organizationName: string;
    adminEmail: string;
    adminPassword: string;
    adminName: string;
    timezone?: string;
    industry?: string;
  }) {
    return this.setupService.initialize(body);
  }
}
