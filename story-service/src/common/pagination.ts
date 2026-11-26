import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { AppConfig } from '../config/app-config';

/** Query parameters for paginated lists. Defaults and maximum come from config, not from this file. */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface ResolvedPage {
  page: number;
  limit: number;
  skip: number;
}

export function resolvePage(query: PageQueryDto, cfg: AppConfig): ResolvedPage {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? cfg.pagination.defaultLimit, cfg.pagination.maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

export function paginate<T>(items: T[], total: number, resolved: ResolvedPage): Paginated<T> {
  return {
    items,
    meta: {
      page: resolved.page,
      limit: resolved.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / resolved.limit)),
    },
  };
}
