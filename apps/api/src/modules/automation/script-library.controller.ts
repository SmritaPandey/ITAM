import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../common/database/prisma.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('AUTOMATION')
@Controller('automation/scripts')
export class ScriptLibraryController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List all scripts in the library' })
  async findAll(@Request() req: any) {
    return this.prisma.scriptLibrary.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get script details including content' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.prisma.scriptLibrary.findFirstOrThrow({
      where: { id, tenantId: req.user.tenantId },
    });
  }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a new script (requires admin approval before execution)' })
  async create(@Request() req: any, @Body() body: {
    name: string; description?: string; scriptContent: string;
    platform?: string; category?: string; timeoutSeconds?: number;
  }) {
    return this.prisma.scriptLibrary.create({
      data: {
        tenantId: req.user.tenantId,
        name: body.name,
        description: body.description,
        scriptContent: body.scriptContent,
        platform: body.platform || 'BASH',
        category: body.category || 'REMEDIATION',
        timeoutSeconds: body.timeoutSeconds || 300,
        createdById: req.user.sub,
      },
    });
  }

  @Post(':id/approve')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Approve a script for execution (security gate)' })
  async approve(@Request() req: any, @Param('id') id: string) {
    return this.prisma.scriptLibrary.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: req.user.sub,
        approvedAt: new Date(),
      },
    });
  }

  @Post(':id/reject')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Reject a script' })
  async reject(@Request() req: any, @Param('id') id: string) {
    return this.prisma.scriptLibrary.update({
      where: { id },
      data: { approvalStatus: 'REJECTED' },
    });
  }

  @Post(':id/execute')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Execute an approved script on a target agent' })
  async execute(@Request() req: any, @Param('id') id: string, @Body() body: { agentId: string; parameters?: any }) {
    const script = await this.prisma.scriptLibrary.findFirstOrThrow({
      where: { id, tenantId: req.user.tenantId },
    });

    if (script.approvalStatus !== 'APPROVED') {
      return { error: 'Script must be approved before execution', status: script.approvalStatus };
    }

    // Update run tracking
    await this.prisma.scriptLibrary.update({
      where: { id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });

    // In production, this would dispatch to the agent via WebSocket/SSH
    return {
      executionId: `exec-${Date.now()}`,
      scriptId: id,
      scriptName: script.name,
      agentId: body.agentId,
      status: 'DISPATCHED',
      dispatchedAt: new Date().toISOString(),
      timeoutSeconds: script.timeoutSeconds,
    };
  }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update script content (resets approval)' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.prisma.scriptLibrary.update({
      where: { id },
      data: {
        ...body,
        ...(body.scriptContent ? { approvalStatus: 'PENDING', approvedById: null, approvedAt: null } : {}),
      },
    });
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a script from the library' })
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.prisma.scriptLibrary.delete({ where: { id } });
    return { deleted: true };
  }
}
