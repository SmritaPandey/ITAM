import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'List all users in tenant (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Request() req: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.findAll(req.user.tenantId, page, limit);
  }

  @Get('me')
  @Roles('*')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: any) {
    return this.usersService.findById(req.user.sub, req.user.tenantId);
  }

  @Get('me/assets')
  @Roles('*')
  @ApiOperation({ summary: 'Get assets assigned to current user' })
  async getMyAssets(@Request() req: any) {
    return this.usersService.getMyAssets(req.user.sub, req.user.tenantId);
  }

  @Get('me/tickets')
  @Roles('*')
  @ApiOperation({ summary: 'Get tickets created by current user' })
  async getMyTickets(@Request() req: any) {
    return this.usersService.getMyTickets(req.user.sub, req.user.tenantId);
  }

  @Get('me/dashboard')
  @Roles('*')
  @ApiOperation({ summary: 'Get employee self-service dashboard stats' })
  async getMyDashboard(@Request() req: any) {
    return this.usersService.getMyDashboard(req.user.sub, req.user.tenantId);
  }

  @Get('roles')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'List available roles' })
  async getRoles(@Request() req: any) {
    return this.usersService.getRoles(req.user.tenantId);
  }

  @Get('departments')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'List departments' })
  async getDepartments(@Request() req: any) {
    return this.usersService.getDepartments(req.user.tenantId);
  }

  @Get(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.usersService.findById(id, req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Request() req: any, @Body() body: CreateUserDto) {
    return this.usersService.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update user' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, req.user.tenantId, body);
  }

  @Post(':id/toggle-status')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Activate/deactivate user' })
  async toggleStatus(@Request() req: any, @Param('id') id: string) {
    return this.usersService.toggleStatus(id, req.user.tenantId);
  }

  @Post(':id/change-role')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Change user role' })
  async changeRole(@Request() req: any, @Param('id') id: string, @Body() body: { roleId: string }) {
    return this.usersService.changeRole(id, req.user.tenantId, body.roleId);
  }

  @Post(':id/change-password')
  @Roles('Tenant Admin', '*')
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(@Request() req: any, @Param('id') id: string, @Body() body: { newPassword: string; oldPassword?: string }) {
    return this.usersService.changePassword(id, req.user.tenantId, body.newPassword, body.oldPassword, req.user.role);
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Soft-delete user' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.usersService.softDelete(id, req.user.tenantId);
  }
}
