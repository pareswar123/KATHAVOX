import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';

const DARK_KEY = 'kv.darkMode';
const FONT_KEY = 'kv.fontSize';
const FONT_STEPS = [16, 18, 20, 22, 24];

/**
 * Reader preferences kept in localStorage. Dark mode is applied as a class on <html>,
 * which the Tailwind "dark" variant listens for.
 */
@Injectable({ providedIn: 'root' })
export class ReadingPrefsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(this.platformId);

  readonly darkMode = signal(this.read(DARK_KEY) === 'true');
  readonly fontSize = signal(Number(this.read(FONT_KEY)) || FONT_STEPS[1]);

  constructor() {
    effect(() => {
      const dark = this.darkMode();
      this.document.documentElement.classList.toggle('dark', dark);
      this.write(DARK_KEY, String(dark));
    });
    effect(() => this.write(FONT_KEY, String(this.fontSize())));
  }

  toggleDark(): void {
    this.darkMode.update((v) => !v);
  }

  biggerFont(): void {
    this.stepFont(1);
  }

  smallerFont(): void {
    this.stepFont(-1);
  }

  private stepFont(direction: 1 | -1): void {
    const index = FONT_STEPS.indexOf(this.fontSize());
    const next = Math.min(FONT_STEPS.length - 1, Math.max(0, (index < 0 ? 1 : index) + direction));
    this.fontSize.set(FONT_STEPS[next]);
  }

  private read(key: string): string | null {
    return this.browser ? localStorage.getItem(key) : null;
  }

  private write(key: string, value: string): void {
    if (this.browser) localStorage.setItem(key, value);
  }
}
