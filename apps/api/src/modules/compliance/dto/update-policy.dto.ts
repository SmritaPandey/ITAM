import { IsString, IsOptional } from 'class-validator';

export class UpdatePolicyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() matchPattern?: any;
  @IsOptional() scope?: any;
}
