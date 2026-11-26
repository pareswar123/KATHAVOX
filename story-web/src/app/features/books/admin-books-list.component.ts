import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, Subject, tap } from 'rxjs';
import { AdminBook, BooksApi } from '../../core/api/books.api';
import { ApiError } from '../../core/http/error.interceptor';
import { Paginated } from '../../core/models/story.model';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { ConfirmService } from '../../shared/confirm/confirm.service';

/** Admin list of books: create, publish, unpublish, edit, download PDF, delete drafts. */
@Component({
  selector: 'kv-admin-books-list',
  imports: [RouterLink, DatePipe, DecimalPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'books.admin.title' | translate }}</h1>
      <a routerLink="/admin/books/create" class="kv-primary">{{ 'books.admin.create' | translate }}</a>
    </div>

    @if (message(); as msg) {
      <p role="status" class="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ msg }}</p>
    }
    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (result(); as r) {
      @if (r.items.length === 0) {
        <p class="mt-8 text-slate-500">{{ 'books.admin.empty' | translate }}</p>
      } @else {
        <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead class="bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th class="px-3 py-2">{{ 'books.admin.col.title' | translate }}</th>
                <th class="px-3 py-2">{{ 'books.admin.col.status' | translate }}</th>
                <th class="px-3 py-2">{{ 'books.admin.col.access' | translate }}</th>
                <th class="px-3 py-2 text-right">{{ 'books.admin.col.stories' | translate }}</th>
                <th class="hidden px-3 py-2 md:table-cell">{{ 'books.admin.col.updated' | translate }}</th>
                <th class="px-3 py-2">{{ 'books.admin.col.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (b of r.items; track b.id) {
                <tr>
                  <td class="px-3 py-2 font-medium">{{ b.title }}</td>
                  <td class="px-3 py-2">{{ ('books.status.' + b.status) | translate }}</td>
                  <td class="px-3 py-2">
                    @if (b.accessType === 'PREMIUM') {
                      ₹{{ b.pricePaise / 100 | number: '1.2-2' }}
                    } @else {
                      {{ 'books.free' | translate }}
                    }
                  </td>
                  <td class="px-3 py-2 text-right">{{ b.storyCount }}</td>
                  <td class="hidden px-3 py-2 md:table-cell">{{ b.updatedAt | date: 'dd-MM-yyyy' : 'Asia/Kolkata' }}</td>
                  <td class="px-3 py-2">
                    <div class="flex flex-wrap gap-2">
                      <a [routerLink]="'/admin/books/' + b.id + '/edit'" class="kv-link">{{ 'books.admin.edit' | translate }}</a>
                      @if (b.status !== 'PUBLISHED') {
                        <button type="button" class="kv-link" (click)="publish(b)">{{ 'books.admin.publish' | translate }}</button>
                      }
                      @if (b.status === 'PUBLISHED') {
                        <button type="button" class="kv-link" (click)="unpublish(b)">{{ 'books.admin.unpublish' | translate }}</button>
                        <button type="button" class="kv-link" (click)="downloadPdf(b)">{{ 'books.admin.pdf' | translate }}</button>
                      }
                      @if (b.status === 'DRAFT') {
                        <button type="button" class="kv-link text-red-600 dark:text-red-400" (click)="remove(b)">{{ 'common.delete' | translate }}</button>
                      }
                    </div>
                  </td>
                </tr>
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
    .kv-primary { border-radius: 0.5rem; background: rgb(79 70 229); padding: 0.5rem 0.9rem; color: #fff; font-size: 0.875rem; font-weight: 500; }
    .kv-primary:hover { background: rgb(67 56 202); }
    .kv-link { color: rgb(79 70 229); font-size: 0.875rem; }
    .kv-link:hover { text-decoration: underline; }
    .kv-btn { border: 1px solid rgb(203 213 225); border-radius: 0.375rem; padding: 0.4rem 0.75rem; }
    .kv-btn:disabled { opacity: 0.5; }
  `,
})
export class AdminBooksListComponent {
  private readonly api = inject(BooksApi);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly page = signal(1);
  readonly result = signal<Paginated<AdminBook> | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  private readonly refresh$ = new Subject<void>();

  constructor() {
    this.refresh$
      .pipe(
        switchMap(() =>
          this.api.adminList(this.page()).pipe(
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

  publish(book: AdminBook): void {
    this.act(this.api.publish(book.id), 'books.admin.published');
  }

  unpublish(book: AdminBook): void {
    this.act(this.api.unpublish(book.id), 'books.admin.unpublished');
  }

  async remove(book: AdminBook): Promise<void> {
    if (!(await this.confirm.ask('books.admin.deleteConfirm'))) return;
    this.api.remove(book.id).subscribe({
      next: () => this.done('books.admin.deleted'),
      error: (err: unknown) => this.fail(err),
    });
  }

  downloadPdf(book: AdminBook): void {
    this.api.pdf(book.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${book.slug}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private act(request: ReturnType<BooksApi['publish']>, key: string): void {
    request.subscribe({
      next: () => this.done(key),
      error: (err: unknown) => this.fail(err),
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
