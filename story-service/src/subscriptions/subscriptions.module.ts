import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPlan } from '../database/entities';
import { AdminPlansController } from './admin-plans.controller';
import { SubscriptionPlansService } from './subscription-plans.service';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionPlan])],
  controllers: [AdminPlansController],
  providers: [SubscriptionPlansService],
  exports: [SubscriptionPlansService],
})
export class SubscriptionsModule {}
