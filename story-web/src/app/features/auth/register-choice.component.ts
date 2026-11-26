import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Asks whether the visitor wants a reader account or an author account. */
@Component({
  selector: 'kv-register-choice',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ 'auth.register.title' | translate }}</h1>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ 'auth.register.intro' | translate }}</p>

      <div class="mt-6 grid gap-4">
        <a routerLink="/auth/reader/register" class="rounded-lg border border-slate-200 p-4 hover:border-indigo-400 dark:border-slate-800">
          <p class="font-semibold text-slate-900 dark:text-slate-100">{{ 'auth.register.readerTitle' | translate }}</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ 'auth.register.readerBody' | translate }}</p>
        </a>
        <a routerLink="/auth/author/register" class="rounded-lg border border-slate-200 p-4 hover:border-indigo-400 dark:border-slate-800">
          <p class="font-semibold text-slate-900 dark:text-slate-100">{{ 'auth.register.authorTitle' | translate }}</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ 'auth.register.authorBody' | translate }}</p>
        </a>
      </div>
      <p class="mt-6 text-sm"><a routerLink="/auth/login" class="text-indigo-600 dark:text-indigo-400">{{ 'auth.register.haveAccount' | translate }}</a></p>
    </section>
  `,
})
export class RegisterChoiceComponent {}
