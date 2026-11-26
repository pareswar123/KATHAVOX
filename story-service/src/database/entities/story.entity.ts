import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Category, Language } from './catalog.entity';

export enum AccessType {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}

export enum StoryStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  REJECTED = 'REJECTED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/** Approved content served to readers. Pending author edits never change this until approval. */
export interface SnapshotPage {
  pageNumber: number;
  title: string;
  content: string;
}

export interface PublishedSnapshot {
  title: string;
  description: string;
  coverImageUrl: string | null;
  publishedAt: string;
  pages: SnapshotPage[];
}

@Entity('stories')
@Index('IDX_stories_status_published', ['publicationStatus', 'publishedAt'])
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'language_id', type: 'uuid' })
  languageId: string;

  @ManyToOne(() => Language, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'language_id' })
  language: Language;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Index('UQ_stories_slug', { unique: true })
  @Column({ type: 'varchar', length: 220 })
  slug: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ name: 'cover_image_url', type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ name: 'access_type', type: 'enum', enum: AccessType, default: AccessType.FREE })
  accessType: AccessType;

  /** Integer paise (1 INR = 100 paise). Never a float. */
  @Column({ name: 'price_paise', type: 'integer', default: 0 })
  pricePaise: number;

  @Column({ name: 'free_preview_pages', type: 'integer', default: 2 })
  freePreviewPages: number;

  @Column({
    name: 'publication_status',
    type: 'enum',
    enum: StoryStatus,
    default: StoryStatus.DRAFT,
  })
  publicationStatus: StoryStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'seo_title', type: 'varchar', length: 255, nullable: true })
  seoTitle: string | null;

  @Column({ name: 'seo_description', type: 'varchar', length: 320, nullable: true })
  seoDescription: string | null;

  @Column({ name: 'published_snapshot', type: 'jsonb', nullable: true })
  publishedSnapshot: PublishedSnapshot | null;

  /**
   * First time the story was sent to the admin (author submit, or created by admin).
   * Author drafts with no value stay hidden from the admin until submitted.
   */
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('story_pages')
@Unique('UQ_story_pages_story_page', ['storyId', 'pageNumber'])
export class StoryPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_story_pages_story')
  @Column({ name: 'story_id', type: 'uuid' })
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'story_id' })
  story: Story;

  @Column({ name: 'page_number', type: 'integer' })
  pageNumber: number;

  @Column({ type: 'varchar', length: 200, default: '' })
  title: string;

  /** Sanitized HTML, stored as TEXT. */
  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ name: 'display_order', type: 'integer' })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
