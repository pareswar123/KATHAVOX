import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BooksApi, PublicBookDetail } from '../../core/api/books.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { CheckoutPanelComponent } from '../../shared/checkout-panel/checkout-panel.component';

/**
 * One book: cover, description and index with page ranges. Anyone can open it.
 * Stories open in the reader; a paid book needs a purchase or a subscription to read.
 */
@Component({
  selector: 'kv-book-detail',
  imports: [RouterLink, DecimalPipe, TranslatePipe, CheckoutPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/books" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400">{{ 'books.public.back' | translate }}</a>

    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (book(); as b) {
      <div class="mt-4 grid gap-6 md:grid-cols-[14rem_1fr]">
        <div>
          @if (b.coverImageUrl) {
            <img [src]="b.coverImageUrl" [alt]="b.title" class="w-full rounded-lg border border-slate-200 object-cover dark:border-slate-800" />
          }
        </div>
        <div>
          <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ b.title }}</h1>
          <p class="mt-2 text-sm">
            @if (b.accessType === 'PREMIUM') {
              <span class="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900 dark:text-amber-100">₹{{ b.pricePaise / 100 | number: '1.2-2' }}</span>
            } @else {
              <span class="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">{{ 'books.free' | translate }}</span>
            }
          </p>
          @if (b.description) {
            <p class="mt-4 whitespace-pre-line text-slate-700 dark:text-slate-300">{{ b.description }}</p>
          }

          @if (b.access.readable) {
            <p class="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              {{ (b.access.via === 'SUBSCRIPTION' ? 'books.public.viaSubscription' : b.access.via === 'PURCHASED' ? 'books.public.viaPurchase' : 'books.public.freeBook') | translate }}
            </p>
          } @else {
            <div class="mt-4 rounded-md border border-amber-600 p-3 text-sm text-amber-900 dark:text-amber-200">
              {{ 'books.public.locked' | translate }}
              <a routerLink="/subscriptions" class="ml-1 underline">{{ 'public.locked.subscribe' | translate }}</a>
            </div>
            <div class="mt-3">
              <kv-checkout-panel
                purchaseType="BOOK_PURCHASE"
                [bookId]="b.id"
                [label]="('books.public.buy' | translate) + ' · ₹' + (b.pricePaise / 100 | number: '1.2-2')"
              />
            </div>
          }

          <h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">{{ 'books.public.index' | translate }}</h2>
          <ol class="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            @for (s of b.stories; track s.slug; let i = $index) {
              <li class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span class="min-w-0">
                  {{ i + 1 }}.
                  @if (b.access.readable) {
                    <a [routerLink]="['/story', s.slug]" class="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{{ s.title }}</a>
                  } @else {
                    <span class="font-medium">{{ s.title }}</span>
                  }
                </span>
                <span class="flex-none text-slate-500">{{ 'books.public.pages' | translate: { from: s.pageStart, to: s.pageEnd } }}</span>
              </li>
            }
          </ol>
        </div>
      </div>
    }
  `,
})
export class BookDetailComponent {
  private readonly api = inject(BooksApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly book = signal<PublicBookDetail | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.api
      .publicDetail(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (b) => this.book.set(b),
        error: (err: unknown) => this.error.set(err instanceof ApiError ? err.message : translate('errors.generic')),
      });
  }
}
