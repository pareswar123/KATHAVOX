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
import { Story } from './story.entity';

export enum PurchaseStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

@Entity('story_purchases')
@Unique('UQ_story_purchases_user_story', ['userId', 'storyId'])
export class StoryPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'story_id', type: 'uuid' })
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'story_id' })
  story: Story;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ name: 'purchase_price_paise', type: 'integer' })
  purchasePricePaise: number;

  @Column({ type: 'enum', enum: PurchaseStatus, default: PurchaseStatus.ACTIVE })
  status: PurchaseStatus;

  @CreateDateColumn({ name: 'purchased_at', type: 'timestamptz' })
  purchasedAt: Date;
}

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ name: 'price_paise', type: 'integer' })
  pricePaise: number;

  @Column({ name: 'duration_days', type: 'integer' })
  durationDays: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

@Entity('user_subscriptions')
@Index('IDX_user_subscriptions_user_end', ['userId', 'endDate'])
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => SubscriptionPlan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate: Date;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

export enum PaymentType {
  STORY_PURCHASE = 'STORY_PURCHASE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  BOOK_PURCHASE = 'BOOK_PURCHASE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Set when the buyer is a known account; orders can exist before an account does. */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'checkout_email', type: 'varchar', length: 255 })
  checkoutEmail: string;

  @Column({ name: 'purchase_type', type: 'enum', enum: PaymentType })
  purchaseType: PaymentType;

  @Column({ name: 'story_id', type: 'uuid', nullable: true })
  storyId: string | null;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ name: 'book_id', type: 'uuid', nullable: true })
  bookId: string | null;

  /** Integer paise, calculated on the server only. */
  @Column({ name: 'amount_paise', type: 'integer' })
  amountPaise: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Index('UQ_payments_provider_order', { unique: true })
  @Column({ name: 'provider_order_id', type: 'varchar', length: 100 })
  providerOrderId: string;

  @Index('UQ_payments_provider_payment', { unique: true })
  @Column({ name: 'provider_payment_id', type: 'varchar', length: 100, nullable: true })
  providerPaymentId: string | null;

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;
}

@Entity('reading_progress')
@Unique('UQ_reading_progress_user_story', ['userId', 'storyId'])
export class ReadingProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'story_id', type: 'uuid' })
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'story_id' })
  story: Story;

  @Column({ name: 'last_page_number', type: 'integer', default: 1 })
  lastPageNumber: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('story_views_daily')
@Unique('UQ_story_views_daily_story_day', ['storyId', 'day'])
export class StoryViewDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'story_id', type: 'uuid' })
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'story_id' })
  story: Story;

  @Column({ type: 'date' })
  day: string;

  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount: number;
}
