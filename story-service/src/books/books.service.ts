import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { resolve } from 'node:path';
import { DataSource, EntityManager, In, MoreThan, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.decorators';
import { paginate, resolvePage } from '../common/pagination';
import { slugify } from '../common/slug';
import { AppConfig } from '../config/app-config';
import {
  AccessType,
  PurchaseStatus,
  Story,
  StoryStatus,
  SubscriptionStatus,
  UserSubscription,
} from '../database/entities';
import { Book, BookPurchase, BookSnapshot, BookSnapshotStory, BookStatus, BookStory } from '../database/entities/book.entity';
import { t } from '../i18n/i18n';
import { buildBookEdition, EditionInput } from '../stories/pdf/book-edition.builder';
import { BookCreateDto, BookListQueryDto, BookUpdateDto } from './dto/book.dto';

export type BookAccessVia = 'FREE' | 'PURCHASED' | 'SUBSCRIPTION';

/** Books hold the approved snapshot of each story. Readers only see the index; pages come from the story reader. */
@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book) private readonly books: Repository<Book>,
    @InjectRepository(BookStory) private readonly bookStories: Repository<BookStory>,
    @InjectRepository(BookPurchase) private readonly bookPurchases: Repository<BookPurchase>,
    @InjectRepository(Story) private readonly stories: Repository<Story>,
    @InjectRepository(UserSubscription) private readonly subscriptions: Repository<UserSubscription>,
    private readonly dataSource: DataSource,
    private readonly cfg: AppConfig,
  ) {}

  // ---------- admin ----------

  /** Published stories the admin may add to a book. Other stories cannot be picked. */
  async storyOptions() {
    const rows = await this.stories.find({
      where: { publicationStatus: StoryStatus.PUBLISHED },
      relations: ['author'],
      order: { title: 'ASC' },
    });
    return rows
      .filter((s) => s.publishedSnapshot)
      .map((s) => ({ id: s.id, title: s.title, slug: s.slug, authorName: s.author?.penName || s.author?.fullName || '' }));
  }

  async adminList(query: BookListQueryDto) {
    const resolved = resolvePage(query, this.cfg);
    const where = query.status ? { status: query.status } : {};
    const [rows, total] = await this.books.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: resolved.skip,
      take: resolved.limit,
    });
    const counts = await this.countStories(rows.map((b) => b.id));
    return paginate(
      rows.map((b) => this.card(b, counts.get(b.id) ?? 0)),
      total,
      resolved,
    );
  }

  async adminDetail(id: string) {
    const book = await this.findBook(id);
    const items = await this.bookStories.find({ where: { bookId: book.id }, relations: ['story'], order: { position: 'ASC' } });
    return this.detail(book, items);
  }

  async create(dto: BookCreateDto) {
    const id = await this.dataSource.transaction(async (m) => {
      const price = this.priceFor(dto.accessType, dto.pricePaise);
      const storyIds = await this.assertPublishedStories(dto.storyIds, m);
      const book = await m.save(
        m.create(Book, {
          slug: await this.uniqueSlug(dto.title, m),
          title: dto.title.trim(),
          description: dto.description ?? '',
          coverImageUrl: dto.coverImageUrl ?? null,
          accessType: dto.accessType,
          pricePaise: price,
          status: BookStatus.DRAFT,
          publishedSnapshot: null,
        }),
      );
      await m.save(storyIds.map((storyId, i) => m.create(BookStory, { bookId: book.id, storyId, position: i + 1 })));
      return book.id;
    });
    return this.adminDetail(id);
  }

  async update(id: string, dto: BookUpdateDto) {
    await this.dataSource.transaction(async (m) => {
      const book = await m.findOne(Book, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!book) throw new NotFoundException(t('books.notFound'));

      if (dto.title !== undefined) book.title = dto.title.trim();
      if (dto.description !== undefined) book.description = dto.description;
      if (dto.coverImageUrl !== undefined) book.coverImageUrl = dto.coverImageUrl;
      const accessType = dto.accessType ?? book.accessType;
      const pricePaise = dto.pricePaise ?? book.pricePaise;
      book.accessType = accessType;
      book.pricePaise = this.priceFor(accessType, pricePaise);

      if (dto.storyIds) {
        const storyIds = await this.assertPublishedStories(dto.storyIds, m);
        await m.delete(BookStory, { bookId: book.id });
        await m.save(storyIds.map((storyId, i) => m.create(BookStory, { bookId: book.id, storyId, position: i + 1 })));
      }

      // A published book is live: its snapshot is rebuilt on every change, so readers see the edit at once.
      if (book.status === BookStatus.PUBLISHED) {
        book.publishedSnapshot = await this.buildSnapshot(book, m);
      }
      await m.save(book);
    });
    return this.adminDetail(id);
  }

  /** Makes a draft or unpublished book visible. Every story must still be published. */
  async publish(id: string) {
    await this.dataSource.transaction(async (m) => {
      const book = await this.findBookIn(m, id);
      if (book.status === BookStatus.PUBLISHED) throw new ConflictException(t('books.alreadyPublished'));
      book.publishedSnapshot = await this.buildSnapshot(book, m);
      book.status = BookStatus.PUBLISHED;
      book.publishedAt = new Date();
      await m.save(book);
    });
    return this.adminDetail(id);
  }

  async unpublish(id: string) {
    const book = await this.findBook(id);
    if (book.status !== BookStatus.PUBLISHED) throw new ConflictException(t('books.notPublished'));
    book.status = BookStatus.UNPUBLISHED;
    await this.books.save(book);
    return this.adminDetail(id);
  }

  async remove(id: string): Promise<void> {
    const book = await this.findBook(id);
    if (book.status !== BookStatus.DRAFT) throw new ConflictException(t('books.notDeletable'));
    await this.books.delete(book.id);
  }

  /** Book PDF from the approved snapshot, the same content readers see. */
  async pdf(id: string): Promise<{ filename: string; buffer: Buffer }> {
    const book = await this.findBook(id);
    if (!book.publishedSnapshot) throw new ConflictException(t('books.notPublishedYet'));
    const { buffer } = await buildBookEdition(this.editionInput(book.publishedSnapshot), this.pdfOptions());
    return { filename: `${book.slug}.pdf`, buffer };
  }

  // ---------- public and reader ----------

  async publicList(query: BookListQueryDto) {
    const resolved = resolvePage(query, this.cfg);
    const [rows, total] = await this.books.findAndCount({
      where: { status: BookStatus.PUBLISHED },
      order: { publishedAt: 'DESC' },
      skip: resolved.skip,
      take: resolved.limit,
    });
    return paginate(
      rows.map((b) => ({
        slug: b.slug,
        title: b.title,
        coverImageUrl: b.coverImageUrl,
        accessType: b.accessType,
        pricePaise: b.pricePaise,
        storyCount: b.publishedSnapshot?.stories.length ?? 0,
      })),
      total,
      resolved,
    );
  }

  /** Index of a published book. Anyone may see it; the stories are readable only with access. */
  async publicGet(slug: string, user?: AuthenticatedUser) {
    const book = await this.books.findOne({ where: { slug, status: BookStatus.PUBLISHED } });
    if (!book || !book.publishedSnapshot) throw new NotFoundException(t('books.notFound'));
    const access = await this.accessFor(book, user);
    return {
      id: book.id,
      slug: book.slug,
      title: book.title,
      description: book.description,
      coverImageUrl: book.coverImageUrl,
      accessType: book.accessType,
      pricePaise: book.pricePaise,
      access,
      stories: book.publishedSnapshot.stories.map((s) => ({
        slug: s.slug,
        title: s.title,
        pageStart: s.pageStart,
        pageEnd: s.pageEnd,
        pageCount: s.pages.length,
      })),
    };
  }

  /** Books a reader can open: bought books, and every published book while a subscription is active. */
  async libraryFor(user: AuthenticatedUser) {
    const purchases = await this.bookPurchases.find({
      where: { userId: user.id, status: PurchaseStatus.ACTIVE },
      relations: ['book'],
    });
    const subscribed = await this.hasActiveSubscription(user.id);
    const seen = new Map<string, { slug: string; title: string; coverImageUrl: string | null; via: BookAccessVia }>();
    for (const p of purchases) {
      if (p.book && p.book.status === BookStatus.PUBLISHED) {
        seen.set(p.book.id, { slug: p.book.slug, title: p.book.title, coverImageUrl: p.book.coverImageUrl, via: 'PURCHASED' });
      }
    }
    if (subscribed) {
      const all = await this.books.find({ where: { status: BookStatus.PUBLISHED } });
      for (const b of all) {
        if (!seen.has(b.id)) seen.set(b.id, { slug: b.slug, title: b.title, coverImageUrl: b.coverImageUrl, via: 'SUBSCRIPTION' });
      }
    }
    return [...seen.values()];
  }

  /**
   * Whether a reader may open a story through a book. True when the story is in a published book
   * the reader can open: a free book, a book they bought, or any book while their subscription is active.
   */
  async canReadStoryViaBooks(user: AuthenticatedUser | undefined, storyId: string): Promise<boolean> {
    const links = await this.bookStories.find({ where: { storyId }, relations: ['book'] });
    for (const link of links) {
      if (!link.book || link.book.status !== BookStatus.PUBLISHED) continue;
      const access = await this.accessFor(link.book, user);
      if (access.readable) return true;
    }
    return false;
  }

  // ---------- internals ----------

  private async accessFor(book: Book, user?: AuthenticatedUser): Promise<{ readable: boolean; via: BookAccessVia | null }> {
    if (book.accessType === AccessType.FREE) return { readable: true, via: 'FREE' };
    if (!user) return { readable: false, via: null };
    if (await this.bookPurchases.findOne({ where: { userId: user.id, bookId: book.id, status: PurchaseStatus.ACTIVE } })) {
      return { readable: true, via: 'PURCHASED' };
    }
    if (await this.hasActiveSubscription(user.id)) return { readable: true, via: 'SUBSCRIPTION' };
    return { readable: false, via: null };
  }

  private hasActiveSubscription(userId: string): Promise<boolean> {
    return this.subscriptions
      .findOne({ where: { userId, status: SubscriptionStatus.ACTIVE, endDate: MoreThan(new Date()) } })
      .then((row) => row !== null);
  }

  /** Checks the stories exist, are published, and are not repeated. Returns them in the given order. */
  private async assertPublishedStories(ids: string[], m: EntityManager): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) throw new BadRequestException(t('books.duplicateStory'));
    const rows = await m.find(Story, { where: { id: In(unique), publicationStatus: StoryStatus.PUBLISHED } });
    if (rows.length !== unique.length) throw new BadRequestException(t('books.storyNotPublished'));
    return unique;
  }

  private priceFor(accessType: AccessType, pricePaise: number | undefined): number {
    if (accessType === AccessType.FREE) return 0;
    if (!pricePaise || pricePaise <= 0) throw new BadRequestException(t('books.priceRequired'));
    return pricePaise;
  }

  /** Builds the book snapshot and measures where each story starts inside the PDF. */
  private async buildSnapshot(book: Book, m: EntityManager): Promise<BookSnapshot> {
    const links = await m.find(BookStory, { where: { bookId: book.id }, order: { position: 'ASC' } });
    if (links.length === 0) throw new BadRequestException(t('books.noStories'));
    const storyRows = await m.find(Story, {
      where: { id: In(links.map((l) => l.storyId)) },
      relations: ['author', 'category', 'language'],
    });
    const byId = new Map(storyRows.map((s) => [s.id, s]));
    const stories: Omit<BookSnapshotStory, 'pageStart' | 'pageEnd'>[] = links.map((link) => {
      const story = byId.get(link.storyId);
      if (!story || story.publicationStatus !== StoryStatus.PUBLISHED || !story.publishedSnapshot) {
        throw new ConflictException(t('books.storyNotPublished'));
      }
      const snap = story.publishedSnapshot;
      return {
        storyId: story.id,
        slug: story.slug,
        title: snap.title,
        description: snap.description,
        coverImageUrl: snap.coverImageUrl,
        authorName: story.author?.penName || story.author?.fullName || '',
        categoryName: story.category?.name ?? '',
        languageName: story.language?.name ?? '',
        pages: snap.pages,
      };
    });

    const draft: BookSnapshot = {
      title: book.title,
      description: book.description,
      coverImageUrl: book.coverImageUrl,
      publishedAt: new Date().toISOString(),
      stories: stories.map((s) => ({ ...s, pageStart: 0, pageEnd: 0 })),
    };
    const { ranges } = await buildBookEdition(this.editionInput(draft), this.pdfOptions());
    draft.stories = draft.stories.map((s, i) => ({ ...s, pageStart: ranges[i].pageStart, pageEnd: ranges[i].pageEnd }));
    return draft;
  }

  private editionInput(snapshot: BookSnapshot): EditionInput {
    return {
      title: snapshot.title,
      description: snapshot.description,
      coverImageUrl: snapshot.coverImageUrl,
      stories: snapshot.stories.map((s) => ({
        title: s.title,
        description: s.description,
        coverImageUrl: s.coverImageUrl,
        authorName: s.authorName,
        categoryName: s.categoryName,
        languageName: s.languageName,
        pages: s.pages,
      })),
    };
  }

  private pdfOptions() {
    return {
      fontPath: resolve(this.cfg.pdf.fontPath),
      pageSize: this.cfg.pdf.pageSize,
      marginMm: this.cfg.pdf.marginMm,
      uploadDirectory: resolve(this.cfg.upload.directory),
    };
  }

  private async findBook(id: string): Promise<Book> {
    const book = await this.books.findOne({ where: { id } });
    if (!book) throw new NotFoundException(t('books.notFound'));
    return book;
  }

  private async findBookIn(m: EntityManager, id: string): Promise<Book> {
    const book = await m.findOne(Book, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!book) throw new NotFoundException(t('books.notFound'));
    return book;
  }

  private async countStories(bookIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (bookIds.length === 0) return counts;
    const links = await this.bookStories.find({ where: { bookId: In(bookIds) } });
    for (const link of links) counts.set(link.bookId, (counts.get(link.bookId) ?? 0) + 1);
    return counts;
  }

  private async uniqueSlug(title: string, m: EntityManager): Promise<string> {
    const base = slugify(title, 'book');
    let slug = base;
    let n = 2;
    while (await m.findOne(Book, { where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  private card(book: Book, storyCount: number) {
    return {
      id: book.id,
      slug: book.slug,
      title: book.title,
      coverImageUrl: book.coverImageUrl,
      accessType: book.accessType,
      pricePaise: book.pricePaise,
      status: book.status,
      publishedAt: book.publishedAt,
      updatedAt: book.updatedAt,
      storyCount,
    };
  }

  private detail(book: Book, items: BookStory[]) {
    const snapshotByStory = new Map((book.publishedSnapshot?.stories ?? []).map((s) => [s.storyId, s]));
    return {
      ...this.card(book, items.length),
      description: book.description,
      stories: items.map((link) => {
        const live = link.story;
        const snap = snapshotByStory.get(link.storyId);
        return {
          storyId: link.storyId,
          position: link.position,
          title: live?.title ?? snap?.title ?? '',
          slug: live?.slug ?? snap?.slug ?? '',
          storyStatus: live?.publicationStatus ?? null,
          pageCount: snap?.pages.length ?? 0,
          pageStart: snap?.pageStart ?? null,
          pageEnd: snap?.pageEnd ?? null,
        };
      }),
    };
  }
}
