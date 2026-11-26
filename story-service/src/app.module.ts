import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from './config/config.module';
import { GLOBAL_THROTTLE } from './config/throttle';
import { buildDataSourceOptions } from './database/database.options';
import { AuthModule } from './auth/auth.module';
import { PublicModule } from './public/public.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { ReaderModule } from './reader/reader.module';
import { StoriesModule } from './stories/stories.module';
import { UploadsModule } from './uploads/uploads.module';
import { ContentModule } from './content/content.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    ThrottlerModule.forRoot([GLOBAL_THROTTLE]),
    ContentModule,
    AuthModule,
    StoriesModule,
    UploadsModule,
    SubscriptionsModule,
    PaymentsModule,
    ReaderModule,
    PublicModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
