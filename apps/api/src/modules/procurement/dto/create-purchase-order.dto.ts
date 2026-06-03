import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsString() description: string;
  @IsNumber() quantity: number;
  @IsNumber() unitPrice: number;
  @IsOptional() @IsString() assetTypeId?: string;
}

export class CreatePurchaseOrderDto {
  @IsString() vendorId: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
