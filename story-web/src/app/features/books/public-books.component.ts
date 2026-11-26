import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, Subject, tap } from 'rxjs';
import { BooksApi, PublicBookCard } from '../../core/api/books.api';
import { Paginated } from '../../core/models/story.model';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

/** Public list of published books. Anyone can browse; reading a paid book needs a purchase or subscription. */
@Component({
  selector: 'kv-public-books',
  imports: [RouterLink, DecimalPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ 'books.public.title' | translate }}</h1>
    <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ 'books.public.intro' | translate }}</p>

    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (result(); as r) {
      @if (r.items.length === 0) {
        <p class="mt-8 text-slate-500">{{ 'books.public.empty' | translate }}</p>
      } @else {
        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (b of r.items; track b.slug) {
            <a [routerLink]="['/book', b.slug]" class="flex gap-4 rounded-lg border border-slate-200 p-4 hover:border-indigo-400 dark:border-slate-800">
              @if (b.coverImageUrl) {
                <img [src]="b.coverImageUrl" alt="" class="h-28 w-20 flex-none rounded object-cover" />
              } @else {
                <div class="flex h-28 w-20 flex-none items-center justify-center rounded bg-slate-200 text-xs text-slate-500 dark:bg-slate-800">{{ 'books.public.noCover' | translate }}</div>
              }
              <div class="min-w-0">
                <h2 class="font-semibold text-slate-900 dark:text-slate-100">{{ b.title }}</h2>
                <p class="mt-1 text-xs text-slate-500">{{ 'books.public.stories' | translate: { count: b.storyCount } }}</p>
                <p class="mt-2 text-sm">
                  @if (b.accessType === 'PREMIUM') {
                    <span class="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900 dark:text-amber-100">₹{{ b.pricePaise / 100 | number: '1.2-2' }}</span>
                  } @else {
                    <span class="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">{{ 'books.free' | translate }}</span>
                  }
                </p>
              </div>
            </a>
          }
        </div>

        <div class="mt-6 flex items-center justify-between text-sm">
          <button type="button" class="kv-btn" [disabled]="r.meta.page <= 1" (click)="goto(r.meta.page - 1)">{{ 'common.previous' | translate }}</button>
          <span>{{ 'common.page' | translate: { page: r.meta.page, total: r.meta.totalPages } }}</span>
          <button type="button" class="kv-btn" [disabled]="r.meta.page >= r.meta.totalPages" (click)="goto(r.meta.page + 1)">{{ 'common.next' | translate }}</button>
        </div>
      }
    }
  `,
  styles: `
    .kv-btn { border: 1px solid rgb(203 213 225); border-radius: 0.375rem; padding: 0.4rem 0.75rem; }
    .kv-btn:disabled { opacity: 0.5; }
  `,
})
export class PublicBooksComponent {
  private readonly api = inject(BooksApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly page = signal(1);
  readonly result = signal<Paginated<PublicBookCard> | null>(null);
  readonly error = signal<string | null>(null);
  private readonly refresh$ = new Subject<void>();

  constructor() {
    this.refresh$
      .pipe(
        switchMap(() =>
          this.api.publicList(this.page()).pipe(
            tap(() => this.error.set(null)),
            catchError((err: unknown) => {
              this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res) this.result.set(res);
      });
    this.refresh$.next();
  }

  goto(page: number): void {
    this.page.set(page);
    this.refresh$.next();
  }
}
