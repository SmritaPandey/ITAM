import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChangesService, SSDLC_GATE_KEYS } from './changes.service';
import { CreateChangeDto, CreateCabMeetingDto, DecideApprovalDto } from './dto/create-change.dto';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('changes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('CHANGES')
@Controller('changes')
export class ChangesController {
  constructor(private service: ChangesService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List change requests' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  list(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.service.list(req.user.tenantId, status, page, limit);
  }

  @Get('stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Change management stats' })
  stats(@Request() req: any) {
    return this.service.getStats(req.user.tenantId);
  }

  @Get('calendar')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Change calendar (scheduled changes)' })
  calendar(@Request() req: any) {
    return this.service.getCalendar(req.user.tenantId);
  }

  @Get('ssdlc-gates')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'SSDLC 9-step checklist field keys' })
  ssdlcGatesMeta() {
    return {
      gates: SSDLC_GATE_KEYS.map((k, i) => ({
        key: k,
        step: i + 1,
        label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      })),
    };
  }

  // ─── CAB Meetings (static routes before :id) ─────────────────

  @Get('cab/meetings')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List CAB meetings (calendar)' })
  listCab(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listCabMeetings(req.user.tenantId, from, to);
  }

  @Get('cab/meetings/:meetingId')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get CAB meeting with agenda changes' })
  getCab(@Param('meetingId') meetingId: string, @Request() req: any) {
    return this.service.getCabMeeting(meetingId, req.user.tenantId);
  }

  @Post('cab/meetings')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create CAB meeting' })
  createCab(@Request() req: any, @Body() body: CreateCabMeetingDto) {
    return this.service.createCabMeeting(req.user.tenantId, body);
  }

  @Patch('cab/meetings/:meetingId')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update CAB meeting' })
  updateCab(@Param('meetingId') meetingId: string, @Request() req: any, @Body() body: any) {
    return this.service.updateCabMeeting(meetingId, req.user.tenantId, body);
  }

  @Delete('cab/meetings/:meetingId')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete CAB meeting' })
  deleteCab(@Param('meetingId') meetingId: string, @Request() req: any) {
    return this.service.deleteCabMeeting(meetingId, req.user.tenantId);
  }

  @Post('cab/meetings/:meetingId/agenda')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Attach change request IDs to CAB agenda' })
  attachAgenda(
    @Param('meetingId') meetingId: string,
    @Request() req: any,
    @Body() body: { changeIds: string[] },
  ) {
    return this.service.attachChangesToCab(meetingId, req.user.tenantId, body.changeIds || []);
  }

  // ─── Change CRUD ─────────────────────────────────────────────

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get change request detail' })
  detail(@Param('id') id: string, @Request() req: any) {
    return this.service.getById(id, req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create change request' })
  create(@Request() req: any, @Body() body: CreateChangeDto) {
    return this.service.create(req.user.tenantId, req.user.sub, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update change request' })
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.service.update(id, req.user.tenantId, body);
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete change request' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.delete(id, req.user.tenantId);
  }

  @Post(':id/submit')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Submit change for approval (creates pending ChangeApprovals)' })
  submit(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { approvalLevels?: { level: number; approverId: string }[]; requireCab?: boolean },
  ) {
    return this.service.submit(id, req.user.tenantId, req.user.sub, body);
  }

  @Post(':id/approve')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Approve at current approval level' })
  approve(@Param('id') id: string, @Request() req: any, @Body() body: DecideApprovalDto) {
    return this.service.decideApproval(id, req.user.tenantId, req.user.sub, 'APPROVED', body?.comment);
  }

  @Post(':id/reject')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Reject change at current approval level' })
  reject(@Param('id') id: string, @Request() req: any, @Body() body: DecideApprovalDto) {
    return this.service.decideApproval(id, req.user.tenantId, req.user.sub, 'REJECTED', body?.comment);
  }

  @Patch(':id/ssdlc')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update SSDLC 9-step gates + UAT/VAPT evidence/attachments' })
  updateSsdlc(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    body: {
      ssdlcGates?: Record<string, any>;
      uatEvidence?: string;
      vaptEvidence?: string;
      uatAttachments?: string[];
      vaptAttachments?: string[];
    },
  ) {
    return this.service.updateSsdlcGates(id, req.user.tenantId, body);
  }

  @Post(':id/status')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Transition change request status (approve/implement/rollback)' })
  transition(@Param('id') id: string, @Request() req: any, @Body() body: { status: string; notes?: string }) {
    return this.service.transition(id, req.user.tenantId, req.user.sub, body.status, body.notes);
  }
}
