import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.decorators';
import {
  AccessType,
  Payment,
  PurchaseStatus,
  Story,
  StoryPurchase,
  StoryStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
  UserSubscription,
} from '../database/entities';
import { t } from '../i18n/i18n';
import { ReaderBookmark } from '../database/entities/bookmark.entity';
import { BooksService } from '../books/books.service';

const LIVE_STATUSES = [StoryStatus.PUBLISHED, StoryStatus.PENDING_APPROVAL];

/**
 * Reader entitlements (brief section 11). Every check happens on the server, using the current time.
 * Order: free story, preview pages, admin, owner, purchase, active subscription.
 */
@Injectable()
export class ReaderService {
  constructor(
    @InjectRepository(Story) private readonly stories: Repository<Story>,
    @InjectRepository(StoryPurchase) private readonly purchases: Repository<StoryPurchase>,
    @InjectRepository(UserSubscription) private readonly subscriptions: Repository<UserSubscription>,
    @InjectRepository(SubscriptionPlan) private readonly plans: Repository<SubscriptionPlan>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(ReaderBookmark) private readonly bookmarks: Repository<ReaderBookmark>,
    private readonly books: BooksService,
  ) {}

  async readPage(user: AuthenticatedUser, slug: string, pageNumber: number) {
    const story = await this.stories.findOne({ where: { slug } });
    if (!story || !story.publishedSnapshot || !LIVE_STATUSES.includes(story.publicationStatus)) {
      throw new NotFoundException(t('reader.storyNotFound'));
    }
    const snapshot = story.publishedSnapshot.pages;
    const page = snapshot.find((p) => p.pageNumber === pageNumber);
    if (!page) throw new NotFoundException(t('reader.pageNotFound'));

    const access = await this.access(user, story, pageNumber);
    if (!access.allowed) throw new ForbiddenException(t(access.reason));

    return {
      pageNumber: page.pageNumber,
      title: page.title,
      content: page.content,
      totalPages: snapshot.length,
    };
  }

  async listBookmarks(user: AuthenticatedUser) {
    const rows = await this.bookmarks.find({
      where: { userId: user.id },
      relations: { story: true },
      order: { createdAt: 'DESC' },
    });
    return rows
      .filter((b) => b.story && LIVE_STATUSES.includes(b.story.publicationStatus) && b.story.publishedSnapshot)
      .map((b) => ({
        storyId: b.storyId,
        slug: b.story.slug,
        title: b.story.publishedSnapshot?.title ?? b.story.title,
        coverImageUrl: b.story.publishedSnapshot?.coverImageUrl ?? b.story.coverImageUrl,
        accessType: b.story.accessType,
        bookmarkedAt: b.createdAt,
      }));
  }

  /** Bookmarks only published stories. Adding twice is harmless. */
  async addBookmark(user: AuthenticatedUser, storyId: string): Promise<void> {
    const story = await this.stories.findOne({ where: { id: storyId } });
    if (!story || !story.publishedSnapshot || !LIVE_STATUSES.includes(story.publicationStatus)) {
      throw new NotFoundException(t('reader.storyNotFound'));
    }
    const existing = await this.bookmarks.findOne({ where: { userId: user.id, storyId } });
    if (!existing) {
      await this.bookmarks.save(this.bookmarks.create({ userId: user.id, storyId }));
    }
  }

  async removeBookmark(user: AuthenticatedUser, storyId: string): Promise<void> {
    await this.bookmarks.delete({ userId: user.id, storyId });
  }

  async library(user: AuthenticatedUser) {
    const bookList = await this.books.libraryFor(user);
    const owned = await this.purchases.find({
      where: { userId: user.id, status: PurchaseStatus.ACTIVE },
      relations: { story: true },
      order: { purchasedAt: 'DESC' },
    });

    const now = new Date();
    const active = await this.subscriptions.findOne({
      where: { userId: user.id, status: SubscriptionStatus.ACTIVE, endDate: MoreThan(now) },
      order: { endDate: 'DESC' },
    });
    const latest = active ?? (await this.subscriptions.findOne({ where: { userId: user.id }, order: { endDate: 'DESC' } }));
    const plan = latest ? await this.plans.findOne({ where: { id: latest.planId } }) : null;

    const payments = await this.payments.find({ where: { userId: user.id }, order: { createdAt: 'DESC' } });

    const bookmarked = await this.listBookmarks(user);

    return {
      bookmarks: bookmarked,
      books: bookList,
      purchasedStories: owned.map((p) => ({
        storyId: p.storyId,
        slug: p.story?.slug ?? '',
        title: p.story?.title ?? '',
        purchasedAt: p.purchasedAt,
      })),
      subscription: latest
        ? {
            planName: plan?.name ?? '',
            endDate: latest.endDate,
            active: latest.status === SubscriptionStatus.ACTIVE && latest.endDate > now,
            message: active ? null : t('reader.subscriptionNotValid'),
          }
        : null,
      payments: payments.map((p) => ({
        id: p.id,
        purchaseType: p.purchaseType,
        amountPaise: p.amountPaise,
        status: p.paymentStatus,
        createdAt: p.createdAt,
      })),
    };
  }

  private async access(
    user: AuthenticatedUser,
    story: Story,
    pageNumber: number,
  ): Promise<{ allowed: true } | { allowed: false; reason: 'reader.lockedStory' | 'reader.subscriptionNotValid' }> {
    if (story.accessType === AccessType.FREE) return { allowed: true };
    if (pageNumber <= story.freePreviewPages) return { allowed: true };
    if (user.roles.includes(UserRole.ADMIN) || story.authorId === user.id) return { allowed: true };

    const owned = await this.purchases.findOne({ where: { userId: user.id, storyId: story.id, status: PurchaseStatus.ACTIVE } });
    if (owned) return { allowed: true };

    // A story inside a book the reader can open (free book, bought book, or subscription).
    if (await this.books.canReadStoryViaBooks(user, story.id)) return { allowed: true };

    const now = new Date();
    const active = await this.subscriptions.findOne({
      where: { userId: user.id, status: SubscriptionStatus.ACTIVE, endDate: MoreThan(now) },
    });
    if (active) return { allowed: true };

    // A subscriber whose plan has ended sees a clear message instead of a generic lock.
    const hadSubscription = await this.subscriptions.count({ where: { userId: user.id } });
    return { allowed: false, reason: hadSubscription > 0 ? 'reader.subscriptionNotValid' : 'reader.lockedStory' };
  }
}
