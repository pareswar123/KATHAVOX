import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SubscriptionsApi } from '../../core/api/subscriptions.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { SubscriptionPlan } from '../../core/models/subscription.model';

/** Admin screen to configure monthly, quarterly, yearly (or any) subscription plans. */
@Component({
  selector: 'kv-subscription-plans',
  imports: [ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'subscriptions.admin.title' | translate }}</h1>
    <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ 'subscriptions.admin.intro' | translate }}</p>

    @if (message(); as msg) {
      <p role="status" class="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ msg }}</p>
    }
    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    <div class="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section>
        @if (plans().length === 0) {
          <p class="text-slate-500">{{ 'subscriptions.admin.empty' | translate }}</p>
        }
        <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead class="text-left text-slate-600 dark:text-slate-400">
            <tr>
              <th class="py-2">{{ 'common.name' | translate }}</th>
              <th class="py-2 text-right">{{ 'common.price' | translate }}</th>
              <th class="py-2 text-right">{{ 'subscriptions.admin.days' | translate }}</th>
              <th class="py-2">{{ 'common.status' | translate }}</th>
              <th class="py-2">{{ 'common.actions' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            @for (p of plans(); track p.id) {
              <tr>
                <td class="py-2 font-medium">{{ p.name }}<div class="text-xs font-normal text-slate-500">{{ p.description }}</div></td>
                <td class="py-2 text-right">₹{{ rupees(p.pricePaise) }}</td>
                <td class="py-2 text-right">{{ p.durationDays }}</td>
                <td class="py-2">{{ (p.isActive ? 'common.active' : 'common.inactive') | translate }}</td>
                <td class="py-2">
                  <div class="flex gap-3">
                    <button type="button" class="text-indigo-600 hover:underline dark:text-indigo-400" (click)="edit(p)">{{ 'common.edit' | translate }}</button>
                    <button type="button" class="hover:underline" (click)="toggle(p)">
                      {{ (p.isActive ? 'subscriptions.admin.deactivate' : 'subscriptions.admin.activate') | translate }}
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>

      <section class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 class="font-medium">{{ (editingId() ? 'subscriptions.admin.editPlan' : 'subscriptions.admin.newPlan') | translate }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()" class="mt-3 space-y-3" novalidate>
          <label class="block text-sm">
            <span class="font-medium">{{ 'common.name' | translate }}</span>
            <input formControlName="name" maxlength="100" class="kv-input" [placeholder]="'subscriptions.admin.namePlaceholder' | translate" />
          </label>
          <label class="block text-sm">
            <span class="font-medium">{{ 'common.description' | translate }}</span>
            <textarea formControlName="description" rows="2" maxlength="1000" class="kv-input"></textarea>
          </label>
          <label class="block text-sm">
            <span class="font-medium">{{ 'common.price' | translate }}</span>
            <input type="number" min="0" step="0.01" formControlName="priceRupees" class="kv-input" />
          </label>
          <label class="block text-sm">
            <span class="font-medium">{{ 'subscriptions.admin.days' | translate }}</span>
            <input type="number" min="1" max="3650" step="1" formControlName="durationDays" class="kv-input" />
          </label>
          <div class="flex gap-2">
            <button type="submit" [disabled]="form.invalid" class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {{ 'common.save' | translate }}
            </button>
            @if (editingId()) {
              <button type="button" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700" (click)="reset()">{{ 'common.cancel' | translate }}</button>
            }
          </div>
        </form>
      </section>
    </div>
  `,
  styles: `
    .kv-input { margin-top: 0.25rem; width: 100%; border-radius: 0.375rem; border: 1px solid rgb(203 213 225); padding: 0.5rem 0.75rem; background: white; color: rgb(15 23 42); }
  `,
})
export class SubscriptionPlansComponent {
  private readonly api = inject(SubscriptionsApi);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    priceRupees: [0, [Validators.required, Validators.min(0.01)]],
    durationDays: [30, [Validators.required, Validators.min(1), Validators.max(3650)]],
  });

  constructor() {
    this.load();
  }

  rupees(paise: number): string {
    return (paise / 100).toFixed(2);
  }

  edit(plan: SubscriptionPlan): void {
    this.editingId.set(plan.id);
    this.form.setValue({
      name: plan.name,
      description: plan.description,
      priceRupees: plan.pricePaise / 100,
      durationDays: plan.durationDays,
    });
  }

  reset(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', description: '', priceRupees: 0, durationDays: 30 });
  }

  save(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const body = {
      name: raw.name,
      description: raw.description,
      pricePaise: Math.round(Number(raw.priceRupees) * 100),
      durationDays: Number(raw.durationDays),
    };
    const id = this.editingId();
    const request = id ? this.api.update(id, body) : this.api.create(body);
    request.subscribe({
      next: () => {
        this.reset();
        this.done(translate('subscriptions.admin.saved'));
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  toggle(plan: SubscriptionPlan): void {
    this.api.update(plan.id, { isActive: !plan.isActive }).subscribe({
      next: () => this.done(translate('subscriptions.admin.saved')),
      error: (err: unknown) => this.fail(err),
    });
  }

  private load(): void {
    this.api
      .adminPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.plans.set(list),
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
