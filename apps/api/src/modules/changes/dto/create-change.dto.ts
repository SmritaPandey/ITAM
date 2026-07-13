import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsObject, ValidateNested, IsInt, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

enum ChangeType {
  STANDARD = 'STANDARD',
  NORMAL = 'NORMAL',
  EMERGENCY = 'EMERGENCY',
  SSDLC = 'SSDLC',
}

enum ChangePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

enum ChangeRisk {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class ApprovalLevelDto {
  @IsInt() level: number;
  @IsUUID() approverId: string;
}

export class CreateChangeDto {
  @IsString() title: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ChangeType) type?: ChangeType;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(ChangePriority) priority?: ChangePriority;
  @IsOptional() @IsEnum(ChangeRisk) risk?: ChangeRisk;
  @IsOptional() @IsString() status?: string;

  @IsOptional() @IsDateString() scheduledStart?: string;
  @IsOptional() @IsDateString() scheduledEnd?: string;

  @IsOptional() @IsString() impactAnalysis?: string;
  @IsOptional() @IsString() rollbackPlan?: string;
  @IsOptional() @IsString() testPlan?: string;

  @IsOptional() @IsObject() ssdlcGates?: Record<string, any>;
  @IsOptional() @IsString() uatEvidence?: string;
  @IsOptional() @IsString() vaptEvidence?: string;

  /** Optional multi-level approvers; if omitted, tenant admins are used. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ApprovalLevelDto)
  approvalLevels?: ApprovalLevelDto[];
}

export class CreateCabMeetingDto {
  @IsString() title: string;
  @IsDateString() scheduledAt: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsArray() agenda?: string[];
  @IsOptional() @IsString() minutes?: string;
  @IsOptional() @IsString() status?: string;
}

export class DecideApprovalDto {
  @IsOptional() @IsString() comment?: string;
}
