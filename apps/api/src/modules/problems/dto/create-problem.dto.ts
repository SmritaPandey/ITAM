import { IsString, IsOptional, IsEnum } from 'class-validator';

enum ProblemPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

enum ProblemStatus {
  OPEN = 'OPEN',
  ROOT_CAUSE_IDENTIFIED = 'ROOT_CAUSE_IDENTIFIED',
  KNOWN_ERROR = 'KNOWN_ERROR',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export class CreateProblemDto {
  @IsString() title: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ProblemPriority) priority?: ProblemPriority;
  @IsOptional() @IsEnum(ProblemStatus) status?: ProblemStatus;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() rootCause?: string;
  @IsOptional() @IsString() workaround?: string;
  @IsOptional() @IsString() assignedToId?: string;
}
