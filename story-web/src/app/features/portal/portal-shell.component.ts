import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ROUTES } from '../../core/config/endpoints';
import { TranslatePipe } from '../../core/i18n/i18n';
import { Portal } from '../../core/models/story.model';
import { ConfirmDialogComponent } from '../../shared/confirm/confirm.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';

interface NavItem {
  labelKey: string;
  path: string;
}

const NAV: Record<Portal, NavItem[]> = {
  author: [
    { labelKey: 'nav.dashboard', path: '/author/dashboard' },
    { labelKey: 'nav.stories', path: '/author/stories' },
    { labelKey: 'nav.newStory', path: '/author/stories/create' },
  ],
  admin: [
    { labelKey: 'nav.dashboard', path: '/admin/dashboard' },
    { labelKey: 'nav.stories', path: '/admin/stories' },
    { labelKey: 'nav.newStory', path: '/admin/stories/create' },
    { labelKey: 'nav.approvals', path: '/admin/approvals' },
    { labelKey: 'nav.catalogue', path: '/admin/catalogue' },
    { labelKey: 'nav.subscriptions', path: '/admin/subscription-plans' },
    { labelKey: 'nav.payments', path: '/admin/payments' },
    { labelKey: 'nav.books', path: '/admin/books' },
  ],
};

/** Layout for the author and admin areas: side navigation, user menu and the confirm dialog. */
@Component({
  selector: 'kv-portal-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ConfirmDialogComponent, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen md:flex">
      <aside class="border-b border-slate-200 bg-slate-50 p-4 md:w-60 md:border-b-0 md:border-r dark:border-slate-800 dark:bg-slate-900">
        <p class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ 'placeholder.home' | translate }}</p>
        <p class="text-xs uppercase tracking-wide text-slate-500">{{ portal }}</p>
        <nav class="mt-4 flex flex-row flex-wrap gap-1 md:flex-col">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
              class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {{ item.labelKey | translate }}
            </a>
          }
        </nav>
      </aside>
      <div class="flex-1">
        <header class="flex items-center justify-end gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <span class="text-sm text-slate-600 dark:text-slate-400">{{ user()?.email }}</span>
          <kv-theme-toggle />
          <button type="button" (click)="logout()" class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
            {{ 'common.logout' | translate }}
          </button>
        </header>
        <main class="mx-auto max-w-6xl px-4 py-6">
          <router-outlet />
        </main>
      </div>
    </div>
    <kv-confirm-dialog />
  `,
})
export class PortalShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly store = inject(AuthStore);

  readonly portal: Portal = this.route.snapshot.data['portal'];
  readonly nav = NAV[this.portal];
  readonly user = this.store.user;

  logout(): void {
    this.auth.logout().subscribe(() => void this.router.navigateByUrl(ROUTES.login));
  }
}
