import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

// Password length limits are read from config and enforced in AuthService.
// The DTOs only check types and the column sizes defined in the database.

export class LoginDto {
  @ApiProperty({ example: 'reader@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class RegisterAuthorDto {
  @ApiProperty()
  @IsString()
  @Length(1, 150)
  fullName: string;

  @ApiProperty()
  @IsString()
  @Length(1, 150)
  penName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty()
  @IsString()
  confirmPassword: string;
}

export class TokenDto {
  @ApiProperty({ description: 'Single-use token from the email link' })
  @IsString()
  token: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty()
  @IsString()
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty()
  @IsString()
  newPassword: string;
}

export class CurrentUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() fullName: string;
  @ApiProperty({ nullable: true }) penName: string | null;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty({ isArray: true, enum: ['ADMIN', 'AUTHOR', 'READER'] }) roles: string[];
}

export class RefreshTokenDto {
  @ApiProperty({ required: false, description: 'Refresh token kept in this tab' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}

export class AuthTokensDto {
  @ApiProperty({ description: 'Refresh token for this tab only (kept in sessionStorage)' })
  refreshToken?: string;

  @ApiProperty({ description: 'Short-lived JWT; keep in memory only and send as Bearer' })
  accessToken: string;

  @ApiProperty({ description: 'Seconds until the access token expires' })
  expiresIn: number;

  @ApiProperty({ type: CurrentUserDto })
  user: CurrentUserDto;
}

export class RegisterReaderDto {
  @ApiProperty()
  @IsString()
  @Length(2, 150)
  fullName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email: string;
}
