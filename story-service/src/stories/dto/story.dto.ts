import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AccessType, StoryStatus } from '../../database/entities';
import { PageQueryDto } from '../../common/pagination';

// Author DTOs deliberately omit accessType, pricePaise, isFeatured and publicationStatus.
// forbidNonWhitelisted in the global ValidationPipe rejects those fields for authors.

export class CreateStoryDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty()
  @IsUUID()
  languageId: string;

  @ApiPropertyOptional({ description: 'Path returned by POST /uploads?kind=cover' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;
}

export class AdminCreateStoryDto extends CreateStoryDto {
  @ApiProperty({ description: 'The author this story belongs to' })
  @IsUUID()
  authorId: string;
}

export class UpdateStoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  languageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string | null;
}

export class UpdatePricingDto {
  @ApiProperty({ enum: AccessType })
  @IsEnum(AccessType)
  accessType: AccessType;

  @ApiProperty({ description: 'Integer paise. Must be greater than 0 for PREMIUM stories.' })
  @IsInt()
  @Min(0)
  pricePaise: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100000)
  freePreviewPages: number;
}

export class SetFeaturedDto {
  @ApiProperty()
  @IsBoolean()
  isFeatured: boolean;
}

export class RejectStoryDto {
  @ApiProperty()
  @IsString()
  @Length(3, 1000)
  reason: string;
}

export class PageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ description: 'HTML from the editor. Sanitised on save.' })
  @IsString()
  content: string;
}

export class ReorderPagesDto {
  @ApiProperty({ type: [String], description: 'Page ids in the new order' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  pageIds: string[];
}

export class StoryListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: StoryStatus })
  @IsOptional()
  @IsEnum(StoryStatus)
  status?: StoryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class StoryDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
  @ApiProperty() description: string;
  @ApiProperty({ nullable: true }) coverImageUrl: string | null;
  @ApiProperty({ enum: StoryStatus }) publicationStatus: StoryStatus;
  @ApiProperty({ enum: AccessType }) accessType: AccessType;
  @ApiProperty() pricePaise: number;
  @ApiProperty() freePreviewPages: number;
  @ApiProperty() isFeatured: boolean;
  @ApiProperty() viewCount: number;
  @ApiProperty() pageCount: number;
  @ApiProperty() authorId: string;
  @ApiProperty() authorName: string;
  @ApiProperty() categoryId: string;
  @ApiProperty() categoryName: string;
  @ApiProperty() languageId: string;
  @ApiProperty() languageName: string;
  @ApiProperty({ nullable: true }) rejectionReason: string | null;
  @ApiProperty({ nullable: true }) publishedAt: Date | null;
  @ApiProperty() updatedAt: Date;
}
