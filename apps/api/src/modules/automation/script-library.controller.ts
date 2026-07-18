import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../common/database/prisma.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

function requiresDualApproval(scriptContent: string, category?: string): boolean {
  if (['DEPLOYMENT', 'MAINTENANCE'].includes(String(category || '').toUpperCase())) return true;
  return /(?:sudo|runas|invoke-expression|\biex\b|reg\s+(?:add|delete)|netsh|iptables|firewall-cmd|systemctl|service\s+\S+\s+(?:stop|disable)|rm\s+-|del\s+\/|format\s+|mkfs|shutdown|reboot|useradd|net\s+user)/i
    .test(scriptContent || '');
}

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
        requiresDualApproval: requiresDualApproval(body.scriptContent, body.category),
      },
    });
  }

  @Post(':id/approve')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Approve a script for execution (security gate)' })
  async approve(@Request() req: any, @Param('id') id: string) {
    const script = await this.prisma.scriptLibrary.findFirstOrThrow({
      where: { id, tenantId: req.user.tenantId },
    });
    if (script.createdById === req.user.sub) {
      throw new ForbiddenException('Script authors cannot approve their own scripts');
    }
    if (script.approvalStatus === 'REJECTED') {
      throw new BadRequestException('Rejected scripts must be edited before approval');
    }
    if (script.requiresDualApproval && script.approvedById) {
      if (script.approvedById === req.user.sub) {
        throw new ForbiddenException('A distinct second approver is required');
      }
      return this.prisma.scriptLibrary.update({
        where: { id },
        data: {
          approvalStatus: 'APPROVED',
          secondApprovedById: req.user.sub,
          secondApprovedAt: new Date(),
        },
      });
    }
    return this.prisma.scriptLibrary.update({
      where: { id },
      data: {
        approvalStatus: script.requiresDualApproval ? 'PENDING_SECOND_APPROVAL' : 'APPROVED',
        approvedById: req.user.sub,
        approvedAt: new Date(),
      },
    });
  }

  @Post(':id/reject')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Reject a script' })
  async reject(@Request() req: any, @Param('id') id: string) {
    await this.prisma.scriptLibrary.findFirstOrThrow({
      where: { id, tenantId: req.user.tenantId },
    });
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

    // 1. Verify the target agent exists and is ONLINE
    const agent = await this.prisma.agent.findFirst({
      where: { id: body.agentId, tenantId: req.user.tenantId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent ${body.agentId} not found`);
    }

    const heartbeatThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    if (!agent.lastHeartbeat || agent.lastHeartbeat < heartbeatThreshold) {
      throw new BadRequestException(
        `Agent ${agent.hostname} (${agent.ipAddress}) is offline or unresponsive. ` +
        `Last heartbeat: ${agent.lastHeartbeat?.toISOString() || 'never'}. ` +
        `Cannot dispatch script to an offline agent.`,
      );
    }

    // 2. Create a real ScanResult record repurposed for script execution tracking.
    //    This gives us a persistent, queryable record with a real database ID.
    //    The agent will pick up QUEUED script executions on next heartbeat check-in
    //    via the actions array returned from the heartbeat endpoint.
    const execution = await this.prisma.scanResult.create({
      data: {
        tenantId: req.user.tenantId,
        scanType: 'SCRIPT_EXECUTION',
        targetType: 'HOST',
        target: agent.ipAddress,
        status: 'QUEUED',
        triggeredBy: req.user.sub,
        summary: {
          scriptId: id,
          scriptName: script.name,
          platform: script.platform,
          agentId: body.agentId,
          agentHostname: agent.hostname,
          parameters: body.parameters || {},
          timeoutSeconds: script.timeoutSeconds,
        },
        rawOutput: script.scriptContent,
      },
    });

    // 3. Update run tracking on the script
    await this.prisma.scriptLibrary.update({
      where: { id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });

    return {
      executionId: execution.id,
      scriptId: id,
      scriptName: script.name,
      agentId: body.agentId,
      agentHostname: agent.hostname,
      // Agent will pick up this queued execution on its next heartbeat check-in
      status: 'QUEUED',
      queuedAt: execution.startedAt.toISOString(),
      timeoutSeconds: script.timeoutSeconds,
    };
  }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update script content (resets approval)' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const existing = await this.prisma.scriptLibrary.findFirstOrThrow({
      where: { id, tenantId: req.user.tenantId },
    });
    const allowedUpdate: Record<string, unknown> = {};
    for (const key of ['name', 'description', 'scriptContent', 'platform', 'category', 'timeoutSeconds']) {
      if (body[key] !== undefined) allowedUpdate[key] = body[key];
    }
    const contentChanged = body.scriptContent !== undefined || body.category !== undefined;
    return this.prisma.scriptLibrary.update({
      where: { id },
      data: {
        ...allowedUpdate,
        ...(contentChanged ? {
          approvalStatus: 'PENDING',
          approvedById: null,
          approvedAt: null,
          secondApprovedById: null,
          secondApprovedAt: null,
          requiresDualApproval: requiresDualApproval(
            body.scriptContent ?? existing.scriptContent,
            body.category ?? existing.category,
          ),
        } : {}),
      },
    });
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a script from the library' })
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.prisma.scriptLibrary.findFirstOrThrow({
      where: { id, tenantId: req.user.tenantId },
    });
    await this.prisma.scriptLibrary.delete({ where: { id } });
    return { deleted: true };
  }
}
