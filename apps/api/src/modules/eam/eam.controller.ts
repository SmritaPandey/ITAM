import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EamService } from './eam.service';

@ApiTags('eam')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('eam')
export class EamController {
  constructor(private service: EamService) {}

  // ─── Facility dashboard ────────────────────────────────────────────

  @Get('facility/dashboard')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Facility manager dashboard stats' })
  facilityDashboard(@Request() req: any) {
    return this.service.getFacilityDashboard(req.user.tenantId);
  }

  @Get('facility/sites')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'List sites (with floor plan URLs)' })
  listSites(@Request() req: any) {
    return this.service.listFacilitySites(req.user.tenantId);
  }

  @Get('facility/sites/:siteId/floor-plan')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get site floor plan and asset pins' })
  getFloorPlan(@Request() req: any, @Param('siteId') siteId: string) {
    return this.service.getSiteFloorPlan(siteId, req.user.tenantId);
  }

  @Patch('facility/sites/:siteId/floor-plan')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update site floor plan URL' })
  updateFloorPlan(
    @Request() req: any,
    @Param('siteId') siteId: string,
    @Body() body: { floorPlanUrl: string | null },
  ) {
    return this.service.updateSiteFloorPlan(siteId, req.user.tenantId, body.floorPlanUrl ?? null);
  }

  @Patch('facility/assets/:assetId/pin')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Update asset floor-plan pin coordinates' })
  updatePin(
    @Request() req: any,
    @Param('assetId') assetId: string,
    @Body()
    body: {
      floorPinX?: number | null;
      floorPinY?: number | null;
      siteId?: string;
      floor?: string;
      room?: string;
    },
  ) {
    return this.service.updateAssetFloorPin(assetId, req.user.tenantId, body);
  }

  // ─── Maintenance schedules ─────────────────────────────────────────

  @Get('maintenance')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'List maintenance schedules' })
  listSchedules(
    @Request() req: any,
    @Query('assetId') assetId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.listSchedules(req.user.tenantId, {
      assetId,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get('maintenance/:id')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get maintenance schedule' })
  getSchedule(@Request() req: any, @Param('id') id: string) {
    return this.service.getSchedule(id, req.user.tenantId);
  }

  @Post('maintenance')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create maintenance schedule' })
  createSchedule(@Request() req: any, @Body() body: any) {
    return this.service.createSchedule(req.user.tenantId, body);
  }

  @Patch('maintenance/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update maintenance schedule' })
  updateSchedule(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateSchedule(id, req.user.tenantId, body);
  }

  @Delete('maintenance/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete maintenance schedule' })
  deleteSchedule(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteSchedule(id, req.user.tenantId);
  }

  @Post('maintenance/process-due')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Manually process due PM schedules (create WOs)' })
  processDue(@Request() req: any) {
    return this.service.createWorkOrdersForDueSchedules(req.user.tenantId);
  }

  @Get('work-orders')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'List maintenance work orders' })
  listWorkOrders(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('assetId') assetId?: string,
  ) {
    return this.service.listWorkOrders(req.user.tenantId, { status, assetId });
  }

  @Patch('work-orders/:id')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Update maintenance work order status' })
  updateWorkOrder(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateWorkOrder(id, req.user.tenantId, body);
  }

  // ─── Spare parts ───────────────────────────────────────────────────

  @Get('spare-parts')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'List spare parts' })
  listSpares(@Request() req: any) {
    return this.service.listSpareParts(req.user.tenantId);
  }

  @Get('spare-parts/:id')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get spare part with recent transactions' })
  getSpare(@Request() req: any, @Param('id') id: string) {
    return this.service.getSparePart(id, req.user.tenantId);
  }

  @Post('spare-parts')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create spare part' })
  createSpare(@Request() req: any, @Body() body: any) {
    return this.service.createSparePart(req.user.tenantId, body);
  }

  @Patch('spare-parts/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update spare part' })
  updateSpare(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateSparePart(id, req.user.tenantId, body);
  }

  @Delete('spare-parts/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete spare part' })
  deleteSpare(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteSparePart(id, req.user.tenantId);
  }

  @Post('spare-parts/:id/receive')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Receive spare part stock' })
  receiveSpare(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { quantity: number; notes?: string; workOrderId?: string },
  ) {
    return this.service.receiveSparePart(id, req.user.tenantId, body);
  }

  @Post('spare-parts/:id/consume')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Consume spare part stock' })
  consumeSpare(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { quantity: number; notes?: string; workOrderId?: string },
  ) {
    return this.service.consumeSparePart(id, req.user.tenantId, body);
  }

  // ─── Consumables ───────────────────────────────────────────────────

  @Get('consumables')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'List consumables' })
  listConsumables(@Request() req: any) {
    return this.service.listConsumables(req.user.tenantId);
  }

  @Get('consumables/:id')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get consumable' })
  getConsumable(@Request() req: any, @Param('id') id: string) {
    return this.service.getConsumable(id, req.user.tenantId);
  }

  @Post('consumables')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create consumable' })
  createConsumable(@Request() req: any, @Body() body: any) {
    return this.service.createConsumable(req.user.tenantId, body);
  }

  @Patch('consumables/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update consumable' })
  updateConsumable(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateConsumable(id, req.user.tenantId, body);
  }

  @Post('consumables/:id/adjust')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Adjust consumable quantity (triggers reorder alert if below point)' })
  adjustConsumable(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { delta: number; notes?: string },
  ) {
    return this.service.adjustConsumable(id, req.user.tenantId, body);
  }

  @Delete('consumables/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete consumable' })
  deleteConsumable(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteConsumable(id, req.user.tenantId);
  }
}
