import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { UserRole } from '../database/entities';
import { CreateStoryDto, PageDto, ReorderPagesDto, StoryDto, StoryListQueryDto, UpdateStoryDto } from './dto/story.dto';
import { StoriesService } from './stories.service';

/** Author endpoints. Every route is limited to authors, and every story is checked for ownership in the service. */
@ApiTags('Author')
@ApiBearerAuth()
@Roles(UserRole.AUTHOR)
@Controller('author')
export class AuthorController {
  constructor(private readonly stories: StoriesService) {}

  @Get('stories')
  @ApiOperation({ summary: 'List my stories' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: StoryListQueryDto) {
    return this.stories.list(user, query);
  }

  @Post('stories')
  @ApiOperation({ summary: 'Create a draft story' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStoryDto): Promise<StoryDto> {
    return this.stories.create(dto, user.id);
  }

  @Get('stories/:id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.stories.detail(id, user);
  }

  @Patch('stories/:id')
  @ApiOperation({ summary: 'Edit my story. Published stories go back to approval.' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStoryDto) {
    return this.stories.update(id, dto, user);
  }

  @Delete('stories/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a draft or rejected story' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.stories.remove(id, user);
    return { deleted: true };
  }

  @Post('stories/:id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send my story to the admin approval queue' })
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.stories.submit(id, user);
  }

  @Get('stories/:id/pages')
  listPages(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.stories.listPages(id, user);
  }

  @Post('stories/:id/pages')
  createPage(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PageDto) {
    return this.stories.createPage(id, dto, user);
  }

  @Patch('stories/:id/pages/:pageId')
  updatePage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: PageDto,
  ) {
    return this.stories.updatePage(id, pageId, dto, user);
  }

  @Delete('stories/:id/pages/:pageId')
  @HttpCode(HttpStatus.OK)
  async deletePage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    await this.stories.deletePage(id, pageId, user);
    return { deleted: true };
  }

  @Put('stories/:id/pages/order')
  @ApiOperation({ summary: 'Set the page order. Send every page id in the new order.' })
  async reorder(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderPagesDto) {
    await this.stories.reorderPages(id, dto.pageIds, user);
    return { reordered: true };
  }
}
