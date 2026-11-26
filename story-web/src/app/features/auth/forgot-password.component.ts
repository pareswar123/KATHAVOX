import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthFlowsApi } from '../../core/api/auth-flows.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

/** Forgot password: sends a reset link. The same message is shown for every email. */
@Component({
  selector: 'kv-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'auth.forgot.title' | translate }}</h1>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ 'auth.forgot.intro' | translate }}</p>

      @if (sent()) {
        <p role="status" class="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ message() }}</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-4" novalidate>
          <label class="block text-sm">
            <span class="font-medium">{{ 'auth.login.email' | translate }}</span>
            <input type="email" formControlName="email" maxlength="255" class="kv-input" />
          </label>
          @if (error(); as err) {
            <p role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
          }
          <button type="submit" [disabled]="form.invalid || busy()" class="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {{ (busy() ? 'common.saving' : 'auth.forgot.submit') | translate }}
          </button>
        </form>
      }
      <p class="mt-4 text-sm"><a routerLink="/auth/login" class="text-indigo-600 dark:text-indigo-400">{{ 'auth.login.submit' | translate }}</a></p>
    </section>
  `,
  styles: `
    .kv-input { margin-top: 0.25rem; width: 100%; border-radius: 0.375rem; border: 1px solid rgb(203 213 225); padding: 0.5rem 0.75rem; background: white; color: rgb(15 23 42); }
  `,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AuthFlowsApi);

  readonly busy = signal(false);
  readonly sent = signal(false);
  readonly message = signal('');
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.message.set(res.message);
        this.sent.set(true);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
      },
    });
  }
}
