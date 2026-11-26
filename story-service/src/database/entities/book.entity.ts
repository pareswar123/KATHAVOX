import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { AccessType, Story } from './story.entity';
import { PurchaseStatus } from './commerce.entity';

export enum BookStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  UNPUBLISHED = 'UNPUBLISHED',
}

/** One story as it was when the book was published. Readers see only this copy. */
export interface BookSnapshotStory {
  storyId: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  authorName: string;
  categoryName: string;
  languageName: string;
  pages: { pageNumber: number; title: string; content: string }[];
  /** First and last page of this story inside the book PDF (measured when the book is published). */
  pageStart: number;
  pageEnd: number;
}

export interface BookSnapshot {
  title: string;
  description: string;
  coverImageUrl: string | null;
  publishedAt: string;
  stories: BookSnapshotStory[];
}

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_books_slug', { unique: true })
  @Column({ type: 'varchar', length: 220 })
  slug: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ name: 'cover_image_url', type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ name: 'access_type', type: 'enum', enum: AccessType, default: AccessType.FREE })
  accessType: AccessType;

  /** Integer paise. Used for new purchases only; existing buyers keep access when the price changes. */
  @Column({ name: 'price_paise', type: 'integer', default: 0 })
  pricePaise: number;

  @Column({ type: 'enum', enum: BookStatus, default: BookStatus.DRAFT })
  status: BookStatus;

  @Column({ name: 'published_snapshot', type: 'jsonb', nullable: true })
  publishedSnapshot: BookSnapshot | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('book_stories')
@Unique('UQ_book_stories_book_story', ['bookId', 'storyId'])
export class BookStory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_book_stories_book')
  @Column({ name: 'book_id', type: 'uuid' })
  bookId: string;

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column({ name: 'story_id', type: 'uuid' })
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'story_id' })
  story: Story;

  /** Order of the story inside the book, starting at 1. */
  @Column({ type: 'integer' })
  position: number;
}

@Entity('book_purchases')
@Unique('UQ_book_purchases_user_book', ['userId', 'bookId'])
export class BookPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'book_id', type: 'uuid' })
  bookId: string;

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ type: 'enum', enum: PurchaseStatus, default: PurchaseStatus.ACTIVE })
  status: PurchaseStatus;

  @CreateDateColumn({ name: 'purchased_at', type: 'timestamptz' })
  purchasedAt: Date;
}
