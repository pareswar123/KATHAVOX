import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { resolve } from 'node:path';
import { AuthenticatedUser } from '../auth/auth.decorators';
import { buildBookPdf } from './pdf/book-pdf.builder';
import { AppConfig } from '../config/app-config';
import { Paginated, paginate, resolvePage } from '../common/pagination';
import { slugify } from '../common/slug';
import {
  AccessType,
  Category,
  Language,
  PublishedSnapshot,
  Story,
  StoryPage,
  StoryStatus,
  User,
  UserRole,
  UserRoleEntity,
} from '../database/entities';
import { t } from '../i18n/i18n';
import { SanitizerService } from '../content/sanitizer.service';
import {
  CreateStoryDto,
  PageDto,
  StoryDto,
  StoryListQueryDto,
  UpdatePricingDto,
  UpdateStoryDto,
} from './dto/story.dto';

/** Pages are renumbered in two passes; this offset keeps temporary numbers clear of the unique index. */
const TEMP_PAGE_OFFSET = 1_000_000;

/** Statuses an author may still change. ARCHIVED stories are read-only for authors. */
const AUTHOR_EDITABLE: StoryStatus[] = [
  StoryStatus.DRAFT,
  StoryStatus.REJECTED,
  StoryStatus.PUBLISHED,
  StoryStatus.PENDING_APPROVAL,
];

export interface StoryPageDto {
  id: string;
  pageNumber: number;
  title: string;
  content: string;
  updatedAt: Date;
}

