import { IsString, IsOptional, IsEnum, IsInt, IsNumber, IsDateString, Min } from 'class-validator';

enum LicenseType {
  PER_SEAT = 'PER_SEAT',
  PER_DEVICE = 'PER_DEVICE',
  SITE = 'SITE',
  ENTERPRISE = 'ENTERPRISE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  CONCURRENT = 'CONCURRENT',
  OPEN_SOURCE = 'OPEN_SOURCE',
}

enum LicenseModel {
  PERPETUAL = 'PERPETUAL',
  ANNUAL = 'ANNUAL',
  MONTHLY = 'MONTHLY',
  USAGE_BASED = 'USAGE_BASED',
  FREEMIUM = 'FREEMIUM',
}

export class CreateLicenseDto {
  @IsString() softwareName: string;

  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() version?: string;
  @IsOptional() @IsString() licenseKey?: string;

  @IsOptional() @IsEnum(LicenseType) licenseType?: LicenseType;
  @IsOptional() @IsEnum(LicenseModel) licenseModel?: LicenseModel;

  @IsOptional() @IsInt() @Min(0) totalSeats?: number;
  @IsOptional() @IsInt() @Min(0) usedSeats?: number;

  @IsOptional() @IsNumber() purchaseCost?: number;
  @IsOptional() @IsNumber() renewalCost?: number;

  @IsOptional() @IsDateString() purchaseDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;

  @IsOptional() @IsString() poNumber?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() status?: string;
}
