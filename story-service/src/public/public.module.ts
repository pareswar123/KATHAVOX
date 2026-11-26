import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category, Language, Story, StoryPurchase, SubscriptionPlan, UserSubscription } from '../database/entities';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Language, SubscriptionPlan, Story, StoryPurchase, UserSubscription])],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
