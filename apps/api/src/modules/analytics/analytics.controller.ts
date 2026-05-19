import { Controller, Post, Body, Req, HttpCode, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  /**
   * Public endpoint — receive analytics events (page views, etc.)
   * Only processes events from users who consented on the frontend.
   */
  @Post('event')
  @HttpCode(200)
  @ApiOperation({ summary: 'Record analytics event (public, consent-gated on frontend)' })
  recordEvent(@Body() body: any, @Req() req: any) {
    this.service.record(body, req.ip || req.headers['x-forwarded-for']);
    return { ok: true };
  }

  /**
   * Public endpoint — record cookie consent choice for compliance
   */
  @Post('consent')
  @HttpCode(200)
  @ApiOperation({ summary: 'Record cookie consent choice' })
  recordConsent(@Body() body: { analytics: boolean; version: string }, @Req() req: any) {
    this.service.recordConsent(body, req.ip || req.headers['x-forwarded-for']);
    return { ok: true };
  }

  /**
   * Admin-only — get analytics summary
   */
  @Get('summary')
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analytics summary (admin only)' })
  getSummary(@Query('days') days?: number) {
    return this.service.getSummary(days ? parseInt(String(days)) : 30);
  }
}
