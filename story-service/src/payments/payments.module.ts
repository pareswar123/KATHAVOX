import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Payment,
  Story,
  StoryPurchase,
  SubscriptionPlan,
  User,
  UserRoleEntity,
  UserSubscription,
  VerificationToken,
} from '../database/entities';
import { Book, BookPurchase } from '../database/entities/book.entity';
import { MailService } from '../mail/mail.service';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Book,
      BookPurchase,
      Story,
      StoryPurchase,
      SubscriptionPlan,
      UserSubscription,
      User,
      UserRoleEntity,
      VerificationToken,
    ]),
  ],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, MailService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
