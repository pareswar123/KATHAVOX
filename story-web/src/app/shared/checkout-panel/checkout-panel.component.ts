import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PaymentsApi } from '../../core/api/payments.api';
import { AuthStore } from '../../core/auth/auth.store';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { RazorpayService } from '../../core/payments/razorpay.service';

const LIBRARY = '/reader/my-library';

/**
 * Buyer details plus the Razorpay purchase. The price is never sent from here: the server reads it
 * from the story or plan id. After the server confirms the payment, a logged-in reader goes to My library
 * (subscriptions open at the subscription section). A guest sees a button to log in and then reach it.
 */
@Component({
  selector: 'kv-checkout-panel',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (account(); as signed) {
      <button type="button" (click)="buy()" [disabled]="busy()" class="kv-primary w-full">
        {{ (busy() ? 'payment.form.working' : label()) | translate }}
      </button>
      <p class="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">{{ 'payment.form.toAccount' | translate: { email: signed.email } }}</p>
    } @else {
      <form [formGroup]="form" (ngSubmit)="buy()" class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" novalidate>
        <input formControlName="fullName" [placeholder]="'payment.form.name' | translate" class="kv-input" maxlength="150" />
        <input formControlName="checkoutEmail" type="email" [placeholder]="'payment.form.email' | translate" class="kv-input" maxlength="255" />
        <button type="submit" [disabled]="form.invalid || busy()" class="kv-primary">
          {{ (busy() ? 'payment.form.working' : label()) | translate }}
        </button>
      </form>
      <p class="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">{{ 'payment.form.hint' | translate }}</p>
    }
    @if (message(); as msg) {
      <p role="status" class="mt-2 text-sm" [class]="isError() ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'">{{ msg }}</p>
    }
    @if (guestDone()) {
      <p class="mt-2 text-sm text-amber-900 dark:text-amber-200">{{ 'payment.status.nextSteps' | translate }}</p>
      <a routerLink="/auth/login" [queryParams]="loginQuery" class="kv-button mt-2 inline-block">{{ 'payment.status.goLogin' | translate }}</a>
    }
    @if (pendingOrderId(); as orderId) {
      <button type="button" (click)="checkPayment(orderId)" [disabled]="busy()" class="kv-link mt-2">
        {{ 'payment.form.checkPayment' | translate }}
      </button>
    }
  `,
  styles: `
    .kv-input { width: 100%; border-radius: 0.375rem; border: 1px solid rgb(203 213 225); padding: 0.5rem 0.75rem; background: white; color: rgb(15 23 42); }
    .kv-primary { border-radius: 0.375rem; background: rgb(217 119 6); color: white; padding: 0.5rem 0.75rem; font-size: 0.875rem; font-weight: 500; }
    .kv-primary:disabled { opacity: 0.5; }
    .kv-link { font-size: 0.875rem; text-decoration: underline; color: rgb(180 83 9); }
    .kv-button { border-radius: 0.375rem; background: rgb(79 70 229); color: white; padding: 0.5rem 0.75rem; font-size: 0.875rem; font-weight: 500; }
  `,
})
export class CheckoutPanelComponent {
  private readonly fb = inject(FormBuilder);
  private readonly payments = inject(PaymentsApi);
  private readonly razorpay = inject(RazorpayService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly purchaseType = input.required<'STORY_PURCHASE' | 'SUBSCRIPTION' | 'BOOK_PURCHASE'>();
  readonly storyId = input<string | null>(null);
  readonly planId = input<string | null>(null);
  readonly bookId = input<string | null>(null);
  /** Button text and receipt description, for example "Buy for ₹49.00". */
  readonly label = input.required<string>();

  /** Fires once the server has granted access. */
  readonly granted = output<void>();

  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly isError = signal(false);
  /** Set when the buyer may have paid but the confirmation did not come back: offers "Check my payment". */
  readonly pendingOrderId = signal<string | null>(null);
  /** Set for a guest after a confirmed payment: shows the next steps and a login button. */
  readonly guestDone = signal(false);

  readonly loginQuery = { returnUrl: LIBRARY };

  /** Logged-in readers buy to their own account, so the email is never typed for them. */
  readonly account = this.auth.user;

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    checkoutEmail: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
  });

  async buy(): Promise<void> {
    const signed = this.auth.user();
    if (!signed && this.form.invalid) return;
    this.busy.set(true);
    this.message.set(null);
    this.pendingOrderId.set(null);
    this.guestDone.set(false);
    const raw = this.form.getRawValue();
    const fullName = signed?.fullName ?? raw.fullName;
    const checkoutEmail = signed?.email ?? raw.checkoutEmail;

    try {
      const order = await firstValueFrom(
        this.payments.createOrder({
          purchaseType: this.purchaseType(),
          storyId: this.storyId() ?? undefined,
          planId: this.planId() ?? undefined,
          bookId: this.bookId() ?? undefined,
          checkoutEmail,
          fullName,
        }),
      );
      this.pendingOrderId.set(order.orderId);
      const proof = await this.razorpay.checkout(
        order,
        { name: fullName, email: checkoutEmail },
        this.label(),
        () => this.showInfo(translate('payment.status.attemptFailed')),
      );
      const result = await firstValueFrom(this.payments.verify(proof));
      this.pendingOrderId.set(null);
      this.finish(result.accountCreated ? 'payment.status.grantedNewAccount' : 'payment.status.granted', checkoutEmail);
    } catch (err: unknown) {
      this.busy.set(false);
      if (err instanceof Error && err.message === 'CANCELLED') {
        // Closed the window. If they paid before closing, the recovery button finds the payment.
        this.showInfo(translate('payment.status.cancelled'));
        return;
      }
      this.fail(err);
    }
  }

  async checkPayment(orderId: string): Promise<void> {
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.payments.recover(orderId));
      if (result.status === 'PENDING') {
        this.showInfo(translate('payment.status.notFoundYet'));
        return;
      }
      this.pendingOrderId.set(null);
      this.finish('payment.status.granted', this.form.getRawValue().checkoutEmail);
    } catch (err: unknown) {
      this.fail(err);
    }
  }

  /** Runs only after the server has confirmed the payment. */
  private finish(key: string, email: string): void {
    this.busy.set(false);
    this.isError.set(false);
    this.message.set(translate(key, { email }));
    this.granted.emit();

    if (this.auth.isAuthenticated()) {
      // Subscriptions open at the subscription section of the library.
      const fragment = this.purchaseType() === 'SUBSCRIPTION' ? 'subscription' : undefined;
      void this.router.navigate([LIBRARY], { fragment });
    } else {
      this.guestDone.set(true);
    }
  }

  private showInfo(text: string): void {
    this.busy.set(false);
    this.isError.set(false);
    this.message.set(text);
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    this.isError.set(true);
    this.message.set(err instanceof ApiError ? err.message : translate('errors.generic'));
  }
}
