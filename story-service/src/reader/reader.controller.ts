import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../auth/auth.decorators';
import { ReaderService } from './reader.service';

/** Logged-in reader endpoints. Every route needs a valid access token. */
@ApiTags('Reader')
@ApiBearerAuth()
@Controller('reader')
export class ReaderController {
  constructor(private readonly reader: ReaderService) {}

  @Get('library')
  library(@CurrentUser() user: AuthenticatedUser) {
    return this.reader.library(user);
  }

  @Get('stories/:slug/pages/:pageNumber')
  page(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
  ) {
    return this.reader.readPage(user, slug, pageNumber);
  }

  @Get('bookmarks')
  bookmarks(@CurrentUser() user: AuthenticatedUser) {
    return this.reader.listBookmarks(user);
  }

  @Put('bookmarks/:storyId')
  @HttpCode(HttpStatus.OK)
  async addBookmark(@CurrentUser() user: AuthenticatedUser, @Param('storyId', ParseUUIDPipe) storyId: string) {
    await this.reader.addBookmark(user, storyId);
    return { bookmarked: true };
  }

  @Delete('bookmarks/:storyId')
  @HttpCode(HttpStatus.OK)
  async removeBookmark(@CurrentUser() user: AuthenticatedUser, @Param('storyId', ParseUUIDPipe) storyId: string) {
    await this.reader.removeBookmark(user, storyId);
    return { bookmarked: false };
  }
}
