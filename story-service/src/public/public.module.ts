import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category, Language, Story, StoryPurchase, SubscriptionPlan, UserSubscription } from '../database/entities';
import { BooksModule } from '../books/books.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Language, SubscriptionPlan, Story, StoryPurchase, UserSubscription]), BooksModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
