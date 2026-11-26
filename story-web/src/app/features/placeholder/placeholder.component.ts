import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Stand-in screen for areas built in later phases. Reads its label key from route data. */
@Component({
  selector: 'kv-placeholder',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ titleKey | translate }}</h1>
      <p class="mt-3 text-slate-600 dark:text-slate-400">{{ 'placeholder.comingSoon' | translate }}</p>
      @if (user()) {
        <p class="mt-6 text-sm text-slate-500">{{ user()?.email }}</p>
      }
    </section>
  `,
})
export class PlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(AuthStore);

  readonly titleKey: string = this.route.snapshot.data['titleKey'] ?? 'placeholder.home';
  readonly user = this.store.user;
}
