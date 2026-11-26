import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BookmarkButtonComponent } from '../../shared/bookmark-button/bookmark-button.component';
import { CheckoutPanelComponent } from '../../shared/checkout-panel/checkout-panel.component';
import { ReaderApi } from '../../core/api/reader.api';
import { AuthStore } from '../../core/auth/auth.store';
import { PublicApi } from '../../core/api/public.api';
import { AuthService } from '../../core/auth/auth.service';
import { ROUTES } from '../../core/config/endpoints';
import { ReadingPrefsService } from '../../core/reading/reading-prefs.service';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { PublicStoryDetail } from '../../core/models/public.model';

const WORDS_PER_MINUTE = 200;

/** Reads one page. Locked pages show the purchase options and never any content. */
@Component({
  selector: 'kv-story-reader',
  imports: [RouterLink, TranslatePipe, CheckoutPanelComponent, BookmarkButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as err) {
      <p role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (detail(); as d) {
      <div class="fixed inset-x-0 top-0 z-10 h-1 bg-slate-200 dark:bg-slate-800">
        <div class="h-1 bg-indigo-600" [style.width.%]="progress()"></div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span class="flex items-center gap-2"><a [routerLink]="['/story', d.story.slug]" class="text-indigo-600 hover:underline dark:text-indigo-400">← {{ d.story.title }}</a><a routerLink="/subscriptions" [style.display]="d.entitled ? 'none' : null" class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-500 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950" [attr.aria-label]="'subscriptions.info' | translate" [title]="'subscriptions.info' | translate">ⓘ</a></span>
        <div class="flex items-center gap-2">
          <button type="button" class="kv-btn" (click)="prefs.smallerFont()" [attr.aria-label]="'public.reader.smaller' | translate">A−</button>
          <button type="button" class="kv-btn" (click)="prefs.biggerFont()" [attr.aria-label]="'public.reader.bigger' | translate">A+</button>
          <kv-bookmark-button [storyId]="d.story.id" />
          <button type="button" class="kv-btn" (click)="share(d)">{{ 'public.reader.share' | translate }}</button>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
        <label class="flex items-center gap-2">
          {{ 'public.reader.goTo' | translate }}
          <select class="kv-btn bg-white dark:bg-slate-900" [value]="pageNumber()" (change)="goTo($any($event.target).value)">
            @for (n of pageNumbers(d); track n) {
              <option [value]="n">{{ n }}{{ isLocked(d, n) ? ' 🔒' : '' }}</option>
            }
          </select>
        </label>
        <span>{{ 'public.reader.pageOf' | translate: { page: pageNumber(), total: d.totalPages } }} ·
          @if (isLocked(d, pageNumber())) {
            {{ 'public.story.locked' | translate }}
          } @else {
            {{ 'public.story.freePreview' | translate }}
          }
        </span>
        <span>{{ 'public.reader.readingTime' | translate: { minutes: readingMinutes(d) } }}</span>
      </div>

      @if (current(d); as page) {
        <article class="mt-6 rounded-lg p-2 leading-relaxed text-slate-900 dark:text-slate-100" [style.font-size.px]="prefs.fontSize()">
          @if (page.title) {
            <h1 class="mb-4 text-2xl font-semibold">{{ page.title }}</h1>
          }
          <div class="kv-content" [innerHTML]="page.content"></div>
        </article>
      } @else {
        <section class="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
          <p class="text-lg font-semibold text-amber-900 dark:text-amber-200">🔒 {{ 'public.reader.lockedTitle' | translate: { n: pageNumber() } }}</p>
          @if (lockError(); as lockMsg) {
            <p role="alert" class="mt-2 text-sm font-medium text-red-700 dark:text-red-300">{{ lockMsg }}</p>
          } @else {
            <p class="mt-2 text-sm text-amber-800 dark:text-amber-300">
              {{ 'public.reader.lockedBody' | translate: { price: rupees(d.story.pricePaise), preview: d.story.freePreviewPages } }}
            </p>
          }
          @if (d.story.accessType === 'PREMIUM' && d.story.pricePaise > 0) {
            <div class="mt-4">
              <kv-checkout-panel purchaseType="STORY_PURCHASE" [storyId]="d.story.id" [label]="('public.locked.buyStory' | translate) + ' · ₹' + rupees(d.story.pricePaise)" (granted)="reloadAfterPurchase()" />
            </div>
          }
          <div class="mt-4 flex flex-wrap gap-3 text-sm">
            <a routerLink="/subscriptions" class="rounded-md border border-amber-600 px-3 py-2 text-amber-900 dark:text-amber-200">{{ 'public.locked.subscribe' | translate }}</a>
            <a [routerLink]="loginRoute" [queryParams]="{ returnUrl: '/story/' + d.story.slug + '/page/' + pageNumber() }" class="rounded-md px-3 py-2 text-indigo-700 underline dark:text-indigo-300">
              {{ 'public.locked.alreadyPurchased' | translate }}
            </a>
          </div>
        </section>
      }

      <nav class="mt-10 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        @if (pageNumber() > 1) {
          <a [routerLink]="['/story', d.story.slug, 'page', pageNumber() - 1]" class="kv-btn">← {{ 'public.reader.previous' | translate }}</a>
        } @else {
          <span></span>
        }
        @if (pageNumber() < d.totalPages) {
          <a [routerLink]="['/story', d.story.slug, 'page', pageNumber() + 1]" class="kv-btn">{{ 'public.reader.next' | translate }} →</a>
        }
      </nav>

      @if (copied()) {
        <p role="status" class="mt-3 text-sm text-slate-500">{{ 'public.reader.copied' | translate }}</p>
      }
    }

  `,
  styles: `
      .kv-btn { border: 1px solid rgb(203 213 225); border-radius: 0.375rem; padding: 0.375rem 0.75rem; font-size: 0.875rem; background: transparent; }
      .kv-content p { margin: 0.75rem 0; }
      .kv-content h2 { font-size: 1.4em; font-weight: 600; margin: 1rem 0 0.5rem; }
      .kv-content h3 { font-size: 1.15em; font-weight: 600; margin: 0.75rem 0 0.5rem; }
      .kv-content ul { list-style: disc; padding-left: 1.5rem; }
      .kv-content ol { list-style: decimal; padding-left: 1.5rem; }
      .kv-content img { max-width: 100%; height: auto; border-radius: 0.375rem; margin: 0.75rem 0; }
  `,
})
export class StoryReaderComponent {
  private readonly api = inject(PublicApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly prefs = inject(ReadingPrefsService);

  readonly loginRoute = ROUTES.login;
  private readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly pageNumber = signal(Number(this.route.snapshot.paramMap.get('page')) || 1);
  readonly detail = signal<PublicStoryDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);
  /** Page content for a logged-in reader, from the server entitlement check. */
  readonly entitled = signal<{ title: string; content: string } | null>(null);
  readonly lockError = signal<string | null>(null);
  private readonly readerApi = inject(ReaderApi);
  private readonly sessionService = inject(AuthService);
  private readonly auth = inject(AuthStore);
  readonly progress = computed(() => {
    const total = this.detail()?.totalPages ?? 0;
    return total ? (this.pageNumber() / total) * 100 : 0;
  });

  rupees(paise: number): string {
    return (paise / 100).toFixed(2);
  }

  constructor() {
    this.api.story(this.slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => this.detail.set(d),
      error: (err: unknown) => this.error.set(err instanceof ApiError ? err.message : translate('errors.generic')),
    });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.pageNumber.set(Number(params.get('page')) || 1);
      void this.sessionService.ensureSession().then(() => this.loadEntitled());
    });
  }

  pageNumbers(d: PublicStoryDetail): number[] {
    return Array.from({ length: d.totalPages }, (_, i) => i + 1);
  }

  isLocked(d: PublicStoryDetail, n: number): boolean {
    return d.lockedPageNumbers.includes(n);
  }

  current(d: PublicStoryDetail) {
    const e = this.entitled();
    if (e) return { pageNumber: this.pageNumber(), title: e.title, content: e.content };
    return d.previewPages.find((p) => p.pageNumber === this.pageNumber()) ?? null;
  }

  /** Logged-in readers: ask the server which page they may read. Anonymous readers use the preview only. */
  loadEntitled(): void {
    this.entitled.set(null);
    this.lockError.set(null);
    if (!this.auth.isAuthenticated()) return;
    this.readerApi.page(this.slug, this.pageNumber()).subscribe({
      next: (p) => this.entitled.set({ title: p.title, content: p.content }),
      error: (err: unknown) => this.lockError.set(err instanceof ApiError ? err.message : translate('errors.generic')),
    });
  }

  reloadAfterPurchase(): void {
    this.api.story(this.slug).subscribe({ next: (d) => this.detail.set(d), error: () => undefined });
    this.loadEntitled();
  }

  readingMinutes(d: PublicStoryDetail): number {
    const page = this.current(d);
    const words = page ? page.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length : 0;
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  }

  goTo(value: string): void {
    void this.router.navigate(['/story', this.slug, 'page', Number(value)]);
  }

  async share(d: PublicStoryDetail): Promise<void> {
    const url = `${location.origin}/story/${d.story.slug}/page/${this.pageNumber()}`;
    if (navigator.share) {
      await navigator.share({ title: d.story.title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url);
    this.copied.set(true);
  }
}
