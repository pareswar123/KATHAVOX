import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { type AuthenticatedUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { UserRole } from '../database/entities';
import {
  AdminCreateStoryDto,
  PageDto,
  RejectStoryDto,
  ReorderPagesDto,
  SetFeaturedDto,
  StoryListQueryDto,
  UpdatePricingDto,
  UpdateStoryDto,
} from './dto/story.dto';
import { StoriesService } from './stories.service';

/** Admin endpoints. Admins may act on any story. */
@ApiTags('Admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly stories: StoriesService) {}

  @Get('stories')
  @ApiOperation({ summary: 'List all stories, optionally filtered by status' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: StoryListQueryDto) {
    return this.stories.list(user, query);
  }

  @Post('stories')
  @ApiOperation({ summary: 'Create a story for a chosen author' })
  create(@Body() dto: AdminCreateStoryDto) {
    return this.stories.adminCreateForAuthor(dto);
  }

  @Get('stories/:id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.stories.detail(id, user);
  }

  @Get('stories/:id/pdf')
  @ApiOperation({ summary: 'Download the published version of a story as a book-style PDF' })
  async downloadPdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const file = await this.stories.exportBook(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.end(file.buffer);
  }

  @Patch('stories/:id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStoryDto) {
    return this.stories.update(id, dto, user);
  }

  @Delete('stories/:id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.stories.remove(id, user);
    return { deleted: true };
  }

  @Patch('stories/:id/pricing')
  @ApiOperation({ summary: 'Set free or premium, price in paise, and free preview page count' })
  pricing(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePricingDto) {
    return this.stories.updatePricing(id, dto, user);
  }

  @Patch('stories/:id/featured')
  featured(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetFeaturedDto) {
    return this.stories.setFeatured(id, dto.isFeatured, user);
  }

  @Get('authors')
  @ApiOperation({ summary: 'Authors that can be chosen when creating a story' })
  authors() {
    return this.stories.listAuthors();
  }

  @Get('approvals')
  @ApiOperation({ summary: 'Stories waiting for approval' })
  approvals(@Query() query: StoryListQueryDto) {
    return this.stories.approvals(query);
  }

  @Post('stories/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.stories.approve(id, user);
  }

  @Post('stories/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectStoryDto) {
    return this.stories.reject(id, dto.reason, user);
  }

  @Post('stories/:id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.stories.publish(id, user);
  }

  @Post('stories/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.stories.unpublish(id, user);
  }

  @Post('stories/:id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.stories.archive(id, user);
  }

  // ----- pages (same rules as author, admin may edit any story) -----

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
  async reorder(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderPagesDto) {
    await this.stories.reorderPages(id, dto.pageIds, user);
    return { reordered: true };
  }
}
