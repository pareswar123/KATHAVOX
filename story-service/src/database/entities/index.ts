import { User, UserRoleEntity } from './user.entity';
import { AuthSession, RefreshToken, VerificationToken } from './auth.entity';
import { ApplicationSetting, Category, Language } from './catalog.entity';
import { Story, StoryPage } from './story.entity';
import { ReaderBookmark } from './bookmark.entity';
import { Book, BookPurchase, BookStory } from './book.entity';
import {
  Payment,
  ReadingProgress,
  StoryPurchase,
  StoryViewDaily,
  SubscriptionPlan,
  UserSubscription,
} from './commerce.entity';

export * from './user.entity';
export * from './auth.entity';
export * from './catalog.entity';
export * from './story.entity';
export * from './commerce.entity';
export * from './bookmark.entity';
export * from './book.entity';

/** Every entity, used by both the Nest app and the TypeORM CLI DataSource. */
export const ENTITIES = [
  User,
  UserRoleEntity,
  AuthSession,
  RefreshToken,
  VerificationToken,
  Category,
  Language,
  ApplicationSetting,
  Story,
  StoryPage,
  StoryPurchase,
  SubscriptionPlan,
  UserSubscription,
  Payment,
  ReadingProgress,
  StoryViewDaily,
  ReaderBookmark,
  Book,
  BookStory,
  BookPurchase,
];
