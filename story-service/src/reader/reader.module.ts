import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment, ReaderBookmark, Story, StoryPurchase, SubscriptionPlan, UserSubscription } from '../database/entities';
import { BooksModule } from '../books/books.module';
import { ReaderController } from './reader.controller';
import { ReaderService } from './reader.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Story, StoryPurchase, UserSubscription, SubscriptionPlan, Payment, ReaderBookmark]),
    BooksModule,
  ],
  controllers: [ReaderController],
  providers: [ReaderService],
})
export class ReaderModule {}
