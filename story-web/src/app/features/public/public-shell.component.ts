import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ROUTES } from '../../core/config/endpoints';
import { ReadingPrefsService } from '../../core/reading/reading-prefs.service';
import { StorySearchService } from '../../core/search/story-search.service';
import { TranslatePipe } from '../../core/i18n/i18n';
import { ConfirmDialogComponent } from '../../shared/confirm/confirm.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';

/** Header and footer for pages anyone can open, logged in or not. */
@Component({
  selector: 'kv-public-shell',
  imports: [RouterOutlet, RouterLink, TranslatePipe, ConfirmDialogComponent, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="border-b border-slate-200 dark:border-slate-800">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <a routerLink="/" class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ 'placeholder.home' | translate }}</a>
        <nav class="flex flex-wrap items-center gap-2 text-sm sm:gap-4">
          <a routerLink="/" class="text-slate-700 hover:underline dark:text-slate-300">{{ 'public.nav.home' | translate }}</a>
          <a routerLink="/books" class="text-slate-700 hover:underline dark:text-slate-300">{{ 'public.nav.books' | translate }}</a>
          <form [hidden]="!showSearch()" (submit)="search(q.value); $event.preventDefault()" class="flex">
            <input
              #q
              type="search"
              (search)="search(q.value)"
              [placeholder]="'public.nav.searchPlaceholder' | translate"
              class="w-28 rounded-l-md border sm:w-40 border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button type="submit" class="rounded-r-md border border-l-0 border-slate-300 px-2 py-1 text-sm dark:border-slate-700">
              {{ 'public.nav.search' | translate }}
            </button>
          </form>
          <kv-theme-toggle />
          @if (user()) {
            @if (dashboardLink()) {
              <a [routerLink]="dashboardLink()" class="text-indigo-600 hover:underline dark:text-indigo-400">{{ 'public.nav.dashboard' | translate }}</a>
            }
            @if (isReader()) {
              <a routerLink="/reader/my-library" class="text-indigo-600 hover:underline dark:text-indigo-400">{{ 'public.nav.library' | translate }}</a>
            }
            <button type="button" (click)="logout()" class="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700">
              {{ 'common.logout' | translate }}
            </button>
          } @else {
            <a [routerLink]="loginLink" class="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700">
              {{ 'public.nav.login' | translate }}
            </a>
          }
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-6">
      <router-outlet />
    </main>
    <footer class="mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs text-slate-500">{{ 'public.footer' | translate }}</footer>
    <kv-confirm-dialog />
  `,
})
export class PublicShellComponent {
  readonly prefs = inject(ReadingPrefsService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly storySearch = inject(StorySearchService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly user = this.store.user;
  readonly loginLink = ROUTES.login;

  /** Current page address, updated on every navigation. */
  private readonly url = signal(this.router.url);

  constructor() {
    // A full page load on a public page must still show a logged-in reader (header, bookmarks).
    void this.auth.ensureSession();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        // OnPush shell: re-render the header so the search box follows the new page.
        this.cdr.markForCheck();
      });
  }

  /** Subscriptions and story pages do not show the header search. */
  showSearch(): boolean {
    return !/^\/(subscriptions|story\/)/.test(this.url());
  }

  dashboardLink(): string | null {
    if (this.store.hasRole('ADMIN')) return ROUTES.adminDashboard;
    if (this.store.hasRole('AUTHOR')) return ROUTES.authorDashboard;
    return null;
  }

  isReader(): boolean {
    return this.store.hasRole('READER');
  }

  /** Header search: sets the in-memory term and opens the home list. An empty term shows all stories. */
  search(text: string): void {
    this.storySearch.term.set(text.trim());
    void this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout().subscribe(() => void this.router.navigateByUrl('/'));
  }
}
