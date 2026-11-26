import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CategoryInputDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class CategoryUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LanguageInputDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ example: 'hi' })
  @IsString()
  @Matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, { message: 'code must look like en, hi or en-IN' })
  code: string;
}

export class LanguageUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
