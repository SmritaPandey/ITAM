import { IsString, IsOptional } from 'class-validator';

export class CreateDeviceDto {
  @IsString() name: string;
  @IsString() ipAddress: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() config?: any;
  @IsOptional() metrics?: any;
}
