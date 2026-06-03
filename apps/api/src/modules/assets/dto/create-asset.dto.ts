import { IsString, IsOptional, IsNumber, IsDateString, IsArray, IsEnum } from 'class-validator';

export class CreateAssetDto {
  @IsString() name: string;

  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() assetTag?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() manufacturer?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() subCategory?: string;
  @IsOptional() @IsString() status?: string;

  // Location (UUID references, not free-text)
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsString() room?: string;

  // Ownership
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() managedById?: string;
  @IsOptional() @IsString() assetTypeId?: string;

  // Financial — matches Prisma `purchasePrice` (NOT purchaseCost)
  @IsOptional() @IsNumber() purchasePrice?: number;

  // Dates — matches Prisma `procurementDate` (NOT purchaseDate)
  @IsOptional() @IsDateString() procurementDate?: string;
  @IsOptional() @IsDateString() warrantyExpiry?: string;
  @IsOptional() @IsDateString() deploymentDate?: string;
  @IsOptional() @IsDateString() eolDate?: string;

  // Network (IT assets)
  @IsOptional() @IsString() ipAddress?: string;
  @IsOptional() @IsString() macAddress?: string;
  @IsOptional() @IsString() hostname?: string;

  // Metadata
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
