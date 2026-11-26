import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReaderApi } from '../../core/api/reader.api';
import { AuthStore } from '../../core/auth/auth.store';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Save a story to the reader's bookmarks, or remove it. Shown only to logged-in readers. */
@Component({
  selector: 'kv-bookmark-button',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.isAuthenticated()) {
      <button
        type="button"
        (click)="toggle()"
        [disabled]="busy()"
        [attr.aria-pressed]="saved()"
        class="rounded-md border border-indigo-500 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-950"
      >
        {{ (saved() ? 'bookmark.remove' : 'bookmark.add') | translate }}
      </button>
    }
  `,
})
export class BookmarkButtonComponent {
  readonly storyId = input.required<string>();
  readonly auth = inject(AuthStore);
  private readonly api = inject(ReaderApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly saved = signal(false);
  readonly busy = signal(false);
  private loaded = false;

  constructor() {
    // The reader may load after the page renders, so check the bookmark state on the next tick.
    queueMicrotask(() => this.load());
  }

  private load(): void {
    if (this.loaded || !this.auth.isAuthenticated()) return;
    this.loaded = true;
    this.api
      .bookmarks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.saved.set(list.some((b) => b.storyId === this.storyId())));
  }

  toggle(): void {
    this.busy.set(true);
    const id = this.storyId();
    const request = this.saved() ? this.api.removeBookmark(id) : this.api.addBookmark(id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saved.set(!this.saved());
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }
}
