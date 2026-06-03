import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean } from 'class-validator';

export class CreateContractDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() name?: string;

  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsString() vendorName?: string;

  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsString() currency?: string;

  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;

  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() autoRenew?: boolean;
  @IsOptional() @IsString() terms?: string;
  @IsOptional() @IsString() notes?: string;
}
