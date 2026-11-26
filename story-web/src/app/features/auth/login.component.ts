import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore, UserRole } from '../../core/auth/auth.store';
import { ROUTES } from '../../core/config/endpoints';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

const HOME_BY_ROLE: Record<UserRole, string> = {
  ADMIN: ROUTES.adminDashboard,
  AUTHOR: ROUTES.authorDashboard,
  READER: ROUTES.readerLibrary,
};

@Component({
  selector: 'kv-login',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'auth.login.title' | translate }}</h1>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {{ 'auth.login.intro' | translate }}
        <a [routerLink]="registerRoute" class="font-medium text-indigo-600 dark:text-indigo-400">{{
          'auth.login.registerLink' | translate
        }}</a>
      </p>

      @if (notice(); as msg) {
        <p role="status" class="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{{ msg }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-4" novalidate>
        <label class="block">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ 'auth.login.email' | translate }}</span>
          <input
            type="email"
            formControlName="email"
            autocomplete="username"
            class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label class="block">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ 'auth.login.password' | translate }}</span>
          <input
            type="password"
            formControlName="password"
            autocomplete="current-password"
            class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        @if (error()) {
          <p role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {{ error() }}
          </p>
        }

        <button
          type="submit"
          [disabled]="form.invalid || submitting()"
          class="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ (submitting() ? 'auth.login.submitting' : 'auth.login.submit') | translate }}
        </button>
      </form>

      <p class="mt-4 text-sm">
        <a [routerLink]="forgotRoute" class="font-medium text-indigo-600 dark:text-indigo-400">{{ 'auth.login.forgotPassword' | translate }}</a>
      </p>
    </section>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly authorRegisterRoute = ROUTES.authorRegister;
  readonly registerRoute = '/auth/register';
  readonly forgotRoute = '/auth/forgot-password';
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  /** Shown after the session ended and the user was sent here. */
  readonly notice = signal<string | null>(
    this.route.snapshot.queryParamMap.get('expired') ? translate('auth.login.sessionExpired') : null,
  );

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const role = this.store.roles()[0];
        const target = returnUrl?.startsWith('/') ? returnUrl : role ? HOME_BY_ROLE[role] : ROUTES.home;
        void this.router.navigateByUrl(target);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(err instanceof ApiError ? err.message : translate('auth.login.failed'));
      },
    });
  }
}
