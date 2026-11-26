import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, switchMap, startWith, debounceTime, distinctUntilChanged, catchError, of, tap } from 'rxjs';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { StoriesApi } from '../../core/api/stories.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { Paginated, Portal, Story, StoryStatus } from '../../core/models/story.model';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

const STATUSES: StoryStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'PUBLISHED', 'ARCHIVED'];

/** Story table used by both the author and the admin. Actions shown depend on the portal and status. */
@Component({
  selector: 'kv-story-list',
  imports: [FormsModule, RouterLink, DecimalPipe, DatePipe, TranslatePipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'stories.listTitle' | translate }}</h1>
      <a [routerLink]="base + '/stories/create'" class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        {{ 'stories.newStory' | translate }}
      </a>
    </div>

    <div class="mt-4 flex flex-wrap gap-3">
      <input
        type="search"
        [ngModel]="search()"
        (ngModelChange)="onSearch($event)"
        [placeholder]="'stories.searchPlaceholder' | translate"
        class="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <select
        [ngModel]="status()"
        (ngModelChange)="onStatus($event)"
        class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="">{{ 'stories.allStatuses' | translate }}</option>
        @for (s of statuses; track s) {
          <option [value]="s">{{ ('status.' + s) | translate }}</option>
        }
      </select>
    </div>

    @if (message(); as msg) {
      <p role="status" class="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ msg }}</p>
    }
    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (result(); as r) {
      @if (r.items.length === 0) {
        <p class="mt-8 text-slate-500">{{ 'stories.empty' | translate }}</p>
      } @else {
        <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead class="bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th class="px-3 py-2">{{ 'common.title' | translate }}</th>
                <th class="px-3 py-2">{{ 'common.status' | translate }}</th>
                <th class="px-3 py-2">{{ 'access.FREE' | translate }} / {{ 'access.PREMIUM' | translate }}</th>
                <th class="px-3 py-2 text-right">{{ 'common.pages' | translate }}</th>
                <th class="hidden px-3 py-2 text-right md:table-cell">{{ 'common.views' | translate }}</th>
                <th class="hidden px-3 py-2 md:table-cell">{{ 'common.updated' | translate }}</th>
                <th class="px-3 py-2">{{ 'common.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (s of r.items; track s.id) {
                <tr>
                  <td class="px-3 py-2">
                    <a [routerLink]="base + '/stories/' + s.id + '/edit'" class="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{{ s.title }}</a>
                    @if (portal === 'admin') {
                      <div class="text-xs text-slate-500">{{ s.authorName }}</div>
                    }
                    @if (s.publicationStatus === 'REJECTED' && s.rejectionReason) {
                      <div class="mt-1 text-xs text-red-700 dark:text-red-300">{{ 'stories.rejectionNote' | translate: { reason: s.rejectionReason } }}</div>
                    }
                  </td>
                  <td class="px-3 py-2"><kv-status-badge [status]="s.publicationStatus" /></td>
                  <td class="px-3 py-2">
                    {{ ('access.' + s.accessType) | translate }}
                    @if (s.accessType === 'PREMIUM') {
                      <span class="text-slate-500">· ₹{{ s.pricePaise / 100 | number: '1.0-2' }}</span>
                    }
                  </td>
                  <td class="px-3 py-2 text-right">{{ s.pageCount }}</td>
                  <td class="hidden px-3 py-2 text-right md:table-cell">{{ s.viewCount | number }}</td>
                  <td class="hidden px-3 py-2 md:table-cell">{{ s.updatedAt | date: 'mediumDate' }}</td>
                  <td class="px-3 py-2">
                    <div class="flex flex-wrap gap-2">
                      <a [routerLink]="base + '/stories/' + s.id + '/pages'" class="kv-link">{{ 'stories.pagesAction' | translate }}</a>
                      @if (portal === 'author' && (s.publicationStatus === 'DRAFT' || s.publicationStatus === 'REJECTED')) {
                        <button type="button" class="kv-link" (click)="submit(s)">{{ 'stories.submit' | translate }}</button>
                      }
                      @if (portal === 'admin') {
                        <button type="button" class="kv-icon" [attr.aria-label]="'stories.downloadPdf' | translate" [title]="'stories.downloadPdf' | translate" (click)="downloadPdf(s)">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
                          </svg>
                        </button>
                      }
                      @if (portal === 'admin') {
                        @if (s.publicationStatus === 'PENDING_APPROVAL') {
                          <button type="button" class="kv-link" (click)="run(s, 'approve')">{{ 'stories.approve' | translate }}</button>
                          <button type="button" class="kv-link text-red-600 dark:text-red-400" (click)="toggleReject(s.id)">{{ 'stories.reject' | translate }}</button>
                        }
                        @if (s.publicationStatus === 'DRAFT' || s.publicationStatus === 'ARCHIVED') {
                          <button type="button" class="kv-link" (click)="run(s, 'publish')">{{ 'stories.publish' | translate }}</button>
                        }
                        @if (s.publicationStatus === 'PUBLISHED' || s.publicationStatus === 'PENDING_APPROVAL') {
                          <button type="button" class="kv-link" (click)="run(s, 'unpublish')">{{ 'stories.unpublish' | translate }}</button>
                        }
                        @if (s.publicationStatus !== 'ARCHIVED') {
                          <button type="button" class="kv-link" (click)="run(s, 'archive')">{{ 'stories.archive' | translate }}</button>
                        }
                      }
                      @if (s.publicationStatus === 'DRAFT' || s.publicationStatus === 'REJECTED') {
                        <button type="button" class="kv-link text-red-600 dark:text-red-400" (click)="remove(s)">{{ 'common.delete' | translate }}</button>
                      }
                    </div>
                  </td>
                </tr>
                @if (rejectingId() === s.id) {
                  <tr>
                    <td colspan="7" class="px-3 pb-3">
                      <label class="block text-sm">
                        <span class="font-medium">{{ 'stories.rejectReason' | translate }}</span>
                        <textarea [ngModel]="reason()" (ngModelChange)="reason.set($event)" rows="2" maxlength="1000" class="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"></textarea>
                      </label>
                      <button type="button" class="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700" [disabled]="reason().trim().length < 3" (click)="confirmReject(s)">{{ 'stories.reject' | translate }}</button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex items-center justify-between text-sm">
          <button type="button" class="kv-btn" [disabled]="r.meta.page <= 1" (click)="goto(r.meta.page - 1)">{{ 'common.previous' | translate }}</button>
          <span>{{ 'common.page' | translate: { page: r.meta.page, total: r.meta.totalPages } }}</span>
          <button type="button" class="kv-btn" [disabled]="r.meta.page >= r.meta.totalPages" (click)="goto(r.meta.page + 1)">{{ 'common.next' | translate }}</button>
        </div>
      }
    }

  `,
  styles: `
    .kv-link { color: rgb(79 70 229); font-size: 0.875rem; }
    .kv-link:hover { text-decoration: underline; }
    .kv-icon { display: inline-flex; color: rgb(79 70 229); }
    .kv-icon:hover { color: rgb(67 56 202); }
    .kv-btn { border: 1px solid rgb(203 213 225); border-radius: 0.375rem; padding: 0.375rem 0.75rem; }
    .kv-btn:disabled { opacity: 0.5; }
  `,
})
export class StoryListComponent {
  private readonly api = inject(StoriesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmService);

  readonly portal: Portal = this.route.snapshot.data['portal'];
  readonly base = `/${this.portal}`;
  readonly statuses = STATUSES;

  readonly search = signal('');
  readonly status = signal<StoryStatus | ''>('');
  readonly page = signal(1);
  readonly result = signal<Paginated<Story> | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  /** Story whose reject reason box is open, and the reason typed so far. */
  readonly rejectingId = signal<string | null>(null);
  readonly reason = signal('');

  private readonly searchInput$ = new Subject<string>();
  private readonly refresh$ = new Subject<void>();

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((text) => {
        this.search.set(text);
        this.page.set(1);
        this.refresh$.next();
      });

    this.refresh$
      .pipe(
        startWith(undefined),
        switchMap(() =>
          this.api
            .list(this.portal, { page: this.page(), limit: 10, status: this.status(), search: this.search() })
            .pipe(
              tap(() => this.error.set(null)),
              catchError((err: unknown) => {
                this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result) this.result.set(result);
      });
  }

  onSearch(text: string): void {
    this.searchInput$.next(text);
  }

  onStatus(value: StoryStatus | ''): void {
    this.status.set(value);
    this.page.set(1);
    this.refresh$.next();
  }

  goto(page: number): void {
    this.page.set(page);
    this.refresh$.next();
  }

  submit(story: Story): void {
    this.api.submit(story.id).subscribe({
      next: () => this.done('stories.submitted'),
      error: (err: unknown) => this.fail(err),
    });
  }

  toggleReject(id: string): void {
    this.reason.set('');
    this.rejectingId.set(this.rejectingId() === id ? null : id);
  }

  confirmReject(story: Story): void {
    this.api.reject(story.id, this.reason().trim()).subscribe({
      next: () => {
        this.rejectingId.set(null);
        this.done('stories.rejected');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  run(story: Story, action: 'approve' | 'publish' | 'unpublish' | 'archive'): void {
    this.api.workflow(story.id, action).subscribe({
      next: () => this.done(`stories.${action === 'approve' ? 'approved' : action === 'publish' ? 'published' : action === 'unpublish' ? 'unpublished' : 'archived'}`),
      error: (err: unknown) => this.fail(err),
    });
  }

  async remove(story: Story): Promise<void> {
    if (!(await this.confirm.ask('stories.deleteConfirm'))) return;
    this.api.remove(this.portal, story.id).subscribe({
      next: () => this.done('stories.deleted'),
      error: (err: unknown) => this.fail(err),
    });
  }

  /** Downloads the published version as a PDF book. The server refuses stories that were never published. */
  downloadPdf(story: Story): void {
    this.api.downloadPdf(story.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${story.slug}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.message.set(null);
        this.error.set(translate('stories.downloadFailed'));
      },
    });
  }

  private done(key: string): void {
    this.message.set(translate(key));
    this.error.set(null);
    this.refresh$.next();
  }

  private fail(err: unknown): void {
    this.message.set(null);
    this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
  }
}
