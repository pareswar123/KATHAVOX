import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BookmarkButtonComponent } from '../../shared/bookmark-button/bookmark-button.component';
import { CheckoutPanelComponent } from '../../shared/checkout-panel/checkout-panel.component';
import { PublicApi } from '../../core/api/public.api';
import { AuthService } from '../../core/auth/auth.service';
import { ROUTES } from '../../core/config/endpoints';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { PublicStoryDetail } from '../../core/models/public.model';

/** Story overview: details, the readable pages, and locked pages with the purchase options. */
@Component({
  selector: 'kv-story-detail',
  imports: [RouterLink, DatePipe, TranslatePipe, CheckoutPanelComponent, BookmarkButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as err) {
      <p role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (detail(); as d) {
      <a routerLink="/" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400">{{ 'public.story.back' | translate }}</a>

      <div class="mt-4 flex flex-col gap-6 md:flex-row">
        @if (d.story.coverImageUrl) {
          <img [src]="d.story.coverImageUrl" alt="" class="h-56 w-40 flex-none rounded object-cover" />
        }
        <div class="min-w-0">
          <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ d.story.title }} <a routerLink="/subscriptions" [style.display]="d.entitled ? 'none' : null" class="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-indigo-500 align-middle text-sm text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950" [attr.aria-label]="'subscriptions.info' | translate" [title]="'subscriptions.info' | translate">ⓘ</a></h1>
          <kv-bookmark-button [storyId]="d.story.id" />
          <p class="mt-1 text-slate-600 dark:text-slate-400">{{ 'public.story.by' | translate: { author: d.story.authorName } }}</p>
          <p class="mt-2 text-sm text-slate-500">
            {{ d.story.categoryName }} · {{ d.story.languageName }} · {{ d.totalPages }} {{ 'public.story.pages' | translate }} · {{ d.story.viewCount }} {{ 'common.views' | translate }}
          </p>
          <p class="mt-3 text-sm" [style.display]="d.entitled ? 'none' : null">
            @if (d.story.accessType === 'FREE') {
              <span class="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">{{ 'public.story.freeStory' | translate }}</span>
            } @else {
              <span class="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {{ 'public.story.premiumStory' | translate: { price: rupees(d.story.pricePaise), preview: d.story.freePreviewPages } }}
              </span>
            }
          </p>
          <p class="mt-4 whitespace-pre-line text-slate-700 dark:text-slate-300">{{ d.story.description }}</p>
          @if (d.previewPages.length > 0) {
            <a [routerLink]="['/story', d.story.slug, 'page', d.previewPages[0].pageNumber]" class="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
              {{ 'public.story.startReading' | translate }}
            </a>
          }
        </div>
      </div>

      @if (d.entitled && d.accessNote; as note) {
        <p role="status" class="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          @if (note.kind === 'SUBSCRIPTION') {
            {{ 'public.story.includedInSubscription' | translate: { plan: note.planName ?? '' } }}
            {{ note.endDate | date: 'mediumDate' }}
          } @else {
            {{ 'public.story.purchasedNote' | translate }}
          }
        </p>
      } @else if (d.entitled) {
        <p role="status" class="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ 'public.story.freeNote' | translate }}</p>
      }
      <h2 class="mt-10 text-lg font-medium text-slate-900 dark:text-slate-100">{{ 'public.story.chapters' | translate }}</h2>
      <ol class="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        @for (p of d.previewPages; track p.pageNumber) {
          <li>
            <a [routerLink]="['/story', d.story.slug, 'page', p.pageNumber]" class="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900">
              <span>{{ p.pageNumber }}. {{ p.title || ('public.story.pageFallback' | translate: { n: p.pageNumber }) }}</span>
              <span class="text-xs text-emerald-700 dark:text-emerald-300">{{ 'public.story.freePreview' | translate }}</span>
            </a>
          </li>
        }
        @for (n of d.lockedPageNumbers; track n) {
          <li class="flex items-center justify-between px-4 py-3 text-slate-500">
            <span>{{ n }}. {{ 'public.story.lockedPage' | translate: { n: n } }}</span>
            <span class="text-xs">🔒 {{ 'public.story.locked' | translate }}</span>
          </li>
        }
      </ol>

      @if (d.lockedPageNumbers.length > 0 && !d.entitled) {
        <section class="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p class="font-medium text-amber-900 dark:text-amber-200">{{ 'public.locked.title' | translate }}</p>
            <p class="mt-1 text-sm text-amber-800 dark:text-amber-300">{{ 'public.locked.body' | translate }}</p>
            @if (d.story.accessType === 'PREMIUM' && d.story.pricePaise > 0) {
              <div class="mt-3">
                <kv-checkout-panel purchaseType="STORY_PURCHASE" [storyId]="d.story.id" [label]="('public.locked.buyStory' | translate) + ' · ₹' + rupees(d.story.pricePaise)" (granted)="reload()" />
              </div>
            }
            <div class="mt-3 flex flex-wrap gap-3 text-sm">
              <a routerLink="/subscriptions" class="rounded-md border border-amber-600 px-3 py-2 text-amber-900 dark:text-amber-200">{{ 'public.locked.subscribe' | translate }}</a>
              <a [routerLink]="loginRoute" class="rounded-md px-3 py-2 text-indigo-700 underline dark:text-indigo-300">{{ 'public.locked.alreadyPurchased' | translate }}</a>
            </div>
          </section>
      }
    }
  `,
})
export class StoryDetailComponent {
  private readonly api = inject(PublicApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly loginRoute = ROUTES.login;
  readonly detail = signal<PublicStoryDetail | null>(null);
  readonly error = signal<string | null>(null);

  rupees(paise: number): string {
    return (paise / 100).toFixed(2);
  }

  reload(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.api.story(slug).subscribe({ next: (d) => this.detail.set(d), error: () => undefined });
  }

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    void this.auth.ensureSession().then(() => this.api.story(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => this.detail.set(d),
      error: (err: unknown) => this.error.set(err instanceof ApiError ? err.message : translate('errors.generic')),
    }));
  }
}
