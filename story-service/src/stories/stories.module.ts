import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category, Language, Story, StoryPage, User, UserRoleEntity } from '../database/entities';
import { DashboardController } from '../dashboard/dashboard.controller';
import { CatalogController } from '../catalog/catalog.controller';
import { CatalogService } from '../catalog/catalog.service';
import { AuthorController } from './author.controller';
import { AdminController } from './admin.controller';
import { StoriesService } from './stories.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [TypeOrmModule.forFeature([Story, StoryPage, Category, Language, User, UserRoleEntity]), PaymentsModule],
  controllers: [AuthorController, AdminController, CatalogController, DashboardController],
  providers: [StoriesService, CatalogService],
  exports: [StoriesService],
})
export class StoriesModule {}
