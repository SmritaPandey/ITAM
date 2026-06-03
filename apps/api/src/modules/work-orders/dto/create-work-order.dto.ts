import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

enum WorkOrderType {
  MAINTENANCE = 'MAINTENANCE',
  REPAIR = 'REPAIR',
  INSTALLATION = 'INSTALLATION',
  INSPECTION = 'INSPECTION',
}

enum WorkOrderPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class CreateWorkOrderDto {
  @IsString() title: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(WorkOrderType) type?: WorkOrderType;
  @IsOptional() @IsEnum(WorkOrderPriority) priority?: WorkOrderPriority;
  @IsOptional() @IsString() status?: string;

  @IsOptional() @IsString() assetId?: string;
  @IsOptional() @IsString() ticketId?: string;
  @IsOptional() @IsString() assignedToId?: string;

  @IsOptional() @IsDateString() scheduledStart?: string;
  @IsOptional() @IsDateString() scheduledEnd?: string;
  @IsOptional() @IsString() notes?: string;
}
