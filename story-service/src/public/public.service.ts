import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository, SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.decorators';
import { AppConfig } from '../config/app-config';
import { Paginated, paginate, resolvePage } from '../common/pagination';
import {
  AccessType,
  Category,
  Language,
  PublishedSnapshot,
  Story,
  PurchaseStatus,
  StoryPurchase,
  StoryStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
  UserSubscription,
} from '../database/entities';
import { t } from '../i18n/i18n';
import { PublicStoryListQueryDto } from './dto/public.dto';

/** Stories visible to readers: published, or awaiting an edit approval (readers keep seeing the approved snapshot). */
const LIVE_STATUSES = [StoryStatus.PUBLISHED, StoryStatus.PENDING_APPROVAL];

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Language) private readonly languageRepo: Repository<Language>,
    @InjectRepository(SubscriptionPlan) private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Story) private readonly storyRepo: Repository<Story>,
    @InjectRepository(StoryPurchase) private readonly purchases: Repository<StoryPurchase>,
    @InjectRepository(UserSubscription) private readonly subscriptions: Repository<UserSubscription>,
    private readonly cfg: AppConfig,
  ) {}

  categories() {
    return this.categoryRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  languages() {
    return this.languageRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      select: { id: true, name: true, code: true, slug: true },
    });
  }

  subscriptionPlans() {
    return this.planRepo.find({
      where: { isActive: true },
      order: { pricePaise: 'ASC' },
      select: { id: true, name: true, description: true, pricePaise: true, durationDays: true },
    });
  }

  async listStories(query: PublicStoryListQueryDto): Promise<Paginated<PublicStoryCard>> {
    const qb = this.liveQuery();
    if (query.q) qb.andWhere('s.title ILIKE :q', { q: `%${query.q}%` });
    if (query.category) qb.andWhere('category.slug = :category', { category: query.category });
    if (query.language) qb.andWhere('language.code = :language', { language: query.language });

    const resolved = resolvePage(query, this.cfg);
    const [rows, total] = await qb
      .orderBy('s.publishedAt', 'DESC')
      .skip(resolved.skip)
      .take(resolved.limit)
      .getManyAndCount();

    return paginate(rows.map((row) => this.toCard(row)), total, resolved);
  }

  /**
   * Public story detail. Free stories return every page. Premium stories return only the
   * preview pages; locked pages are listed by number and their content is never included.
   */
  async getStory(slug: string, user?: AuthenticatedUser): Promise<PublicStoryDetail> {
    const row = await this.liveQuery().andWhere('s.slug = :slug', { slug }).getOne();
    const snapshot = row?.publishedSnapshot;
    if (!row || !snapshot) {
      throw new NotFoundException(t('public.storyNotFound'));
    }

    const pages = snapshot.pages;
    const access = user ? await this.readerAccess(user, row) : { entitled: false, note: null };
    const readableUpTo = access.entitled || row.accessType === AccessType.FREE ? pages.length : row.freePreviewPages;
    return {
      story: this.toCard(row),
      entitled: access.entitled,
      accessNote: access.note,
      previewPages: pages
        .filter((p) => p.pageNumber <= readableUpTo)
        .map((p) => ({ pageNumber: p.pageNumber, title: p.title, content: p.content })),
      lockedPageNumbers: pages.filter((p) => p.pageNumber > readableUpTo).map((p) => p.pageNumber),
      totalPages: pages.length,
      snapshotPublishedAt: snapshot.publishedAt,
    };
  }

  /** Same rules as the reader page: free story, admin, owner, purchase, or an active subscription. */
  private async readerAccess(
    user: AuthenticatedUser,
    story: Story,
  ): Promise<{ entitled: boolean; note: PublicStoryDetail['accessNote'] }> {
    if (story.accessType === AccessType.FREE || user.roles.includes(UserRole.ADMIN) || story.authorId === user.id) {
      return { entitled: true, note: null };
    }
    const owned = await this.purchases.findOne({
      where: { userId: user.id, storyId: story.id, status: PurchaseStatus.ACTIVE },
    });
    if (owned) {
      return { entitled: true, note: { kind: 'PURCHASED', endDate: null, planName: null } };
    }
    const sub = await this.subscriptions.findOne({
      where: { userId: user.id, status: SubscriptionStatus.ACTIVE, endDate: MoreThan(new Date()) },
      relations: { plan: true },
      order: { endDate: 'DESC' },
    });
    if (sub) {
      return {
        entitled: true,
        note: { kind: 'SUBSCRIPTION', endDate: sub.endDate.toISOString(), planName: sub.plan?.name ?? '' },
      };
    }
    return { entitled: false, note: null };
  }

  private liveQuery(): SelectQueryBuilder<Story> {
    return this.storyRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.author', 'author')
      .leftJoinAndSelect('s.category', 'category')
      .leftJoinAndSelect('s.language', 'language')
      .where('s.publicationStatus IN (:...statuses)', { statuses: LIVE_STATUSES })
      .andWhere('s.publishedSnapshot IS NOT NULL');
  }

  private toCard(row: Story): PublicStoryCard {
    const snapshot: PublishedSnapshot | null = row.publishedSnapshot;
    return {
      id: row.id,
      slug: row.slug,
      title: snapshot?.title ?? row.title,
      description: snapshot?.description ?? row.description,
      coverImageUrl: snapshot?.coverImageUrl ?? row.coverImageUrl,
      accessType: row.accessType,
      pricePaise: row.pricePaise,
      freePreviewPages: row.freePreviewPages,
      isFeatured: row.isFeatured,
      viewCount: row.viewCount,
      totalPages: snapshot?.pages.length ?? 0,
      categoryName: row.category?.name ?? '',
      languageName: row.language?.name ?? '',
      authorName: row.author?.penName ?? row.author?.fullName ?? '',
      publishedAt: row.publishedAt,
    };
  }
}

export interface PublicStoryCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  accessType: AccessType;
  pricePaise: number;
  freePreviewPages: number;
  isFeatured: boolean;
  viewCount: number;
  totalPages: number;
  categoryName: string;
  languageName: string;
  authorName: string;
  publishedAt: Date | null;
}

export interface PublicStoryDetail {
  story: PublicStoryCard;
  previewPages: Array<{ pageNumber: number; title: string; content: string }>;
  lockedPageNumbers: number[];
  totalPages: number;
  snapshotPublishedAt: string;
  /** True when this reader may read every page (purchase, subscription, free story, owner or admin). */
  entitled: boolean;
  accessNote: { kind: 'PURCHASED' | 'SUBSCRIPTION'; endDate: string | null; planName: string | null } | null;
}