/** Admin lists and counts skip author drafts that were never submitted. */
const ADMIN_VISIBLE = '(s.publicationStatus <> :draft OR s.submittedAt IS NOT NULL)';

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story) private readonly stories: Repository<Story>,
    @InjectRepository(StoryPage) private readonly pages: Repository<StoryPage>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Language) private readonly languages: Repository<Language>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserRoleEntity) private readonly roles: Repository<UserRoleEntity>,
    private readonly dataSource: DataSource,
    private readonly cfg: AppConfig,
    private readonly sanitizer: SanitizerService,
  ) {}

  // ---------- reads ----------

  async list(actor: AuthenticatedUser, query: StoryListQueryDto): Promise<Paginated<StoryDto>> {
    const qb = this.withRelations();
    if (!this.isAdmin(actor)) qb.andWhere('s.authorId = :actorId', { actorId: actor.id });
    if (this.isAdmin(actor)) qb.andWhere(ADMIN_VISIBLE, { draft: StoryStatus.DRAFT });
    if (query.status) qb.andWhere('s.publicationStatus = :status', { status: query.status });
    if (query.search) qb.andWhere('s.title ILIKE :search', { search: `%${query.search}%` });

    const resolved = resolvePage(query, this.cfg);
    const [rows, total] = await qb
      .orderBy('s.updatedAt', 'DESC')
      .skip(resolved.skip)
      .take(resolved.limit)
      .getManyAndCount();

    const counts = await this.pageCounts(rows.map((row) => row.id));
    return paginate(
      rows.map((row) => this.toDto(row, counts.get(row.id) ?? 0)),
      total,
      resolved,
    );
  }

  async detail(id: string, actor: AuthenticatedUser): Promise<StoryDto> {
    await this.getOwnedStory(id, actor);
    const row = await this.withRelations().where('s.id = :id', { id }).getOneOrFail();
    return this.toDto(row, await this.pageCountOf(id));
  }

  approvals(query: StoryListQueryDto): Promise<Paginated<StoryDto>> {
    return this.list({ id: '', email: '', roles: [UserRole.ADMIN], sessionId: '' }, {
      ...query,
      status: StoryStatus.PENDING_APPROVAL,
    });
  }

  // ---------- story create, update, delete ----------

  async create(dto: CreateStoryDto, authorId: string): Promise<StoryDto> {
    await this.assertCategoryAndLanguage(dto.categoryId, dto.languageId);
    const story = await this.stories.save(
      this.stories.create({
        authorId,
        title: dto.title.trim(),
        slug: await this.uniqueSlug(dto.title),
        description: dto.description ?? '',
        coverImageUrl: dto.coverImageUrl ?? null,
        categoryId: dto.categoryId,
        languageId: dto.languageId,
        accessType: AccessType.FREE,
        pricePaise: 0,
        freePreviewPages: this.cfg.stories.defaultFreePreviewPages,
        publicationStatus: StoryStatus.DRAFT,
      }),
    );
    return this.detail(story.id, this.systemActor(authorId));
  }

  async adminCreateForAuthor(dto: CreateStoryDto & { authorId: string }): Promise<StoryDto> {
    const author = await this.roles.findOne({ where: { userId: dto.authorId, role: UserRole.AUTHOR } });
    if (!author) throw new BadRequestException(t('stories.authorInvalid'));
    const created = await this.create(dto, dto.authorId);
    // Created by the admin, so it is visible to the admin straight away.
    await this.stories.update(created.id, { submittedAt: new Date() });
    return created;
  }

  async update(id: string, dto: UpdateStoryDto, actor: AuthenticatedUser): Promise<StoryDto> {
    await this.dataSource.transaction(async (m) => {
      const story = await this.getOwnedStory(id, actor, m);
      this.assertEditable(story, actor);
      if (dto.categoryId || dto.languageId) {
        await this.assertCategoryAndLanguage(dto.categoryId ?? story.categoryId, dto.languageId ?? story.languageId);
      }

      if (dto.title !== undefined) story.title = dto.title.trim();
      if (dto.description !== undefined) story.description = dto.description;
      if (dto.categoryId !== undefined) story.categoryId = dto.categoryId;
      if (dto.languageId !== undefined) story.languageId = dto.languageId;
      if (dto.coverImageUrl !== undefined) story.coverImageUrl = dto.coverImageUrl;

      await this.applyContentChange(m, story, actor);
      await m.save(story);
    });
    return this.detail(id, actor);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const story = await this.getOwnedStory(id, actor);
    if (story.publicationStatus !== StoryStatus.DRAFT && story.publicationStatus !== StoryStatus.REJECTED) {
      throw new ConflictException(t('stories.notDeletable'));
    }
    await this.stories.delete(story.id);
  }

  // ---------- pages ----------

  async listPages(storyId: string, actor: AuthenticatedUser): Promise<StoryPageDto[]> {
    await this.getOwnedStory(storyId, actor);
    const rows = await this.pages.find({ where: { storyId }, order: { pageNumber: 'ASC' } });
    return rows.map((row) => this.toPageDto(row));
  }

  async createPage(storyId: string, dto: PageDto, actor: AuthenticatedUser): Promise<StoryPageDto> {
    const content = this.sanitizeContent(dto.content);
    return this.dataSource.transaction(async (m) => {
      const story = await this.getOwnedStory(storyId, actor, m);
      this.assertEditable(story, actor);
      const count = await m.count(StoryPage, { where: { storyId } });
      const page = await m.save(
        m.create(StoryPage, {
          storyId,
          pageNumber: count + 1,
          displayOrder: count + 1,
          title: dto.title?.trim() ?? '',
          content,
        }),
      );
      await this.applyContentChange(m, story, actor);
      await m.save(story);
      return this.toPageDto(page);
    });
  }

  async updatePage(storyId: string, pageId: string, dto: PageDto, actor: AuthenticatedUser): Promise<StoryPageDto> {
    const content = this.sanitizeContent(dto.content);
    return this.dataSource.transaction(async (m) => {
      const story = await this.getOwnedStory(storyId, actor, m);
      this.assertEditable(story, actor);
      const page = await m.findOne(StoryPage, { where: { id: pageId, storyId } });
      if (!page) throw new NotFoundException(t('stories.pageNotFound'));

      page.title = dto.title?.trim() ?? page.title;
      page.content = content;
      await m.save(page);
      await this.applyContentChange(m, story, actor);
      await m.save(story);
      return this.toPageDto(page);
    });
  }

  async deletePage(storyId: string, pageId: string, actor: AuthenticatedUser): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const story = await this.getOwnedStory(storyId, actor, m);
      this.assertEditable(story, actor);
      const page = await m.findOne(StoryPage, { where: { id: pageId, storyId } });
      if (!page) throw new NotFoundException(t('stories.pageNotFound'));

      await m.delete(StoryPage, page.id);
      const remaining = await m.find(StoryPage, { where: { storyId }, order: { pageNumber: 'ASC' } });
      await this.renumber(m, remaining);
      await this.applyContentChange(m, story, actor);
      await m.save(story);
    });
  }

  async reorderPages(storyId: string, pageIds: string[], actor: AuthenticatedUser): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const story = await this.getOwnedStory(storyId, actor, m);
      this.assertEditable(story, actor);
      const existing = await m.find(StoryPage, { where: { storyId }, order: { pageNumber: 'ASC' } });
      const existingIds = new Set(existing.map((p) => p.id));
      if (pageIds.length !== existing.length || !pageIds.every((id) => existingIds.has(id))) {
        throw new BadRequestException(t('stories.pageOrderInvalid'));
      }
      const byId = new Map(existing.map((p) => [p.id, p]));
      await this.renumber(m, pageIds.map((id) => byId.get(id)!));
      await this.applyContentChange(m, story, actor);
      await m.save(story);
    });
  }

  // ---------- workflow (author and admin) ----------

  /** Author sends a draft or rejected story to the approval queue. */
  async submit(id: string, actor: AuthenticatedUser): Promise<StoryDto> {
    const story = await this.getOwnedStory(id, actor);
    this.assertTransition(story, [StoryStatus.DRAFT, StoryStatus.REJECTED]);
    await this.requirePages(id);
    story.publicationStatus = StoryStatus.PENDING_APPROVAL;
    story.rejectionReason = null;
    story.submittedAt = story.submittedAt ?? new Date();
    await this.stories.save(story);
    return this.detail(id, actor);
  }

  async approve(id: string, actor: AuthenticatedUser): Promise<StoryDto> {
    return this.publish(id, actor, [StoryStatus.PENDING_APPROVAL]);
  }

  async publish(id: string, actor: AuthenticatedUser, from?: StoryStatus[]): Promise<StoryDto> {
    await this.dataSource.transaction(async (m) => {
      const story = await this.getOwnedStory(id, actor, m);
      // A rejected story cannot be published. The author must fix it and submit it again.
      this.assertTransition(story, from ?? [StoryStatus.DRAFT, StoryStatus.PENDING_APPROVAL, StoryStatus.ARCHIVED]);
      await this.requirePages(id, m);
      story.publishedSnapshot = await this.buildSnapshot(m, story);
      story.publishedAt = story.publishedAt ?? new Date();
      story.submittedAt = story.submittedAt ?? new Date();
      story.publicationStatus = StoryStatus.PUBLISHED;
      story.rejectionReason = null;
      await m.save(story);
    });
    return this.detail(id, actor);
  }

  async reject(id: string, reason: string, actor: AuthenticatedUser): Promise<StoryDto> {
    const story = await this.getOwnedStory(id, actor);
    this.assertTransition(story, [StoryStatus.PENDING_APPROVAL]);
    story.publicationStatus = StoryStatus.REJECTED;
    story.rejectionReason = reason.trim();
    await this.stories.save(story);
    return this.detail(id, actor);
  }

  /** Takes a story off the public site. The approved snapshot is kept so it can be republished. */
  async unpublish(id: string, actor: AuthenticatedUser): Promise<StoryDto> {
    const story = await this.getOwnedStory(id, actor);
    this.assertTransition(story, [StoryStatus.PUBLISHED, StoryStatus.PENDING_APPROVAL]);
    story.publicationStatus = StoryStatus.DRAFT;
    await this.stories.save(story);
    return this.detail(id, actor);
  }

  async archive(id: string, actor: AuthenticatedUser): Promise<StoryDto> {
    const story = await this.getOwnedStory(id, actor);
    this.assertTransition(story, [
      StoryStatus.DRAFT,
      StoryStatus.PENDING_APPROVAL,
      StoryStatus.PUBLISHED,
      StoryStatus.REJECTED,
    ]);
    story.publicationStatus = StoryStatus.ARCHIVED;
    await this.stories.save(story);
    return this.detail(id, actor);
  }

  async updatePricing(id: string, dto: UpdatePricingDto, actor: AuthenticatedUser): Promise<StoryDto> {
    if (dto.accessType === AccessType.PREMIUM && dto.pricePaise <= 0) {
      throw new BadRequestException(t('stories.priceRequired'));
    }
    const story = await this.getOwnedStory(id, actor);
    story.accessType = dto.accessType;
    story.pricePaise = dto.accessType === AccessType.FREE ? 0 : dto.pricePaise;
    story.freePreviewPages = dto.freePreviewPages;
    await this.stories.save(story);
    return this.detail(id, actor);
  }

  async setFeatured(id: string, isFeatured: boolean, actor: AuthenticatedUser): Promise<StoryDto> {
    const story = await this.getOwnedStory(id, actor);
    story.isFeatured = isFeatured;
    await this.stories.save(story);
    return this.detail(id, actor);
  }

  // ---------- dashboard counts ----------

  async authorCounts(authorId: string) {
    const rows = await this.stories
      .createQueryBuilder('s')
      .select('s.publicationStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(s.viewCount), 0)', 'views')
      .where('s.authorId = :authorId', { authorId })
      .groupBy('s.publicationStatus')
      .getRawMany<{ status: StoryStatus; count: string; views: string }>();
    return this.summarise(rows);
  }

  async adminCounts() {
    const rows = await this.stories
      .createQueryBuilder('s')
      .select('s.publicationStatus', 'status')
      .addSelect('s.accessType', 'access')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(s.viewCount), 0)', 'views')
      .where(ADMIN_VISIBLE, { draft: StoryStatus.DRAFT })
      .groupBy('s.publicationStatus')
      .addGroupBy('s.accessType')
      .getRawMany<{ status: StoryStatus; access: AccessType; count: string; views: string }>();

    const summary = this.summarise(rows);
    const free = rows.filter((r) => r.access === AccessType.FREE).reduce((n, r) => n + Number(r.count), 0);
    const premium = rows.filter((r) => r.access === AccessType.PREMIUM).reduce((n, r) => n + Number(r.count), 0);
    return { ...summary, free, premium };
  }

  async listAuthors(): Promise<Array<{ id: string; fullName: string; penName: string | null; email: string }>> {
    const rows = await this.roles.find({ where: { role: UserRole.AUTHOR }, relations: { user: true } });
    return rows
      .filter((r) => r.user && r.user.isActive)
      .map((r) => ({ id: r.user.id, fullName: r.user.fullName, penName: r.user.penName, email: r.user.email }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async countUsersWithRole(role: UserRole): Promise<number> {
    return this.roles.count({ where: { role } });
  }

  // ---------- book export (admin) ----------

  /** Published version of a story as a book-style PDF, the same content readers see. */
  async exportBook(id: string): Promise<{ filename: string; buffer: Buffer }> {
    const story = await this.withRelations().where('s.id = :id', { id }).getOne();
    if (!story) {
      throw new NotFoundException(t('stories.notFound'));
    }
    const snapshot = story.publishedSnapshot;
    if (!snapshot) {
      throw new ConflictException(t('stories.notPublished'));
    }
    const buffer = await buildBookPdf(
      {
        title: snapshot.title,
        description: snapshot.description,
        coverImageUrl: snapshot.coverImageUrl,
        authorName: story.author?.penName || story.author?.fullName || '',
        categoryName: story.category?.name ?? '',
        languageName: story.language?.name ?? '',
        pages: snapshot.pages,
      },
      {
        fontPath: resolve(this.cfg.pdf.fontPath),
        pageSize: this.cfg.pdf.pageSize,
        marginMm: this.cfg.pdf.marginMm,
        uploadDirectory: resolve(this.cfg.upload.directory),
      },
    );
    return { filename: `${story.slug}.pdf`, buffer };
  }

  // ---------- internals ----------

  private isAdmin(actor: AuthenticatedUser): boolean {
    return actor.roles.includes(UserRole.ADMIN);
  }

  /** An author's draft is hidden from the admin until it is submitted. */
  private visibleToAdmin(story: Story): boolean {
    return story.publicationStatus !== StoryStatus.DRAFT || story.submittedAt !== null;
  }

  private systemActor(userId: string): AuthenticatedUser {
    return { id: userId, email: '', roles: [UserRole.AUTHOR], sessionId: '' };
  }

  private withRelations(): SelectQueryBuilder<Story> {
    return this.stories
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.author', 'author')
      .leftJoinAndSelect('s.category', 'category')
      .leftJoinAndSelect('s.language', 'language');
  }

  /** Loads a story the actor may access. Authors get 404 for other authors' stories, so ids are not leaked. */
  private async getOwnedStory(id: string, actor: AuthenticatedUser, m?: EntityManager): Promise<Story> {
    const repo = m ? m.getRepository(Story) : this.stories;
    const story = await repo.findOne({ where: { id } });
    if (!story || (!this.isAdmin(actor) && story.authorId !== actor.id)) {
      throw new NotFoundException(t('stories.notFound'));
    }
    if (this.isAdmin(actor) && !this.visibleToAdmin(story)) {
      throw new NotFoundException(t('stories.notFound'));
    }
    return story;
  }

  private assertEditable(story: Story, actor: AuthenticatedUser): void {
    if (this.isAdmin(actor)) return;
    if (!AUTHOR_EDITABLE.includes(story.publicationStatus)) {
      throw new ConflictException(t('stories.notEditable'));
    }
  }

  private assertTransition(story: Story, allowedFrom: StoryStatus[]): void {
    if (!allowedFrom.includes(story.publicationStatus)) {
      throw new ConflictException(t('stories.invalidTransition', { status: story.publicationStatus }));
    }
  }

  /**
   * Any content change by an author on a published story sends it back for approval.
   * Admin edits apply immediately, and the public snapshot is refreshed if the story is live.
   */
  private async applyContentChange(m: EntityManager, story: Story, actor: AuthenticatedUser): Promise<void> {
    if (this.isAdmin(actor)) {
      if (story.publicationStatus === StoryStatus.PUBLISHED) {
        story.publishedSnapshot = await this.buildSnapshot(m, story);
      }
      return;
    }
    if (story.publicationStatus === StoryStatus.PUBLISHED) {
      story.publicationStatus = StoryStatus.PENDING_APPROVAL;
    } else if (story.publicationStatus === StoryStatus.REJECTED) {
      story.publicationStatus = StoryStatus.DRAFT;
      story.rejectionReason = null;
    }
  }

  private async buildSnapshot(m: EntityManager, story: Story): Promise<PublishedSnapshot> {
    const pages = await m.find(StoryPage, { where: { storyId: story.id }, order: { pageNumber: 'ASC' } });
    return {
      title: story.title,
      description: story.description,
      coverImageUrl: story.coverImageUrl,
      publishedAt: new Date().toISOString(),
      pages: pages.map((p) => ({ pageNumber: p.pageNumber, title: p.title, content: p.content })),
    };
  }

  private async renumber(m: EntityManager, ordered: StoryPage[]): Promise<void> {
    for (let i = 0; i < ordered.length; i++) {
      await m.update(StoryPage, ordered[i].id, { pageNumber: TEMP_PAGE_OFFSET + i + 1 });
    }
    for (let i = 0; i < ordered.length; i++) {
      await m.update(StoryPage, ordered[i].id, { pageNumber: i + 1, displayOrder: i + 1 });
    }
  }

  private async requirePages(storyId: string, m?: EntityManager): Promise<void> {
    const repo = m ? m.getRepository(StoryPage) : this.pages;
    if ((await repo.count({ where: { storyId } })) === 0) {
      throw new BadRequestException(t('stories.needsPages'));
    }
  }

  private sanitizeContent(html: string): string {
    if (html.length > this.cfg.stories.maxPageContentLength) {
      throw new BadRequestException(t('stories.contentTooLong', { max: this.cfg.stories.maxPageContentLength }));
    }
    return this.sanitizer.sanitizeStoryHtml(html);
  }

  private async assertCategoryAndLanguage(categoryId: string, languageId: string): Promise<void> {
    if (!(await this.categories.findOne({ where: { id: categoryId, isActive: true } }))) {
      throw new BadRequestException(t('stories.categoryInvalid'));
    }
    if (!(await this.languages.findOne({ where: { id: languageId, isActive: true } }))) {
      throw new BadRequestException(t('stories.languageInvalid'));
    }
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title, 'story');
    let slug = base;
    let n = 2;
    while (await this.stories.exists({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  private async pageCounts(storyIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (storyIds.length === 0) return result;
    const rows = await this.pages
      .createQueryBuilder('p')
      .select('p.storyId', 'storyId')
      .addSelect('COUNT(*)', 'count')
      .where('p.storyId IN (:...storyIds)', { storyIds })
      .groupBy('p.storyId')
      .getRawMany<{ storyId: string; count: string }>();
    for (const row of rows) result.set(row.storyId, Number(row.count));
    return result;
  }

  private pageCountOf(storyId: string): Promise<number> {
    return this.pages.count({ where: { storyId } });
  }

  private summarise(rows: Array<{ status: StoryStatus; count: string; views: string }>) {
    const byStatus = (status: StoryStatus) =>
      rows.filter((r) => r.status === status).reduce((n, r) => n + Number(r.count), 0);
    return {
      total: rows.reduce((n, r) => n + Number(r.count), 0),
      draft: byStatus(StoryStatus.DRAFT),
      pending: byStatus(StoryStatus.PENDING_APPROVAL),
      published: byStatus(StoryStatus.PUBLISHED),
      rejected: byStatus(StoryStatus.REJECTED),
      archived: byStatus(StoryStatus.ARCHIVED),
      views: rows.reduce((n, r) => n + Number(r.views), 0),
    };
  }

  toDto(row: Story, pageCount: number): StoryDto {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      coverImageUrl: row.coverImageUrl,
      publicationStatus: row.publicationStatus,
      accessType: row.accessType,
      pricePaise: row.pricePaise,
      freePreviewPages: row.freePreviewPages,
      isFeatured: row.isFeatured,
      viewCount: row.viewCount,
      pageCount,
      authorId: row.authorId,
      authorName: row.author?.penName ?? row.author?.fullName ?? '',
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? '',
      languageId: row.languageId,
      languageName: row.language?.name ?? '',
      rejectionReason: row.rejectionReason,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  }

  private toPageDto(row: StoryPage): StoryPageDto {
    return {
      id: row.id,
      pageNumber: row.pageNumber,
      title: row.title,
      content: row.content,
      updatedAt: row.updatedAt,
    };
  }
}
