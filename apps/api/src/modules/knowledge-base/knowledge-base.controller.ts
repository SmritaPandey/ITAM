import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KnowledgeBaseService } from './knowledge-base.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('knowledge-base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('KNOWLEDGE_BASE')
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private kbService: KnowledgeBaseService) {}

  @Get()
  @ApiOperation({ summary: 'Search/list knowledge base articles' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.kbService.findAll(req.user.tenantId, search, category, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single article (increments view count)' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.kbService.findById(id, req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create knowledge base article' })
  async create(@Request() req: any, @Body() body: {
    title: string; content: string; category?: string; tags?: string[]; status?: string;
  }) {
    return this.kbService.create(req.user.tenantId, req.user.sub, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update knowledge base article' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.kbService.update(id, req.user.tenantId, body);
  }

  @Post(':id/helpful')
  @ApiOperation({ summary: 'Mark article as helpful' })
  async markHelpful(@Request() req: any, @Param('id') id: string) {
    return this.kbService.markHelpful(id, req.user.tenantId);
  }

  @Delete(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete knowledge base article' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.kbService.delete(id, req.user.tenantId);
  }
}
