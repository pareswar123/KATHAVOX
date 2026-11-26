import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/auth.decorators';
import { UserRole } from '../database/entities';
import { BookCreateDto, BookListQueryDto, BookUpdateDto } from './dto/book.dto';
import { BooksService } from './books.service';

/** Admin book management: compose from published stories, publish, unpublish, edit price, download PDF. */
@ApiTags('Admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/books')
export class AdminBooksController {
  constructor(private readonly books: BooksService) {}

  @Get('story-options')
  @ApiOperation({ summary: 'Published stories that can be added to a book' })
  storyOptions() {
    return this.books.storyOptions();
  }

  @Get()
  @ApiOperation({ summary: 'List books (all statuses)' })
  list(@Query() query: BookListQueryDto) {
    return this.books.adminList(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a book from published stories. It starts as a draft.' })
  create(@Body() dto: BookCreateDto) {
    return this.books.create(dto);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.books.adminDetail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit title, cover, stories, access and price. Published books update at once.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BookUpdateDto) {
    return this.books.update(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.books.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.books.unpublish(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.books.remove(id);
    return { deleted: true };
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Book PDF: cover, contents, then each story (cover, details, pages)' })
  async pdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const file = await this.books.pdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.end(file.buffer);
  }
}
