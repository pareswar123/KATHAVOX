import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReaderApi, ReaderLibrary } from '../../core/api/reader.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

/** Reader's library: bookmarks, purchased stories, subscription status and payments. */
@Component({
  selector: 'kv-my-library',
  imports: [RouterLink, DatePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'library.title' | translate }}</h1>

    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (library(); as lib) {
      <section id="subscription" class="mt-6 scroll-mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 class="font-medium">{{ 'library.subscription' | translate }}</h2>
        @if (lib.subscription; as sub) {
          @if (sub.active) {
            <p class="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              {{ 'library.activeUntil' | translate: { plan: sub.planName } }} {{ sub.endDate | date: 'mediumDate' }}
            </p>
          } @else {
            <p class="mt-2 text-sm text-amber-800 dark:text-amber-300">{{ sub.message }}</p>
          }
        } @else {
          <p class="mt-2 text-sm text-slate-500">{{ 'library.noSubscription' | translate }}</p>
        }
        <a routerLink="/subscriptions" class="mt-3 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400">{{ 'library.renew' | translate }}</a>
      </section>

      <section class="mt-6">
        <h2 class="font-medium">{{ 'library.bookmarks' | translate }}</h2>
        @if (lib.bookmarks.length === 0) {
          <p class="mt-2 text-sm text-slate-500">{{ 'library.noBookmarks' | translate }}</p>
        }
        <ul class="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          @for (b of lib.bookmarks; track b.storyId) {
            <li class="flex items-center justify-between gap-3 px-4 py-3">
              <a [routerLink]="['/story', b.slug]" class="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{{ b.title }}</a>
              <span class="flex items-center gap-3 text-xs">
                <span class="text-slate-500">{{ (b.accessType === 'FREE' ? 'access.FREE' : 'access.PREMIUM') | translate }}</span>
                <button type="button" class="text-red-600 hover:underline dark:text-red-400" (click)="removeBookmark(b.storyId)">{{ 'bookmark.remove' | translate }}</button>
              </span>
            </li>
          }
        </ul>
      </section>

      <section class="mt-6">
        <h2 class="font-medium">{{ 'library.purchased' | translate }}</h2>
        @if (lib.purchasedStories.length === 0) {
          <p class="mt-2 text-sm text-slate-500">{{ 'library.noPurchases' | translate }}</p>
        }
        <ul class="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          @for (s of lib.purchasedStories; track s.storyId) {
            <li class="flex items-center justify-between px-4 py-3">
              <a [routerLink]="['/story', s.slug]" class="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{{ s.title }}</a>
              <span class="text-xs text-slate-500">{{ s.purchasedAt | date: 'mediumDate' }}</span>
            </li>
          }
        </ul>
      </section>

      <section class="mt-6">
        <h2 class="font-medium">{{ 'library.payments' | translate }}</h2>
        @if (lib.payments.length === 0) {
          <p class="mt-2 text-sm text-slate-500">{{ 'library.noPayments' | translate }}</p>
        }
        <ul class="mt-2 space-y-1 text-sm">
          @for (p of lib.payments; track p.id) {
            <li class="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
              <span>{{ ('library.type.' + p.purchaseType) | translate }} · {{ p.createdAt | date: 'mediumDate' }}</span>
              <span>₹{{ (p.amountPaise / 100).toFixed(2) }} · {{ ('library.status.' + p.status) | translate }}</span>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class MyLibraryComponent {
  private readonly api = inject(ReaderApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  readonly library = signal<ReaderLibrary | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  removeBookmark(storyId: string): void {
    this.api
      .removeBookmark(storyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: (err: unknown) => this.error.set(err instanceof ApiError ? err.message : translate('errors.generic')),
      });
  }

  private load(): void {
    this.api
      .library()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lib) => {
          this.library.set(lib);
          if (this.route.snapshot.fragment === 'subscription') {
            afterNextRender(() => document.getElementById('subscription')?.scrollIntoView({ block: 'start' }));
          }
        },
        error: (err: unknown) => this.error.set(err instanceof ApiError ? err.message : translate('errors.generic')),
      });
  }
}
