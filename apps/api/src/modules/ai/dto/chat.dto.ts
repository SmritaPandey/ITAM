import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Chat DTOs ───────────────────────────────────────────────────────────────

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'], description: 'Message role' })
  @IsString()
  @IsEnum(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ChatRequestDto {
  @ApiProperty({ description: 'User message to send to the AI assistant' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    type: [ChatMessageDto],
    description: 'Previous conversation history for multi-turn context',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}

// ─── Response DTOs ───────────────────────────────────────────────────────────

export class ChatResponseDto {
  @ApiProperty({ description: 'AI assistant response text' })
  response: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Names of tools invoked during the response',
  })
  toolsUsed?: string[];
}

export class ThreatDto {
  @ApiProperty() threat: string;
  @ApiProperty() severity: string;
  @ApiPropertyOptional() details?: string;
}

export class RecommendationDto {
  @ApiProperty() action: string;
  @ApiProperty() priority: string;
  @ApiPropertyOptional() effort?: string;
  @ApiPropertyOptional() details?: string;
}

export class AnalyzeAssetResponseDto {
  @ApiProperty({ description: 'Numeric risk score 0-100' })
  @IsNumber()
  @Min(0)
  @Max(100)
  riskScore: number;

  @ApiProperty({ enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] })
  riskLevel: string;

  @ApiProperty({ description: 'Detailed risk analysis narrative' })
  analysis: string;

  @ApiProperty({ type: [RecommendationDto] })
  recommendations: RecommendationDto[];

  @ApiProperty({ type: [ThreatDto] })
  threats: ThreatDto[];
}

export class SimilarTicketDto {
  @ApiProperty() ticketNumber: string;
  @ApiProperty() subject: string;
  @ApiPropertyOptional() resolution?: string;
}

export class ClassifyTicketResponseDto {
  @ApiProperty({ description: 'Determined ticket classification' })
  classification: string;

  @ApiProperty({ enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] })
  suggestedPriority: string;

  @ApiProperty({ description: 'Suggested category' })
  suggestedCategory: string;

  @ApiPropertyOptional({ description: 'Suggested sub-category' })
  suggestedSubCategory?: string;

  @ApiProperty({ description: 'Suggested resolution steps' })
  resolution: string;

  @ApiProperty({ type: [SimilarTicketDto] })
  similarTickets: SimilarTicketDto[];
}

export class DashboardInsightDto {
  @ApiProperty({ description: 'Insight title' })
  title: string;

  @ApiProperty({ description: 'Detailed insight description' })
  description: string;

  @ApiProperty({ enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] })
  severity: string;

  @ApiProperty({ description: 'Recommended action to take' })
  action: string;
}

export class DashboardInsightsResponseDto {
  @ApiProperty({ type: [DashboardInsightDto] })
  insights: DashboardInsightDto[];
}

export class PatchPriorityItemDto {
  @ApiProperty() patch: string;
  @ApiProperty() priority: string;
  @ApiProperty() affectedAssets: number;
  @ApiProperty() risk: string;
  @ApiProperty() recommendation: string;
}

export class PatchPrioritizeResponseDto {
  @ApiProperty({ type: [PatchPriorityItemDto] })
  plan: PatchPriorityItemDto[];
}

export class ComplianceGapDto {
  @ApiProperty() control: string;
  @ApiProperty() framework: string;
  @ApiProperty() severity: string;
  @ApiProperty() finding: string;
  @ApiProperty() remediation: string;
}

export class ComplianceReviewResponseDto {
  @ApiProperty({ description: 'Overall compliance score percentage' })
  overallScore: number;

  @ApiProperty({ type: [ComplianceGapDto] })
  gaps: ComplianceGapDto[];

  @ApiProperty({ type: [RecommendationDto] })
  recommendations: RecommendationDto[];

  @ApiPropertyOptional({
    description: 'Per-framework compliance breakdown',
  })
  frameworks?: Record<string, number>;
}

export class AiHealthResponseDto {
  @ApiProperty({ description: 'Whether the AI engine is reachable' })
  available: boolean;

  @ApiPropertyOptional({ description: 'Active model name' })
  model?: string;

  @ApiPropertyOptional({ description: 'Round-trip latency in milliseconds' })
  latency?: number;

  @ApiPropertyOptional({ description: 'AI provider backend' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Human-readable status message' })
  message?: string;
}
