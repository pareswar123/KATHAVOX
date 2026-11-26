import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CheckoutPanelComponent } from '../../shared/checkout-panel/checkout-panel.component';
import { SubscriptionsApi } from '../../core/api/subscriptions.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { SubscriptionPlan } from '../../core/models/subscription.model';

/** Public page explaining subscriptions and listing the active plans. Anyone can open it. */
@Component({
  selector: 'kv-subscriptions',
  imports: [RouterLink, TranslatePipe, CheckoutPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400">{{ 'subscriptions.page.back' | translate }}</a>
    <h1 class="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ 'subscriptions.page.title' | translate }}</h1>
    <p class="mt-2 text-slate-600 dark:text-slate-400">{{ 'subscriptions.page.intro' | translate }}</p>

    <h2 class="mt-8 text-lg font-medium text-slate-900 dark:text-slate-100">{{ 'subscriptions.page.benefitsTitle' | translate }}</h2>
    <ul class="mt-2 list-disc space-y-1 pl-6 text-slate-700 dark:text-slate-300">
      <li>{{ 'subscriptions.page.benefit1' | translate }}</li>
      <li>{{ 'subscriptions.page.benefit2' | translate }}</li>
      <li>{{ 'subscriptions.page.benefit3' | translate }}</li>
      <li>{{ 'subscriptions.page.benefit4' | translate }}</li>
    </ul>

    @if (error(); as err) {
      <p role="alert" class="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      @for (p of plans(); track p.id) {
        <div class="flex flex-col rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ p.name }}</h3>
          <p class="mt-2 text-2xl font-semibold text-indigo-700 dark:text-indigo-300">₹{{ rupees(p.pricePaise) }}</p>
          <p class="text-sm text-slate-500">{{ 'subscriptions.page.forDays' | translate: { days: p.durationDays } }}</p>
          @if (p.description) {
            <p class="mt-3 flex-1 text-sm text-slate-700 dark:text-slate-300">{{ p.description }}</p>
          }
          <button type="button" (click)="toggle(p.id)" class="mt-4 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {{ 'subscriptions.page.subscribe' | translate }}
          </button>
          @if (openPlan() === p.id) {
            <div class="mt-3">
              <kv-checkout-panel purchaseType="SUBSCRIPTION" [planId]="p.id" [label]="('subscriptions.page.subscribe' | translate) + ' · ₹' + rupees(p.pricePaise)" />
            </div>
          }
        </div>
      } @empty {
        <p class="text-slate-500">{{ 'subscriptions.page.empty' | translate }}</p>
      }
    </div>
  `,
})
export class SubscriptionsComponent {
  private readonly api = inject(SubscriptionsApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly error = signal<string | null>(null);
  readonly openPlan = signal<string | null>(null);

  toggle(id: string): void {
    this.openPlan.set(this.openPlan() === id ? null : id);
  }

  constructor() {
    this.api
      .publicPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.plans.set(list),
        error: (err: unknown) => this.error.set(err instanceof ApiError ? err.message : translate('errors.generic')),
      });
  }

  rupees(paise: number): string {
    return (paise / 100).toFixed(2);
  }
}
