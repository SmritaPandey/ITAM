import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmailIngestService } from './email-ingest.service';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets/email-ingest')
export class EmailIngestController {
  constructor(private service: EmailIngestService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List email ingest configs' })
  list(@Request() req: any) {
    return this.service.list(req.user.tenantId);
  }

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get email ingest config' })
  get(@Param('id') id: string, @Request() req: any) {
    return this.service.get(id, req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create email ingest (IMAP) config' })
  create(
    @Request() req: any,
    @Body()
    body: {
      host: string;
      port?: number;
      username: string;
      password: string;
      folder?: string;
      enabled?: boolean;
    },
  ) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update email ingest config' })
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.service.update(id, req.user.tenantId, body);
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete email ingest config' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.delete(id, req.user.tenantId);
  }

  @Post(':id/poll')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Poll mailbox now and create tickets from unread mail' })
  poll(@Param('id') id: string, @Request() req: any) {
    return this.service.pollNow(id, req.user.tenantId);
  }
}
