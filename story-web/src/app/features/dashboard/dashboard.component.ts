import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StoriesApi } from '../../core/api/stories.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { AdminDashboard, AuthorDashboard, Portal } from '../../core/models/story.model';

interface Card {
  labelKey: string;
  value: number;
  format?: 'money';
}

/** Author and admin dashboards. Both read counts from the backend; nothing is calculated here. */
@Component({
  selector: 'kv-dashboard',
  imports: [TranslatePipe, RouterLink, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
      {{ (portal === 'admin' ? 'dashboard.admin.title' : 'dashboard.author.title') | translate }}
    </h1>

    @if (error()) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ error() }}</p>
    }

    <div class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      @for (card of cards(); track card.labelKey) {
        <div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ card.labelKey | translate }}</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            @if (card.format === 'money') {
              ₹{{ card.value / 100 | number: '1.0-2' }}
            } @else {
              {{ card.value | number }}
            }
          </p>
        </div>
      }
    </div>

    @if (portal === 'admin' && paymentsPending()) {
      <p class="mt-4 text-sm text-slate-500">{{ 'dashboard.admin.paymentsNote' | translate }}</p>
    }

    <h2 class="mt-8 text-lg font-medium text-slate-900 dark:text-slate-100">{{ 'dashboard.quickActions' | translate }}</h2>
    <div class="mt-3 flex flex-wrap gap-3">
      <a [routerLink]="base + '/stories/create'" class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">{{ 'nav.newStory' | translate }}</a>
      <a [routerLink]="base + '/stories'" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">{{ 'nav.stories' | translate }}</a>
      @if (portal === 'admin') {
        <a routerLink="/admin/subscription-plans" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">{{ 'subscriptions.admin.title' | translate }}</a>
        <a routerLink="/admin/approvals" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">{{ 'nav.approvals' | translate }}</a>
      }
    </div>
  `,
})
export class DashboardComponent {
  private readonly api = inject(StoriesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly portal: Portal = this.route.snapshot.data['portal'];
  readonly base = `/${this.portal}`;
  readonly cards = signal<Card[]>([]);
  readonly error = signal<string | null>(null);
  readonly paymentsPending = signal(false);

  constructor() {
    if (this.portal === 'admin') {
      this.api.adminDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (d) => this.showAdmin(d),
        error: (err: unknown) => this.fail(err),
      });
    } else {
      this.api.authorDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (d) => this.showAuthor(d),
        error: (err: unknown) => this.fail(err),
      });
    }
  }

  private showAuthor(d: AuthorDashboard): void {
    this.cards.set([
      { labelKey: 'dashboard.author.total', value: d.total },
      { labelKey: 'dashboard.author.draft', value: d.draft },
      { labelKey: 'dashboard.author.pending', value: d.pending },
      { labelKey: 'dashboard.author.published', value: d.published },
      { labelKey: 'dashboard.author.rejected', value: d.rejected },
      { labelKey: 'dashboard.author.views', value: d.views },
    ]);
  }

  private showAdmin(d: AdminDashboard): void {
    this.paymentsPending.set(!d.paymentsEnabled);
    this.cards.set([
      { labelKey: 'dashboard.admin.total', value: d.total },
      { labelKey: 'dashboard.admin.free', value: d.free },
      { labelKey: 'dashboard.admin.premium', value: d.premium },
      { labelKey: 'dashboard.admin.pending', value: d.pending },
      { labelKey: 'dashboard.admin.authors', value: d.authors },
      { labelKey: 'dashboard.admin.readers', value: d.readers },
      { labelKey: 'dashboard.admin.views', value: d.views },
      { labelKey: 'dashboard.admin.purchases', value: d.purchases },
      { labelKey: 'dashboard.admin.subscriptions', value: d.activeSubscriptions },
      { labelKey: 'dashboard.admin.revenue', value: d.totalRevenuePaise, format: 'money' },
      { labelKey: 'dashboard.admin.monthlyRevenue', value: d.monthlyRevenuePaise, format: 'money' },
    ]);
  }

  private fail(err: unknown): void {
    this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
  }
}
