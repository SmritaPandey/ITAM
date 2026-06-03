import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateUserDto {
  @IsEmail() email: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() password: string;
  @IsString() roleId: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() title?: string;
}
