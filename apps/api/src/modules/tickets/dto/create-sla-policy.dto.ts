import { IsString, IsOptional, IsEnum, IsInt, IsBoolean, Min } from 'class-validator';

enum SlaPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export class CreateSlaPolicyDto {
  @IsString() name: string;

  @IsEnum(SlaPriority) priority: SlaPriority;

  @IsInt() @Min(1) responseHours: number;
  @IsInt() @Min(1) resolutionHours: number;

  @IsOptional() @IsInt() @Min(1) escalationHours?: number;
  @IsOptional() @IsBoolean() businessHoursOnly?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
