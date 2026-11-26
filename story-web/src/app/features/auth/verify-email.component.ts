import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

/** Opened from the verification email. Reads the token from the link and confirms the address. */
@Component({
  selector: 'kv-verify-email',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'auth.verify.title' | translate }}</h1>

      @if (state() === 'working') {
        <p class="mt-6 text-sm text-slate-600 dark:text-slate-400">{{ 'auth.verify.working' | translate }}</p>
      } @else if (state() === 'done') {
        <p role="status" class="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ message() }}</p>
        <p class="mt-4 text-sm"><a routerLink="/auth/login" class="font-medium text-indigo-600 dark:text-indigo-400">{{ 'auth.login.submit' | translate }}</a></p>
      } @else {
        <p role="alert" class="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ message() }}</p>
        <p class="mt-4 text-sm"><a routerLink="/auth/login" class="font-medium text-indigo-600 dark:text-indigo-400">{{ 'auth.login.submit' | translate }}</a></p>
      }
    </section>
  `,
})
export class VerifyEmailComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<'working' | 'done' | 'failed'>('working');
  readonly message = signal('');

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.fail(translate('auth.verify.missing'));
      return;
    }
    this.auth.verifyEmail(token).subscribe({
      next: (res) => {
        this.state.set('done');
        this.message.set(res.message || translate('auth.verify.success'));
      },
      error: (err: unknown) => this.fail(err instanceof ApiError ? err.message : translate('auth.verify.failed')),
    });
  }

  private fail(text: string): void {
    this.state.set('failed');
    this.message.set(text);
  }
}
