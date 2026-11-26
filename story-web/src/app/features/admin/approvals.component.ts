import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StoriesApi } from '../../core/api/stories.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { Story } from '../../core/models/story.model';

/** Admin queue of stories waiting for approval. Approve, or reject with a reason shown to the author. */
@Component({
  selector: 'kv-approvals',
  imports: [FormsModule, RouterLink, DatePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'approvals.title' | translate }}</h1>

    @if (message(); as msg) {
      <p role="status" class="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ msg }}</p>
    }
    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (items().length === 0) {
      <p class="mt-8 text-slate-500">{{ 'approvals.empty' | translate }}</p>
    }

    <ul class="mt-4 space-y-3">
      @for (s of items(); track s.id) {
        <li class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="font-medium text-slate-900 dark:text-slate-100">{{ s.title }}</p>
              <p class="text-sm text-slate-500">{{ s.authorName }} · {{ s.updatedAt | date: 'medium' }} · {{ s.pageCount }} {{ 'common.pages' | translate }}</p>
            </div>
            <div class="flex flex-wrap gap-2 text-sm">
              <a [routerLink]="'/admin/stories/' + s.id + '/edit'" class="rounded-md border border-slate-300 px-3 py-1.5 dark:border-slate-700">{{ 'approvals.preview' | translate }}</a>
              <button type="button" class="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700" (click)="approve(s)">{{ 'stories.approve' | translate }}</button>
              <button type="button" class="rounded-md border border-red-300 px-3 py-1.5 text-red-700 dark:border-red-800 dark:text-red-300" (click)="toggleReject(s.id)">{{ 'stories.reject' | translate }}</button>
            </div>
          </div>
          @if (rejectingId() === s.id) {
            <div class="mt-3 space-y-2">
              <label class="block text-sm">
                <span class="font-medium">{{ 'stories.rejectReason' | translate }}</span>
                <textarea [ngModel]="reason()" (ngModelChange)="reason.set($event)" rows="2" maxlength="1000" class="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"></textarea>
              </label>
              <button type="button" class="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700" [disabled]="reason().trim().length < 3" (click)="reject(s)">
                {{ 'stories.reject' | translate }}
              </button>
            </div>
          }
        </li>
      }
    </ul>
  `,
})
export class ApprovalsComponent {
  private readonly api = inject(StoriesApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<Story[]>([]);
  readonly rejectingId = signal<string | null>(null);
  readonly reason = signal('');
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  approve(story: Story): void {
    this.api.workflow(story.id, 'approve').subscribe({
      next: () => this.done(translate('stories.approved')),
      error: (err: unknown) => this.fail(err),
    });
  }

  toggleReject(id: string): void {
    this.reason.set('');
    this.rejectingId.set(this.rejectingId() === id ? null : id);
  }

  reject(story: Story): void {
    this.api.reject(story.id, this.reason().trim()).subscribe({
      next: () => {
        this.rejectingId.set(null);
        this.done(translate('stories.rejected'));
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private load(): void {
    this.api
      .approvals({ page: 1, limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.items.set(result.items),
        error: (err: unknown) => this.fail(err),
      });
  }

  private done(text: string): void {
    this.message.set(text);
    this.error.set(null);
    this.load();
  }

  private fail(err: unknown): void {
    this.message.set(null);
    this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
  }
}
