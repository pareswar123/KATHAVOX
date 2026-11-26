import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StoriesApi } from '../../core/api/stories.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { Portal, Story, StoryPage } from '../../core/models/story.model';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { RichTextEditorComponent } from '../../shared/rich-text-editor/rich-text-editor.component';

/** Page list and editor for one story. Authors edit their own stories; admins edit any story. */
@Component({
  selector: 'kv-story-pages',
  imports: [FormsModule, RouterLink, TranslatePipe, RichTextEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="base + '/stories'" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
      {{ 'stories.pages.backToStories' | translate }}
    </a>
    <h1 class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
      {{ 'stories.pages.title' | translate: { story: story()?.title ?? '' } }}
    </h1>

    @if (message(); as msg) {
      <p role="status" class="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ msg }}</p>
    }
    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    <div class="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside>
        <div class="flex items-center justify-between">
          <h2 class="font-medium">{{ 'stories.pages.order' | translate }}</h2>
          <button type="button" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400" (click)="newPage()">
            {{ 'stories.pages.newPage' | translate }}
          </button>
        </div>
        @if (pages().length === 0) {
          <p class="mt-3 text-sm text-slate-500">{{ 'stories.pages.empty' | translate }}</p>
        }
        <ol class="mt-3 space-y-2">
          @for (p of pages(); track p.id; let i = $index; let first = $first; let last = $last) {
            <li
              class="rounded-md border p-2 text-sm"
              [class.border-indigo-500]="selectedId() === p.id"
              [class.border-slate-200]="selectedId() !== p.id"
            >
              <div class="flex items-center justify-between gap-2">
                <button type="button" class="truncate text-left font-medium hover:underline" (click)="select(p)">
                  {{ p.pageNumber }}. {{ p.title || ('stories.pages.newPage' | translate) }}
                </button>
              </div>
              <div class="mt-2 flex flex-wrap gap-3 text-xs">
                <button type="button" class="text-slate-600 hover:underline dark:text-slate-400" [disabled]="first" (click)="move(i, -1)">{{ 'stories.pages.moveUp' | translate }}</button>
                <button type="button" class="text-slate-600 hover:underline dark:text-slate-400" [disabled]="last" (click)="move(i, 1)">{{ 'stories.pages.moveDown' | translate }}</button>
                <button type="button" class="text-red-600 hover:underline dark:text-red-400" (click)="remove(p)">{{ 'stories.pages.deletePage' | translate }}</button>
              </div>
            </li>
          }
        </ol>
      </aside>

      <section class="space-y-4">
        <h2 class="font-medium">
          {{ (selectedId() ? 'stories.pages.editPage' : 'stories.pages.newPage') | translate }}
        </h2>
        <label class="block">
          <span class="text-sm font-medium">{{ 'stories.pages.pageTitle' | translate }}</span>
          <input
            [ngModel]="pageTitle()"
            (ngModelChange)="pageTitle.set($event)"
            maxlength="200"
            class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <div>
          <span class="text-sm font-medium">{{ 'stories.pages.content' | translate }}</span>
          <div class="mt-1">
            <kv-rich-text-editor [content]="content()" (contentChange)="content.set($event)" />
          </div>
        </div>
        <button
          type="button"
          (click)="save()"
          [disabled]="saving()"
          class="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ (saving() ? 'common.saving' : 'stories.pages.savePage') | translate }}
        </button>
      </section>
    </div>
  `,
})
export class StoryPagesComponent {
  private readonly api = inject(StoriesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmService);

  readonly portal: Portal = this.route.snapshot.data['portal'];
  readonly base = `/${this.portal}`;
  private readonly storyId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly story = signal<Story | null>(null);
  readonly pages = signal<StoryPage[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly pageTitle = signal('');
  readonly content = signal('');
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    this.api.get(this.portal, this.storyId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((s) => this.story.set(s));
    this.reload();
  }

  select(page: StoryPage): void {
    this.selectedId.set(page.id);
    this.pageTitle.set(page.title);
    this.content.set(page.content);
    this.message.set(null);
  }

  newPage(): void {
    this.selectedId.set(null);
    this.pageTitle.set('');
    this.content.set('');
  }

  save(): void {
    this.saving.set(true);
    this.error.set(null);
    const body = { title: this.pageTitle(), content: this.content() || '<p></p>' };
    const id = this.selectedId();
    const request = id
      ? this.api.updatePage(this.portal, this.storyId, id, body)
      : this.api.createPage(this.portal, this.storyId, body);

    request.subscribe({
      next: (page) => {
        this.saving.set(false);
        this.message.set(translate('stories.pages.pageSaved'));
        // Clear the form after every save so it is ready for the next new page.
        this.newPage();
        this.reload();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  move(index: number, direction: -1 | 1): void {
    const list = [...this.pages()];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.api.reorderPages(this.portal, this.storyId, list.map((p) => p.id)).subscribe({
      next: () => {
        this.message.set(translate('stories.pages.orderSaved'));
        this.reload();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  async remove(page: StoryPage): Promise<void> {
    if (!(await this.confirm.ask('stories.pages.deletePageConfirm'))) return;
    this.api.deletePage(this.portal, this.storyId, page.id).subscribe({
      next: () => {
        if (this.selectedId() === page.id) this.newPage();
        this.message.set(translate('stories.pages.pageDeleted'));
        this.reload();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private reload(): void {
    this.api.listPages(this.portal, this.storyId).subscribe({
      next: (pages) => this.pages.set(pages),
      error: (err: unknown) => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    this.saving.set(false);
    this.message.set(null);
    this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
  }
}
