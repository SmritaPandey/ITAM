import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateTicketDto {
  @IsString() subject: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) assetIds?: string[];
}
