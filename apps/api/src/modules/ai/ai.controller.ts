import {
  Controller, Post, Get, Body, Param, Req, UseGuards,
  HttpCode, HttpStatus, Logger, Res, HttpException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { ChatRequestDto, ChatResponseDto, AnalyzeAssetResponseDto, ClassifyTicketResponseDto, DashboardInsightsResponseDto, PatchPrioritizeResponseDto, ComplianceReviewResponseDto, AiHealthResponseDto } from './dto/chat.dto';

@ApiTags('ai')
@Controller('ai')
@UseGuards(ThrottlerGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private readonly aiService: AiService) {}

  // ─── Health (public, no auth) ─────────────────────────────

  @Get('health')
  @SkipThrottle()
  @ApiOperation({ summary: 'Check AI engine health and availability' })
  @ApiResponse({ status: 200, type: AiHealthResponseDto })
  async getHealth() {
    return this.aiService.getHealth();
  }

  // ─── Chat ─────────────────────────────────────────────────

  @Post('chat')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI Copilot' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  async chat(@Body() dto: ChatRequestDto, @Req() req: any): Promise<ChatResponseDto> {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.id || req.user?.sub;

    if (!tenantId) {
      throw new HttpException('Tenant context required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.aiService.chat(tenantId, userId, dto.message, dto.history);
    } catch (err: any) {
      this.logger.error(`Chat error: ${err.message}`);
      throw new HttpException(
        { response: 'AI service temporarily unavailable.', toolsUsed: [] },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ─── Chat Stream (SSE) ───────────────────────────────────

  @Post('chat/stream')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stream a chat response via Server-Sent Events' })
  async chatStream(@Body() dto: ChatRequestDto, @Req() req: any, @Res() res: Response) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.id || req.user?.sub;

    if (!tenantId) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'Tenant context required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.aiService.chatStream(tenantId, userId, dto.message, dto.history);
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (err: any) {
      this.logger.error(`Stream error: ${err.message}`);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }

  // ─── Analyze Asset ────────────────────────────────────────

  @Post('analyze/asset/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deep AI-powered security analysis for an asset' })
  @ApiResponse({ status: 200, type: AnalyzeAssetResponseDto })
  async analyzeAsset(@Param('id') assetId: string, @Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.id || req.user?.sub;
    if (!tenantId) throw new HttpException('Tenant context required', HttpStatus.BAD_REQUEST);

    return this.aiService.analyzeAsset(tenantId, assetId, userId);
  }

  // ─── Classify Ticket ──────────────────────────────────────

  @Post('analyze/ticket/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI-powered ticket classification and resolution suggestion' })
  @ApiResponse({ status: 200, type: ClassifyTicketResponseDto })
  async classifyTicket(@Param('id') ticketId: string, @Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) throw new HttpException('Tenant context required', HttpStatus.BAD_REQUEST);

    return this.aiService.classifyTicket(tenantId, ticketId);
  }

  // ─── Dashboard Insights ───────────────────────────────────

  @Get('insights/dashboard')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Get AI-generated dashboard insights' })
  @ApiResponse({ status: 200, type: DashboardInsightsResponseDto })
  async getDashboardInsights(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) throw new HttpException('Tenant context required', HttpStatus.BAD_REQUEST);

    return this.aiService.getDashboardInsights(tenantId);
  }

  // ─── Patch Prioritization ─────────────────────────────────

  @Post('patches/prioritize')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI-powered patch deployment prioritization' })
  @ApiResponse({ status: 200, type: PatchPrioritizeResponseDto })
  async prioritizePatches(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) throw new HttpException('Tenant context required', HttpStatus.BAD_REQUEST);

    return this.aiService.prioritizePatches(tenantId);
  }

  // ─── Compliance Review ────────────────────────────────────

  @Post('compliance/review')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI-powered compliance gap analysis' })
  @ApiResponse({ status: 200, type: ComplianceReviewResponseDto })
  async reviewCompliance(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) throw new HttpException('Tenant context required', HttpStatus.BAD_REQUEST);

    return this.aiService.reviewCompliance(tenantId);
  }
}
