import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import { DataSource, EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { AppConfig } from '../config/app-config';
import { hashToken, generateOpaqueToken } from '../common/token.util';
import {
  AccessType,
  Payment,
  PaymentStatus,
  PaymentType,
  PurchaseStatus,
  Story,
  StoryPurchase,
  StoryStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
  UserRole,
  UserRoleEntity,
  UserSubscription,
  VerificationToken,
  VerificationTokenType,
} from '../database/entities';
import { t } from '../i18n/i18n';
import { MailService } from '../mail/mail.service';
import { paginate, resolvePage } from '../common/pagination';
import * as XLSX from 'xlsx';
import { AdminPaymentsQueryDto } from './dto/admin-payments.dto';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';

const SET_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

interface GrantResult {
  purchaseType: PaymentType;
  accountCreated: boolean;
  setPasswordEmail: { to: string; link: string } | null;
}

/**
 * Razorpay test-mode payments. Amounts come from the database, a payment is confirmed only after
 * signature and capture checks, and granting access is idempotent.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Story) private readonly stories: Repository<Story>,
    @InjectRepository(StoryPurchase) private readonly purchases: Repository<StoryPurchase>,
    @InjectRepository(SubscriptionPlan) private readonly plans: Repository<SubscriptionPlan>,
    @InjectRepository(UserSubscription) private readonly subscriptions: Repository<UserSubscription>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserRoleEntity) private readonly roles: Repository<UserRoleEntity>,
    private readonly dataSource: DataSource,
    private readonly cfg: AppConfig,
    private readonly mail: MailService,
  ) {}

  // ---------- create order ----------

  async createOrder(dto: CreateOrderDto) {
    const email = dto.checkoutEmail.trim().toLowerCase();
    const { amountPaise, storyId, planId } = await this.priceFor(dto, email);
    const client = this.client();

    let order: { id: string };
    try {
      order = await client.orders.create({
        amount: amountPaise,
        currency: this.cfg.razorpay.currency,
        receipt: `kv_${randomUUID().slice(0, 8)}`,
      });
    } catch (err: unknown) {
      // Razorpay answers 401 when the key ID or secret is wrong.
      if ((err as { statusCode?: number })?.statusCode === 401) {
        throw new ServiceUnavailableException(t('payments.keysRejected'));
      }
      throw err;
    }

    const payment = await this.payments.save(
      this.payments.create({
        userId: null,
        checkoutEmail: email,
        purchaseType: dto.purchaseType,
        storyId,
        planId,
        amountPaise,
        currency: this.cfg.razorpay.currency,
        providerOrderId: order.id,
        paymentStatus: PaymentStatus.PENDING,
      }),
    );

    return {
      orderId: order.id,
      keyId: this.cfg.razorpay.keyId,
      amount: amountPaise,
      currency: this.cfg.razorpay.currency,
      paymentId: payment.id,
    };
  }

  // ---------- verify (after checkout in the browser) ----------

  async verify(dto: VerifyPaymentDto) {
    if (!this.signatureMatches(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`, dto.razorpay_signature, this.cfg.razorpay.keySecret)) {
      throw new BadRequestException(t('payments.invalidSignature'));
    }

    const payment = await this.payments.findOne({ where: { providerOrderId: dto.razorpay_order_id } });
    if (!payment) throw new NotFoundException(t('payments.orderNotFound'));
    if (payment.paymentStatus === PaymentStatus.SUCCESS) {
      return { status: 'ALREADY_GRANTED', purchaseType: payment.purchaseType };
    }

    const captured = await this.client().payments.fetch(dto.razorpay_payment_id);
    if (captured.status !== 'captured') throw new BadRequestException(t('payments.notCaptured'));
    if (Number(captured.amount) !== payment.amountPaise || captured.currency !== payment.currency) {
      throw new BadRequestException(t('payments.amountMismatch'));
    }

    const result = await this.dataSource.transaction((m) => this.grant(m, payment.id, dto.razorpay_payment_id));
    await this.sendSetPasswordEmail(result);
    return { status: 'GRANTED', purchaseType: result.purchaseType, accountCreated: result.accountCreated };
  }

  // ---------- admin: revenue summary and payment list ----------

  private readonly DAY_MS = 24 * 60 * 60 * 1000;

  private offsetMs(): number {
    return this.cfg.payments.utcOffsetMinutes * 60_000;
  }

  /** Start of a calendar day (YYYY-MM-DD) in the configured offset, as a UTC instant. */
  private dayStart(day: string): Date {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d) - this.offsetMs());
  }

  private today(): string {
    return new Date(Date.now() + this.offsetMs()).toISOString().slice(0, 10);
  }

  private monthStart(): Date {
    const local = new Date(Date.now() + this.offsetMs());
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - this.offsetMs());
  }

  /** Figures for the admin dashboard, from recorded payments (successful ones only). */
  async revenueSummary() {
    const sumSuccess = (from?: Date) => {
      const qb = this.payments
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amountPaise), 0)', 'paise')
        .where('p.paymentStatus = :ok', { ok: PaymentStatus.SUCCESS });
      if (from) qb.andWhere('p.paidAt >= :from', { from });
      return qb.getRawOne<{ paise: string }>().then((r) => Number(r?.paise ?? 0));
    };
    const [totalRevenuePaise, monthlyRevenuePaise, purchases, activeSubscriptions] = await Promise.all([
      sumSuccess(),
      sumSuccess(this.monthStart()),
      this.payments.count({ where: { paymentStatus: PaymentStatus.SUCCESS, purchaseType: PaymentType.STORY_PURCHASE } }),
      this.subscriptions.count({ where: { status: SubscriptionStatus.ACTIVE, endDate: MoreThan(new Date()) } }),
    ]);
    return {
      totalRevenuePaise,
      monthlyRevenuePaise,
      purchases,
      activeSubscriptions,
      paymentsEnabled: Boolean(this.cfg.razorpay.keyId && this.cfg.razorpay.keySecret),
    };
  }

  /** Filter shared by the admin list and the Excel export: day range (default today), status and type. */
  private adminFilter(query: AdminPaymentsQueryDto) {
    const from = query.from ?? this.today();
    const to = query.to ?? from;
    const when = 'COALESCE(p.paidAt, p.createdAt)';

    const qb = this.payments
      .createQueryBuilder('p')
      .leftJoin(Story, 's', 's.id = p.storyId')
      .leftJoin(SubscriptionPlan, 'pl', 'pl.id = p.planId')
      .where(`${when} >= :start`, { start: this.dayStart(from) })
      .andWhere(`${when} < :end`, { end: new Date(this.dayStart(to).getTime() + this.DAY_MS) });
    if (query.status && query.status !== 'ALL') qb.andWhere('p.paymentStatus = :status', { status: query.status });
    if (query.type && query.type !== 'ALL') qb.andWhere('p.purchaseType = :type', { type: query.type });
    return { qb, when, from, to };
  }

  /** Payments for the admin list, filtered by day range, status and type. Defaults to today. */
  async listForAdmin(query: AdminPaymentsQueryDto) {
    const { qb, when, from, to } = this.adminFilter(query);
    const resolved = resolvePage(query, this.cfg);
    const [rows, total, successSum] = await Promise.all([
      qb
        .clone()
        .select([
          'p.id AS id',
          `${when} AS "occurredAt"`,
          'p.purchaseType AS type',
          's.title AS "storyTitle"',
          'pl.name AS "planName"',
          'p.checkoutEmail AS "buyerEmail"',
          'p.amountPaise AS "amountPaise"',
          'p.paymentStatus AS status',
          'p.providerOrderId AS "orderId"',
          'p.providerPaymentId AS "paymentId"',
        ])
        .orderBy(when, 'DESC')
        .offset(resolved.skip)
        .limit(resolved.limit)
        .getRawMany<Record<string, unknown>>(),
      qb.clone().getCount(),
      qb
        .clone()
        .select('COALESCE(SUM(p.amountPaise), 0)', 'paise')
        .andWhere('p.paymentStatus = :ok', { ok: PaymentStatus.SUCCESS })
        .getRawOne<{ paise: string }>(),
    ]);

    const items = rows.map((r) => ({
      id: String(r.id),
      occurredAt: r.occurredAt,
      type: r.type,
      item: (r.storyTitle as string | null) ?? (r.planName as string | null) ?? '',
      buyerEmail: r.buyerEmail,
      amountPaise: Number(r.amountPaise),
      status: r.status,
      orderId: r.orderId,
      paymentId: r.paymentId ?? null,
    }));
    return {
      ...paginate(items, total, resolved),
      range: { from, to },
      totals: { rows: total, successPaise: Number(successSum?.paise ?? 0) },
    };
  }

  /** Date and time for the spreadsheet, in the configured offset, in the same format as the screen. */
  private formatLocal(value: Date | string): string {
    const d = new Date(new Date(value).getTime() + this.offsetMs());
    const pad = (n: number) => String(n).padStart(2, '0');
    const h = d.getUTCHours();
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${h12}:${pad(d.getUTCMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
  }

  /** Every payment in the filtered range as an Excel file. Not paged: the export contains all matching rows. */
  async exportForAdmin(query: AdminPaymentsQueryDto): Promise<{ filename: string; buffer: Buffer }> {
    const { qb, when, from, to } = this.adminFilter(query);
    const rows = await qb
      .clone()
      .select([
        `${when} AS "occurredAt"`,
        'p.purchaseType AS type',
        's.title AS "storyTitle"',
        'pl.name AS "planName"',
        'p.checkoutEmail AS "buyerEmail"',
        'p.amountPaise AS "amountPaise"',
        'p.paymentStatus AS status',
        'p.providerOrderId AS "orderId"',
        'p.providerPaymentId AS "paymentId"',
      ])
      .orderBy(when, 'DESC')
      .getRawMany<Record<string, unknown>>();

    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        'Date and time': this.formatLocal(r.occurredAt as Date),
        Type: r.type === PaymentType.SUBSCRIPTION ? 'Subscription' : 'Story purchase',
        Item: (r.storyTitle as string | null) ?? (r.planName as string | null) ?? '',
        Buyer: r.buyerEmail,
        'Amount (INR)': Number(r.amountPaise) / 100,
        Status: r.status,
        'Payment id': r.paymentId ?? '',
        'Order id': r.orderId,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Payments');
    const buffer = Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
    return { filename: `payments-${from}-to-${to}.xlsx`, buffer };
  }

  // ---------- recover (buyer paid but the confirmation never reached us) ----------

  /** Looks up the order's captured payments at Razorpay and grants access through the verified path. */
  async recover(orderId: string) {
    const payment = await this.payments.findOne({ where: { providerOrderId: orderId } });
    if (!payment) throw new NotFoundException(t('payments.orderNotFound'));
    if (payment.paymentStatus === PaymentStatus.SUCCESS) {
      return { status: 'ALREADY_GRANTED', purchaseType: payment.purchaseType };
    }

    const response = await this.client().orders.fetchPayments(orderId);
    const items = (response.items ?? []) as Array<{ id: string; status: string; amount: number | string; currency: string }>;
    const captured = items.find(
      (p) => p.status === 'captured' && Number(p.amount) === payment.amountPaise && p.currency === payment.currency,
    );
    if (!captured) return { status: 'PENDING', purchaseType: payment.purchaseType };

    const result = await this.dataSource.transaction((m) => this.grant(m, payment.id, captured.id));
    await this.sendSetPasswordEmail(result);
    return { status: 'GRANTED', purchaseType: result.purchaseType, accountCreated: result.accountCreated };
  }

  // ---------- webhook (server to server) ----------

  async webhook(rawBody: Buffer, signature: string | undefined, event: { event: string; payload: any }) {
    if (!this.cfg.razorpay.webhookSecret || !signature || !this.signatureMatches(rawBody.toString('utf8'), signature, this.cfg.razorpay.webhookSecret)) {
      throw new BadRequestException(t('payments.webhookInvalid'));
    }

    switch (event.event) {
      case 'payment.captured': {
        const entity = event.payload.payment.entity;
        const payment = await this.payments.findOne({ where: { providerOrderId: entity.order_id } });
        if (payment && payment.paymentStatus !== PaymentStatus.SUCCESS && Number(entity.amount) === payment.amountPaise) {
          const result = await this.dataSource.transaction((m) => this.grant(m, payment.id, entity.id));
          await this.sendSetPasswordEmail(result);
        }
        break;
      }
      case 'payment.failed': {
        const entity = event.payload.payment.entity;
        await this.payments.update(
          { providerOrderId: entity.order_id, paymentStatus: PaymentStatus.PENDING },
          { paymentStatus: PaymentStatus.FAILED },
        );
        break;
      }
      case 'refund.processed': {
        await this.refund(event.payload.refund.entity.payment_id);
        break;
      }
      default:
        break;
    }
    return { received: true };
  }

  // ---------- grants ----------

  /** Runs inside a transaction. Marks the payment, finds or creates the reader, and grants access. */
  private async grant(m: EntityManager, paymentId: string, providerPaymentId: string): Promise<GrantResult> {
    const payment = await m.findOneOrFail(Payment, { where: { id: paymentId }, lock: { mode: 'pessimistic_write' } });
    if (payment.paymentStatus === PaymentStatus.SUCCESS) {
      return { purchaseType: payment.purchaseType, accountCreated: false, setPasswordEmail: null };
    }

    const { user, created } = await this.ensureReader(m, payment.checkoutEmail);
    const now = new Date();
    payment.userId = user.id;
    payment.paymentStatus = PaymentStatus.SUCCESS;
    payment.providerPaymentId = providerPaymentId;
    payment.paidAt = now;
    await m.save(payment);

    if (payment.purchaseType === PaymentType.STORY_PURCHASE && payment.storyId) {
      const existing = await m.findOne(StoryPurchase, { where: { userId: user.id, storyId: payment.storyId } });
      if (existing) {
        existing.status = PurchaseStatus.ACTIVE;
        existing.paymentId = payment.id;
        existing.purchasePricePaise = payment.amountPaise;
        await m.save(existing);
      } else {
        await m.save(
          m.create(StoryPurchase, {
            userId: user.id,
            storyId: payment.storyId,
            paymentId: payment.id,
            purchasePricePaise: payment.amountPaise,
            status: PurchaseStatus.ACTIVE,
          }),
        );
      }
    }

    if (payment.purchaseType === PaymentType.SUBSCRIPTION && payment.planId) {
      const plan = await m.findOneByOrFail(SubscriptionPlan, { id: payment.planId });
      // Renewals extend from the current end date, so no paid days are lost.
      const current = await m.findOne(UserSubscription, {
        where: { userId: user.id, status: SubscriptionStatus.ACTIVE, endDate: MoreThan(now) },
        order: { endDate: 'DESC' },
      });
      const start = current ? current.endDate : now;
      const end = new Date(start.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
      await m.save(
        m.create(UserSubscription, {
          userId: user.id,
          planId: plan.id,
          paymentId: payment.id,
          startDate: start,
          endDate: end,
          status: SubscriptionStatus.ACTIVE,
        }),
      );
    }

    let setPasswordEmail: { to: string; link: string } | null = null;
    if (created) {
      const raw = generateOpaqueToken();
      await m.save(
        m.create(VerificationToken, {
          userId: user.id,
          type: VerificationTokenType.SET_PASSWORD,
          tokenHash: hashToken(raw),
          expiresAt: new Date(now.getTime() + SET_PASSWORD_TTL_MS),
        }),
      );
      setPasswordEmail = {
        to: user.email,
        link: `${this.cfg.frontendOrigin}${this.cfg.frontend.setPasswordPath}?token=${encodeURIComponent(raw)}`,
      };
    }

    return { purchaseType: payment.purchaseType, accountCreated: created, setPasswordEmail };
  }

  /** Reuses the account for this email. A new buyer gets a reader account with no password yet. */
  private async ensureReader(m: EntityManager, email: string): Promise<{ user: User; created: boolean }> {
    const existing = await m.findOne(User, { where: { email } });
    if (existing) return { user: existing, created: false };

    const user = await m.save(
      m.create(User, {
        fullName: email.split('@')[0],
        email,
        passwordHash: null,
        emailVerified: false,
        isActive: true,
      }),
    );
    await m.save(m.create(UserRoleEntity, { userId: user.id, role: UserRole.READER }));
    return { user, created: true };
  }

  private async sendSetPasswordEmail(result: GrantResult): Promise<void> {
    if (!result.setPasswordEmail) return;
    const hours = Math.round(SET_PASSWORD_TTL_MS / 3_600_000);
    await this.mail.send(
      result.setPasswordEmail.to,
      t('mail.setPasswordSubject', { brand: this.cfg.appName }),
      t('mail.setPasswordBody', { link: result.setPasswordEmail.link, hours }),
    );
  }

  /** Refunds revoke the purchase or subscription that the payment granted. */
  private async refund(providerPaymentId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const payment = await m.findOne(Payment, { where: { providerPaymentId } });
      if (!payment || payment.paymentStatus === PaymentStatus.REFUNDED) return;
      payment.paymentStatus = PaymentStatus.REFUNDED;
      await m.save(payment);
      await m.update(StoryPurchase, { paymentId: payment.id }, { status: PurchaseStatus.REVOKED });
      await m.update(UserSubscription, { paymentId: payment.id }, { status: SubscriptionStatus.REVOKED });
    });
  }

  // ---------- helpers ----------

  private async priceFor(dto: CreateOrderDto, email: string): Promise<{ amountPaise: number; storyId: string | null; planId: string | null }> {
    if (dto.purchaseType === PaymentType.STORY_PURCHASE) {
      const story = dto.storyId ? await this.stories.findOne({ where: { id: dto.storyId } }) : null;
      if (!story || story.accessType !== AccessType.PREMIUM || story.pricePaise <= 0 || story.publicationStatus !== StoryStatus.PUBLISHED) {
        throw new BadRequestException(t('payments.storyNotForSale'));
      }
      const buyer = await this.users.findOne({ where: { email } });
      if (buyer && (await this.purchases.findOne({ where: { userId: buyer.id, storyId: story.id, status: PurchaseStatus.ACTIVE } }))) {
        throw new ConflictException(t('payments.alreadyPurchased'));
      }
      return { amountPaise: story.pricePaise, storyId: story.id, planId: null };
    }

    const plan = dto.planId ? await this.plans.findOne({ where: { id: dto.planId, isActive: true } }) : null;
    if (!plan) throw new BadRequestException(t('payments.planNotAvailable'));
    return { amountPaise: plan.pricePaise, storyId: null, planId: plan.id };
  }

  private client(): Razorpay {
    const { keyId, keySecret } = this.cfg.razorpay;
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException(t('payments.notConfigured'));
    }
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  private signatureMatches(message: string, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(message).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
