import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateVendorDto {
  @IsString() name: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() status?: string;
}
