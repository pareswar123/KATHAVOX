import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser, Public } from '../auth/auth.decorators';
import { BookListQueryDto } from './dto/book.dto';
import { BooksService } from './books.service';

/** Public book pages. Anyone can browse; stories open through the reader only when access allows. */
@ApiTags('Books')
@Public()
@Controller('books')
export class PublicBooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'Published books' })
  list(@Query() query: BookListQueryDto) {
    return this.books.publicList(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'One published book: index with page ranges and the reader access state' })
  detail(@Param('slug') slug: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.books.publicGet(slug, user);
  }
}
