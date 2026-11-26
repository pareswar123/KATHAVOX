import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReadingPrefsService } from '../../core/reading/reading-prefs.service';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Sun/moon icon button. Shows a sun in dark mode (click for light) and a moon in light mode (click for dark). */
@Component({
  selector: 'kv-theme-toggle',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="prefs.toggleDark()"
      [attr.aria-label]="(prefs.darkMode() ? 'theme.light' : 'theme.dark') | translate"
      [title]="(prefs.darkMode() ? 'theme.light' : 'theme.dark') | translate"
      class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      @if (prefs.darkMode()) {
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke-linecap="round" />
        </svg>
      } @else {
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke-linejoin="round" />
        </svg>
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly prefs = inject(ReadingPrefsService);
}
