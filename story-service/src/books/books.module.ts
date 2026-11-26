import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book, BookPurchase, BookStory, Story, UserSubscription } from '../database/entities';
import { AdminBooksController } from './admin-books.controller';
import { BooksService } from './books.service';
import { PublicBooksController } from './public-books.controller';

/** Books: groups of published stories, sold as one book or included in a subscription. */
@Module({
  imports: [TypeOrmModule.forFeature([Book, BookStory, BookPurchase, Story, UserSubscription])],
  controllers: [AdminBooksController, PublicBooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
