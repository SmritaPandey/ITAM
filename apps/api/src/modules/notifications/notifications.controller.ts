import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { NotificationChannelsService } from './notification-channels.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private service: NotificationsService,
    private channels: NotificationChannelsService,
  ) {}

  @Get()
  @Roles('*')
  @ApiOperation({ summary: 'Get user notifications' })
  async findAll(@Request() req: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.findAll(req.user.sub, page, limit);
  }

  @Get('unread')
  @Roles('*')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Request() req: any) {
    return this.service.getUnreadCount(req.user.sub);
  }

  @Patch(':id/read')
  @Roles('*')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    return this.service.markAsRead(id, req.user.sub);
  }

  @Post('read-all')
  @Roles('*')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Request() req: any) {
    return this.service.markAllRead(req.user.sub);
  }

  @Delete(':id')
  @Roles('*')
  @ApiOperation({ summary: 'Delete a notification' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.service.delete(id, req.user.sub);
  }

  // ─── NOTIFICATION CHANNELS ─────────────────────────────────────────
  @Get('channels')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'List notification channels (Slack, Teams, Webhook, Email)' })
  listChannels(@Request() req: any) { return this.channels.list(req.user.tenantId); }

  @Post('channels')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create notification channel' })
  createChannel(@Request() req: any, @Body() body: any) { return this.channels.create(req.user.tenantId, body); }

  @Patch('channels/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update notification channel' })
  updateChannel(@Param('id') id: string, @Request() req: any, @Body() body: any) { return this.channels.update(id, req.user.tenantId, body); }

  @Delete('channels/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete notification channel' })
  deleteChannel(@Param('id') id: string, @Request() req: any) { return this.channels.delete(id, req.user.tenantId); }

  @Post('channels/:id/test')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Send test notification to channel' })
  testChannel(@Param('id') id: string, @Request() req: any) { return this.channels.test(id, req.user.tenantId); }
}
