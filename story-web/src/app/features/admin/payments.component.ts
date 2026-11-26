import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { catchError, of, switchMap, Subject, tap } from 'rxjs';
import { AdminPaymentsResponse, PaymentsApi } from '../../core/api/payments.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

/** Calendar day in India (YYYY-MM-DD). The default range is always today. */
function todayIst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

interface Filter {
  from: string;
  to: string;
  status: string;
  type: string;
}

/** Admin list of every payment. Filters apply when Search is pressed; Export downloads the whole range as Excel. */
@Component({
  selector: 'kv-admin-payments',
  imports: [DatePipe, DecimalPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'payments.title' | translate }}</h1>

    <form class="kv-filters mt-4" (submit)="$event.preventDefault(); search()">
      <label class="kv-field">
        <span>{{ 'payments.from' | translate }}</span>
        <input type="date" class="kv-input" [value]="draftFrom()" (change)="setDraft('from', $any($event.target).value)" />
      </label>
      <label class="kv-field">
        <span>{{ 'payments.to' | translate }}</span>
        <input type="date" class="kv-input" [value]="draft().to" (change)="setDraft('to', $any($event.target).value)" />
      </label>
      <label class="kv-field">
        <span>{{ 'payments.status' | translate }}</span>
        <select class="kv-input" [value]="draft().status" (change)="setDraft('status', $any($event.target).value)">
          <option value="ALL">{{ 'payments.all' | translate }}</option>
          <option value="SUCCESS">{{ 'payments.statusSuccess' | translate }}</option>
          <option value="PENDING">{{ 'payments.statusPending' | translate }}</option>
          <option value="FAILED">{{ 'payments.statusFailed' | translate }}</option>
          <option value="REFUNDED">{{ 'payments.statusRefunded' | translate }}</option>
        </select>
      </label>
      <label class="kv-field">
        <span>{{ 'payments.type' | translate }}</span>
        <select class="kv-input" [value]="draft().type" (change)="setDraft('type', $any($event.target).value)">
          <option value="ALL">{{ 'payments.all' | translate }}</option>
          <option value="STORY_PURCHASE">{{ 'payments.typeStory' | translate }}</option>
          <option value="SUBSCRIPTION">{{ 'payments.typeSubscription' | translate }}</option>
        </select>
      </label>
      <div class="kv-actions">
        <button type="submit" class="kv-btn kv-btn-primary">{{ 'payments.search' | translate }}</button>
        <button type="button" class="kv-btn" (click)="clear()">{{ 'payments.clear' | translate }}</button>
        <button type="button" class="kv-btn kv-btn-excel" [disabled]="exporting()" (click)="exportExcel()">
          {{ (exporting() ? 'payments.exporting' : 'payments.exportExcel') | translate }}
        </button>
      </div>
    </form>

    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    @if (result(); as r) {
      <p class="mt-4 text-sm text-slate-600 dark:text-slate-400">
        {{ 'payments.totals' | translate: { rows: r.totals.rows, amount: (r.totals.successPaise / 100 | number: '1.2-2') ?? '0' } }}
      </p>

      @if (r.items.length === 0) {
        <p class="mt-6 text-slate-500">{{ 'payments.empty' | translate }}</p>
      } @else {
        <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead class="bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th class="px-3 py-2">{{ 'payments.col.when' | translate }}</th>
                <th class="px-3 py-2">{{ 'payments.col.type' | translate }}</th>
                <th class="px-3 py-2">{{ 'payments.col.item' | translate }}</th>
                <th class="px-3 py-2">{{ 'payments.col.buyer' | translate }}</th>
                <th class="px-3 py-2 text-right">{{ 'payments.col.amount' | translate }}</th>
                <th class="px-3 py-2">{{ 'payments.col.status' | translate }}</th>
                <th class="hidden px-3 py-2 md:table-cell">{{ 'payments.col.order' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (p of r.items; track p.id) {
                <tr>
                  <td class="px-3 py-2 whitespace-nowrap">{{ p.occurredAt | date: 'dd-MM-yyyy h:mm a' : 'Asia/Kolkata' }}</td>
                  <td class="px-3 py-2">{{ ('payments.typeName.' + p.type) | translate }}</td>
                  <td class="px-3 py-2">{{ p.item }}</td>
                  <td class="px-3 py-2">{{ p.buyerEmail }}</td>
                  <td class="px-3 py-2 text-right">₹{{ p.amountPaise / 100 | number: '1.2-2' }}</td>
                  <td class="px-3 py-2">{{ ('payments.statusName.' + p.status) | translate }}</td>
                  <td class="hidden px-3 py-2 font-mono text-xs md:table-cell">{{ p.paymentId || p.orderId }}</td>
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
    .kv-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; }
    .kv-field { display: flex; flex-direction: column; font-size: 0.875rem; font-weight: 500; color: rgb(51 65 85); }
    :host-context(.dark) .kv-field { color: rgb(203 213 225); }
    .kv-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .kv-input {
      margin-top: 0.25rem;
      display: block;
      min-width: 10.5rem;
      border-radius: 0.5rem;
      border: 1px solid rgb(203 213 225);
      padding: 0.5rem 0.75rem;
      background: #fff;
      color: #0f172a;
      font-size: 0.875rem;
      font-weight: 400;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .kv-input:focus { outline: none; border-color: rgb(99 102 241); box-shadow: 0 0 0 3px rgb(99 102 241 / 0.25); }
    .kv-input[type='date']::-webkit-calendar-picker-indicator { cursor: pointer; border-radius: 0.25rem; padding: 0.2rem; opacity: 0.7; }
    .kv-input[type='date']::-webkit-calendar-picker-indicator:hover { opacity: 1; background: rgb(226 232 240); }
    .kv-btn {
      border: 1px solid rgb(203 213 225);
      border-radius: 0.5rem;
      padding: 0.5rem 0.9rem;
      background: #fff;
      color: #334155;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .kv-btn:hover:not(:disabled) { background: rgb(241 245 249); }
    .kv-btn:disabled { opacity: 0.5; cursor: default; }
    .kv-btn-primary { background: rgb(79 70 229); border-color: rgb(79 70 229); color: #fff; }
    .kv-btn-primary:hover:not(:disabled) { background: rgb(67 56 202); }
    .kv-btn-excel { background: rgb(22 163 74); border-color: rgb(22 163 74); color: #fff; }
    .kv-btn-excel:hover:not(:disabled) { background: rgb(21 128 61); }
    :host-context(.dark) .kv-input {
      background: rgb(15 23 42);
      border-color: rgb(51 65 85);
      color: rgb(241 245 249);
      color-scheme: dark;
    }
    :host-context(.dark) .kv-input:focus { border-color: rgb(129 140 248); box-shadow: 0 0 0 3px rgb(129 140 248 / 0.3); }
    :host-context(.dark) .kv-btn { background: rgb(15 23 42); border-color: rgb(51 65 85); color: rgb(226 232 240); }
    :host-context(.dark) .kv-btn:hover:not(:disabled) { background: rgb(30 41 59); }
    :host-context(.dark) .kv-btn-primary { background: rgb(79 70 229); border-color: rgb(79 70 229); color: #fff; }
    :host-context(.dark) .kv-btn-primary:hover:not(:disabled) { background: rgb(99 102 241); }
  `,
})
export class AdminPaymentsComponent {
  private readonly api = inject(PaymentsApi);
  private readonly destroyRef = inject(DestroyRef);

  /** What the user is editing in the filter row. */
  readonly draft = signal<Filter>({ from: todayIst(), to: todayIst(), status: 'ALL', type: 'ALL' });
  /** Values shown in the date inputs (read through methods so the template stays simple). */
  draftFrom(): string {
    return this.draft().from;
  }

  /** What the list currently shows. Changes only when Search (or Clear) is pressed. */
  private applied: Filter = { ...this.draft() };
  readonly page = signal(1);
  readonly result = signal<AdminPaymentsResponse | null>(null);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);

  private readonly refresh$ = new Subject<void>();

  constructor() {
    this.refresh$
      .pipe(
        switchMap(() =>
          this.api
            .adminPayments({ ...this.applied, page: this.page() })
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
      .subscribe((res) => {
        if (res) this.result.set(res);
      });
    this.refresh$.next();
  }

  setDraft<K extends keyof Filter>(key: K, value: Filter[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value || (key === 'from' || key === 'to' ? todayIst() : value) }));
  }

  search(): void {
    this.applied = { ...this.draft() };
    this.page.set(1);
    this.refresh$.next();
  }

  clear(): void {
    this.draft.set({ from: todayIst(), to: todayIst(), status: 'ALL', type: 'ALL' });
    this.search();
  }

  goto(page: number): void {
    this.page.set(page);
    this.refresh$.next();
  }

  /** Downloads every payment matching the applied filter as an Excel file. */
  exportExcel(): void {
    this.exporting.set(true);
    this.error.set(null);
    this.api.exportAdmin(this.applied).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `payments-${this.applied.from}-to-${this.applied.to}.xlsx`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: (err: unknown) => {
        this.exporting.set(false);
        this.error.set(err instanceof ApiError ? err.message : translate('payments.exportFailed'));
      },
    });
  }
}
