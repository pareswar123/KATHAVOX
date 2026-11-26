import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AdminBook, BooksApi, BookAccess, StoryOption } from '../../core/api/books.api';
import { StoriesApi } from '../../core/api/stories.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

/** Create or edit a book. A new book is saved as a draft; press Publish to show it to readers. */
@Component({
  selector: 'kv-admin-book-form',
  imports: [FormsModule, RouterLink, DecimalPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/admin/books" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400">{{ 'books.admin.back' | translate }}</a>
    <h1 class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
      {{ (bookId() ? 'books.admin.editTitle' : 'books.admin.createTitle') | translate }}
    </h1>
    @if (book(); as b) {
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ 'books.status.' + b.status | translate }}</p>
    }

    @if (message(); as msg) {
      <p role="status" class="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ msg }}</p>
    }
    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    <form class="mt-6 grid gap-6 lg:grid-cols-2" (ngSubmit)="save()" novalidate>
      <section class="space-y-4">
        <label class="block text-sm">
          <span class="font-medium">{{ 'books.admin.form.title' | translate }}</span>
          <input name="title" [(ngModel)]="title" maxlength="200" required class="kv-input" />
        </label>
        <label class="block text-sm">
          <span class="font-medium">{{ 'books.admin.form.description' | translate }}</span>
          <textarea name="description" [(ngModel)]="description" rows="4" maxlength="5000" class="kv-input"></textarea>
        </label>

        <div class="text-sm">
          <span class="font-medium">{{ 'books.admin.form.cover' | translate }}</span>
          @if (coverUrl()) {
            <img [src]="coverUrl()" alt="" class="mt-2 h-40 rounded-md border border-slate-200 object-cover dark:border-slate-800" />
          }
          <input type="file" accept="image/jpeg,image/png,image/webp" class="mt-2 block text-sm" (change)="uploadCover($event)" />
        </div>

        <fieldset class="space-y-2 text-sm">
          <legend class="font-medium">{{ 'books.admin.form.access' | translate }}</legend>
          <label class="flex items-center gap-2"><input type="radio" name="access" value="FREE" [(ngModel)]="access" /> {{ 'books.free' | translate }}</label>
          <label class="flex items-center gap-2"><input type="radio" name="access" value="PREMIUM" [(ngModel)]="access" /> {{ 'books.premium' | translate }}</label>
          @if (access === 'PREMIUM') {
            <label class="block">
              <span class="font-medium">{{ 'books.admin.form.price' | translate }}</span>
              <input name="price" type="number" min="1" step="0.5" [(ngModel)]="priceRupees" class="kv-input w-40" />
            </label>
          }
        </fieldset>

        <div class="flex flex-wrap gap-2">
          <button type="submit" class="kv-primary" [disabled]="busy()">{{ (bookId() ? 'books.admin.saveChanges' : 'books.admin.saveDraft') | translate }}</button>
          @if (bookId() && book()?.status !== 'PUBLISHED') {
            <button type="button" class="kv-btn" [disabled]="busy()" (click)="publish()">{{ 'books.admin.publish' | translate }}</button>
          }
          @if (book()?.status === 'PUBLISHED') {
            <button type="button" class="kv-btn" [disabled]="busy()" (click)="unpublish()">{{ 'books.admin.unpublish' | translate }}</button>
          }
        </div>
      </section>

      <section>
        <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ 'books.admin.form.inBook' | translate }}</h2>
        @if (selectedStories().length === 0) {
          <p class="mt-2 text-sm text-slate-500">{{ 'books.admin.form.noneSelected' | translate }}</p>
        }
        <ol class="mt-2 space-y-2">
          @for (s of selectedStories(); track s.id; let i = $index) {
            <li class="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <span>{{ i + 1 }}. {{ s.title }}</span>
              <span class="flex gap-1">
                <button type="button" class="kv-btn px-2" [disabled]="i === 0" (click)="move(i, -1)">↑</button>
                <button type="button" class="kv-btn px-2" [disabled]="i === selectedStories().length - 1" (click)="move(i, 1)">↓</button>
                <button type="button" class="kv-btn px-2" (click)="toggle(s.id)">✕</button>
              </span>
            </li>
          }
        </ol>

        <h2 class="mt-6 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ 'books.admin.form.published' | translate }}</h2>
        <p class="mt-1 text-xs text-slate-500">{{ 'books.admin.form.onlyPublished' | translate }}</p>
        <ul class="mt-2 max-h-96 space-y-1 overflow-auto text-sm">
          @for (s of options(); track s.id) {
            <li>
              <label class="flex items-center gap-2">
                <input type="checkbox" [checked]="isSelected(s.id)" (change)="toggle(s.id)" />
                <span>{{ s.title }}</span>
                <span class="text-xs text-slate-500">{{ s.authorName }}</span>
              </label>
            </li>
          }
        </ul>
      </section>
    </form>
  `,
  styles: `
    .kv-input { margin-top: 0.25rem; display: block; width: 100%; border-radius: 0.5rem; border: 1px solid rgb(203 213 225); padding: 0.5rem 0.75rem; background: #fff; color: #0f172a; font-size: 0.875rem; }
    :host-context(.dark) .kv-input { background: rgb(15 23 42); border-color: rgb(51 65 85); color: rgb(241 245 249); }
    .kv-primary { border-radius: 0.5rem; background: rgb(79 70 229); padding: 0.5rem 0.9rem; color: #fff; font-size: 0.875rem; font-weight: 500; }
    .kv-primary:disabled { opacity: 0.5; }
    .kv-btn { border: 1px solid rgb(203 213 225); border-radius: 0.5rem; padding: 0.4rem 0.75rem; font-size: 0.875rem; }
    .kv-btn:disabled { opacity: 0.4; }
  `,
})
export class AdminBookFormComponent implements OnInit {
  private readonly api = inject(BooksApi);
  private readonly storiesApi = inject(StoriesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly bookId = signal<string | null>(null);
  readonly book = signal<AdminBook | null>(null);
  readonly options = signal<StoryOption[]>([]);
  readonly selectedIds = signal<string[]>([]);
  readonly selectedStories = signal<StoryOption[]>([]);
  readonly coverUrl = signal<string | null>(null);
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  title = '';
  description = '';
  access: BookAccess = 'FREE';
  priceRupees: number | null = null;
  private coverPath: string | null = null;

  ngOnInit(): void {
    this.api.storyOptions().subscribe({ next: (list) => this.options.set(list), error: (err: unknown) => this.fail(err) });
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.bookId.set(id);
      this.api
        .adminDetail(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (b) => this.load(b),
          error: (err: unknown) => this.fail(err),
        });
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggle(id: string): void {
    const current = this.selectedIds();
    if (current.includes(id)) {
      this.selectedIds.set(current.filter((x) => x !== id));
    } else {
      this.selectedIds.set([...current, id]);
    }
    this.syncSelected();
  }

  move(index: number, delta: number): void {
    const ids = [...this.selectedIds()];
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.selectedIds.set(ids);
    this.syncSelected();
  }

  async uploadCover(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const res = await firstValueFrom(this.storiesApi.uploadImage(file, 'cover'));
      this.coverPath = res.url;
      this.coverUrl.set(res.url);
    } catch (err: unknown) {
      this.fail(err);
    }
  }

  async save(): Promise<void> {
    this.error.set(null);
    this.message.set(null);
    if (!this.title.trim()) {
      this.error.set(translate('books.admin.form.titleRequired'));
      return;
    }
    const body = {
      title: this.title.trim(),
      description: this.description,
      coverImageUrl: this.coverPath,
      accessType: this.access,
      pricePaise: this.access === 'PREMIUM' && this.priceRupees ? Math.round(this.priceRupees * 100) : 0,
      storyIds: this.selectedIds(),
    };
    this.busy.set(true);
    try {
      const saved = this.bookId()
        ? await firstValueFrom(this.api.update(this.bookId()!, body))
        : await firstValueFrom(this.api.create(body));
      this.busy.set(false);
      if (!this.bookId()) {
        // A new book is a draft: stay on the form so the admin can review it and press Publish.
        this.bookId.set(saved.id);
        void this.router.navigate(['/admin/books', saved.id, 'edit'], { replaceUrl: true });
      }
      this.load(saved);
      this.message.set(translate(this.bookId() && saved.status === 'PUBLISHED' ? 'books.admin.savedLive' : 'books.admin.saved'));
    } catch (err: unknown) {
      this.busy.set(false);
      this.fail(err);
    }
  }

  async publish(): Promise<void> {
    await this.statusChange(() => this.api.publish(this.bookId()!), 'books.admin.published');
  }

  async unpublish(): Promise<void> {
    await this.statusChange(() => this.api.unpublish(this.bookId()!), 'books.admin.unpublished');
  }

  private async statusChange(request: () => ReturnType<BooksApi['publish']>, key: string): Promise<void> {
    this.busy.set(true);
    try {
      const updated = await firstValueFrom(request());
      this.busy.set(false);
      this.load(updated);
      this.message.set(translate(key));
    } catch (err: unknown) {
      this.busy.set(false);
      this.fail(err);
    }
  }

  private load(b: AdminBook): void {
    this.book.set(b);
    this.title = b.title;
    this.description = b.description;
    this.access = b.accessType;
    this.priceRupees = b.accessType === 'PREMIUM' ? b.pricePaise / 100 : null;
    this.coverPath = b.coverImageUrl;
    this.coverUrl.set(b.coverImageUrl);
    const stories = (b as AdminBook & { stories?: { storyId: string }[] }).stories ?? [];
    if (stories.length) {
      this.selectedIds.set(stories.map((s) => s.storyId));
      this.syncSelected();
    }
  }

  /** Keeps the selected list in order, using the options to show titles. */
  private syncSelected(): void {
    const byId = new Map(this.options().map((o) => [o.id, o]));
    const known = this.book()?.stories as { storyId: string; title: string }[] | undefined;
    const titles = new Map((known ?? []).map((s) => [s.storyId, s.title]));
    this.selectedStories.set(
      this.selectedIds().map((id) => byId.get(id) ?? { id, title: titles.get(id) ?? id, slug: '', authorName: '' }),
    );
  }

  private fail(err: unknown): void {
    this.message.set(null);
    this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
  }
}
