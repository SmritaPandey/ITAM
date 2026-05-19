import { IsString, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Acme Corp', description: 'Company/organization name' })
  @IsString()
  @MinLength(2, { message: 'Company name must be at least 2 characters' })
  @MaxLength(100, { message: 'Company name must be under 100 characters' })
  companyName: string;

  @ApiProperty({ example: 'Jane Smith', description: 'Full name of the admin user' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must be under 100 characters' })
  fullName: string;

  @ApiProperty({ example: 'jane@acme.com', description: 'Work email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'Password (min 8 chars, must include uppercase and number)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must be under 128 characters' })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, { message: 'Password must contain at least one uppercase letter and one number' })
  password: string;
}
