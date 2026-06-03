import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

enum ChangeType {
  STANDARD = 'STANDARD',
  NORMAL = 'NORMAL',
  EMERGENCY = 'EMERGENCY',
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
}
