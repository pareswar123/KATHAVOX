import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StorySearchService } from '../../core/search/story-search.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { PublicApi } from '../../core/api/public.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { PublicStoryCard, PublicStoryList } from '../../core/models/public.model';

/** Home page: published stories with search and pagination. No login needed. */
@Component({
  selector: 'kv-home',
  imports: [FormsModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ 'public.home.heading' | translate }}</h1>
    <p class="mt-2 text-slate-600 dark:text-slate-400">{{ 'public.home.subheading' | translate }}</p>


    @if (error(); as err) {
      <p role="alert" class="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (result(); as r) {
      @if (r.items.length === 0) {
        <p class="mt-10 text-slate-500">{{ 'public.home.empty' | translate }}</p>
      }
      <div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        @for (s of r.items; track s.id) {
          <a [routerLink]="['/story', s.slug]" class="group flex gap-4 rounded-lg border border-slate-200 p-4 hover:border-indigo-400 dark:border-slate-800">
            @if (s.coverImageUrl) {
              <img [src]="s.coverImageUrl" alt="" class="h-28 w-20 flex-none rounded object-cover" />
            } @else {
              <div class="flex h-28 w-20 flex-none items-center justify-center rounded bg-slate-200 text-xs text-slate-500 dark:bg-slate-800">{{ 'public.home.noCover' | translate }}</div>
            }
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded px-1.5 py-0.5 text-xs font-medium" [class]="badgeClass(s)">{{ badgeText(s) }}</span>
                @if (s.isFeatured) {
                  <span class="text-xs text-amber-600">{{ 'public.home.featured' | translate }}</span>
                }
              </div>
              <h2 class="mt-1 truncate font-semibold text-slate-900 group-hover:underline dark:text-slate-100">{{ s.title }}</h2>
              <p class="truncate text-sm text-slate-600 dark:text-slate-400">{{ s.authorName }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ s.categoryName }} · {{ s.languageName }} · {{ s.totalPages }} {{ 'public.story.pages' | translate }}</p>
              <p class="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{{ s.description }}</p>
            </div>
          </a>
        }
      </div>

      @if (r.meta.totalPages > 1) {
        <div class="mt-8 flex items-center justify-between text-sm">
          <button type="button" class="kv-btn" [disabled]="r.meta.page <= 1" (click)="goto(r.meta.page - 1)">{{ 'common.previous' | translate }}</button>
          <span>{{ 'common.page' | translate: { page: r.meta.page, total: r.meta.totalPages } }}</span>
          <button type="button" class="kv-btn" [disabled]="r.meta.page >= r.meta.totalPages" (click)="goto(r.meta.page + 1)">{{ 'common.next' | translate }}</button>
        </div>
      }
    }

  `,
  styles: `
      .kv-btn { border: 1px solid rgb(203 213 225); border-radius: 0.375rem; padding: 0.375rem 0.75rem; }
      .kv-btn:disabled { opacity: 0.5; }
  `,
})
export class HomeComponent {
  private readonly api = inject(PublicApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storySearch = inject(StorySearchService);

  readonly query = signal('');
  readonly page = signal(1);
  readonly result = signal<PublicStoryList | null>(null);
  readonly error = signal<string | null>(null);

  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((text) => {
        this.query.set(text);
        this.page.set(1);
        this.load();
      });
    // Follow the header search term. A refresh starts with an empty term, so all stories load.
    effect(() => {
      const term = this.storySearch.term();
      untracked(() => {
        this.query.set(term);
        this.page.set(1);
        this.load();
      });
    });
  }

  onSearch(text: string): void {
    this.search$.next(text);
  }

  goto(page: number): void {
    this.page.set(page);
    this.load();
  }

  badgeText(s: PublicStoryCard): string {
    return s.accessType === 'FREE'
      ? translate('access.FREE')
      : `${translate('access.PREMIUM')} · ₹${(s.pricePaise / 100).toFixed(2)}`;
  }

  badgeClass(s: PublicStoryCard): string {
    return s.accessType === 'FREE'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  }

  private load(): void {
    this.api.stories({ page: this.page(), limit: 12, q: this.query() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.error.set(null);
        this.result.set(r);
      },
      error: (err: unknown) => this.error.set(err instanceof ApiError ? err.message : translate('errors.generic')),
    });
  }
}
