import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Public, type AuthenticatedUser } from '../auth/auth.decorators';
import { AppConfig } from '../config/app-config';
import { CategoryDto, LanguageDto, PublicStoryListQueryDto, SubscriptionPlanDto } from './dto/public.dto';
import { PublicService } from './public.service';

@ApiTags('Public')
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly cfg: AppConfig,
  ) {}

  @Get('categories')
  @ApiOperation({ summary: 'List active categories' })
  @ApiOkResponse({ type: [CategoryDto] })
  categories(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', this.cfg.cache.publicControl);
    return this.publicService.categories();
  }

  @Get('languages')
  @ApiOperation({ summary: 'List active languages' })
  @ApiOkResponse({ type: [LanguageDto] })
  languages(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', this.cfg.cache.publicControl);
    return this.publicService.languages();
  }

  @Get('subscription-plans')
  @ApiOperation({ summary: 'List active subscription plans' })
  @ApiOkResponse({ type: [SubscriptionPlanDto] })
  subscriptionPlans(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', this.cfg.cache.publicControl);
    return this.publicService.subscriptionPlans();
  }

  @Get('stories')
  @ApiOperation({ summary: 'Published stories with search and filters' })
  stories(@Res({ passthrough: true }) res: Response, @Query() query: PublicStoryListQueryDto) {
    res.setHeader('Cache-Control', this.cfg.cache.publicStoriesControl);
    return this.publicService.listStories(query);
  }

  @Get('stories/:slug')
  @ApiOperation({ summary: 'Story detail with preview pages only. Locked page content is never returned.' })
  story(
    @Res({ passthrough: true }) res: Response,
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    res.setHeader('Cache-Control', this.cfg.cache.publicStoriesControl);
    return this.publicService.getStory(slug, user);
  }
}
