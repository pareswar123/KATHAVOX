import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ReadingPrefsService } from './core/reading/reading-prefs.service';
import { ThemeToggleComponent } from './shared/theme-toggle/theme-toggle.component';

@Component({
  selector: 'kv-root',
  imports: [RouterOutlet, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      @if (floatingTheme()) {
        <div class="fixed right-3 top-3 z-50">
          <kv-theme-toggle />
        </div>
      }
      <router-outlet />
    </div>
  `,
})
export class App {
  // Creating the prefs service here applies the saved dark or light mode at startup.
  private readonly prefs = inject(ReadingPrefsService);
  private readonly router = inject(Router);

  /** True only on routes marked floatingTheme (sign-in and sign-up pages, which have no header). */
  readonly floatingTheme = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.activeRouteHasFloatingTheme()),
    ),
    { initialValue: false },
  );

  private activeRouteHasFloatingTheme(): boolean {
    let route: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data['floatingTheme'] === true;
  }
}
