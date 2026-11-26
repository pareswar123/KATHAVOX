import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Filters for the admin payments list. Dates are calendar days (YYYY-MM-DD) in the configured offset. */
export class AdminPaymentsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: '2026-11-25', description: 'First day, inclusive. Default: today.' })
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-25', description: 'Last day, inclusive. Default: the from date.' })
  @IsOptional()
  @Matches(DATE)
  to?: string;

  @ApiPropertyOptional({ enum: ['ALL', 'SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'] })
  @IsOptional()
  @IsIn(['ALL', 'SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'])
  status?: string;

  @ApiPropertyOptional({ enum: ['ALL', 'STORY_PURCHASE', 'SUBSCRIPTION'] })
  @IsOptional()
  @IsIn(['ALL', 'STORY_PURCHASE', 'SUBSCRIPTION'])
  type?: string;
}
