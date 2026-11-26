import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ROUTES } from '../../core/config/endpoints';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

/** Reached from the email sent after a purchase. Sets the first password for the new reader account. */
@Component({
  selector: 'kv-set-password',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ (isReset ? 'auth.reset.title' : 'auth.setPassword.title') | translate }}</h1>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ (isReset ? 'auth.reset.intro' : 'auth.setPassword.intro') | translate }}</p>

      <form [formGroup]="form" (ngSubmit)="save()" class="mt-6 space-y-4" novalidate>
        <label class="block text-sm">
          <span class="font-medium">{{ 'auth.setPassword.password' | translate }}</span>
          <input type="password" formControlName="password" autocomplete="new-password" class="kv-input" />
        </label>
        <label class="block text-sm">
          <span class="font-medium">{{ 'auth.setPassword.confirm' | translate }}</span>
          <input type="password" formControlName="confirm" autocomplete="new-password" class="kv-input" />
        </label>
        @if (error(); as err) {
          <p role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
        }
        <button type="submit" [disabled]="form.invalid || busy()" class="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {{ (busy() ? 'common.saving' : 'auth.setPassword.submit') | translate }}
        </button>
      </form>
      <p class="mt-4 text-sm"><a [routerLink]="loginRoute" class="text-indigo-600 dark:text-indigo-400">{{ 'auth.login.submit' | translate }}</a></p>
    </section>
  `,
  styles: `
    .kv-input { margin-top: 0.25rem; width: 100%; border-radius: 0.375rem; border: 1px solid rgb(203 213 225); padding: 0.5rem 0.75rem; background: white; color: rgb(15 23 42); }
  `,
})
export class SetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loginRoute = ROUTES.login;
  /** Reset mode comes from the forgot-password link; set mode from a purchase or registration. */
  readonly isReset = this.route.snapshot.data['mode'] === 'reset';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(128)]],
    confirm: ['', [Validators.required]],
  });

  save(): void {
    const { password, confirm } = this.form.getRawValue();
    if (this.form.invalid) return;
    if (password !== confirm) {
      this.error.set(translate('auth.setPassword.mismatch'));
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.auth.resetPassword(this.token, password).subscribe({
      next: () => void this.router.navigate([ROUTES.login], { queryParams: { passwordSet: 1 } }),
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
      },
    });
  }
}
