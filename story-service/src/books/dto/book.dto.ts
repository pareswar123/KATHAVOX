import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';
import { AccessType } from '../../database/entities';
import { BookStatus } from '../../database/entities/book.entity';

const MAX_STORIES_PER_BOOK = 200;

export class BookCreateDto {
  @ApiProperty({ example: 'Monsoon Tales' })
  @IsString()
  @Length(2, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Upload first, then pass the returned /uploads path' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string | null;

  @ApiProperty({ enum: AccessType })
  @IsEnum(AccessType)
  accessType: AccessType;

  @ApiPropertyOptional({ description: 'Price in paise. Required and above zero for PREMIUM books.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  pricePaise?: number;

  @ApiProperty({ type: [String], description: 'Published story ids, in reading order' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STORIES_PER_BOOK)
  @IsUUID('all', { each: true })
  storyIds: string[];
}

export class BookUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ enum: AccessType })
  @IsOptional()
  @IsEnum(AccessType)
  accessType?: AccessType;

  @ApiPropertyOptional({ description: 'Price in paise. Can be changed at any time; applies to new purchases.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  pricePaise?: number;

  @ApiPropertyOptional({ type: [String], description: 'Replaces the story list (published stories only)' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STORIES_PER_BOOK)
  @IsUUID('all', { each: true })
  storyIds?: string[];
}

export class BookListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: BookStatus })
  @IsOptional()
  @IsEnum(BookStatus)
  status?: BookStatus;
}
