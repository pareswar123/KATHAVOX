import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoriesApi } from '../../core/api/stories.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { Category, Language } from '../../core/models/story.model';

/** Admin management of categories and languages. */
@Component({
  selector: 'kv-catalogue',
  imports: [ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as msg) {
      <p role="status" class="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ msg }}</p>
    }
    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    <div class="mt-6 grid gap-8 lg:grid-cols-2">
      <section>
        <h1 class="text-xl font-semibold text-slate-900 dark:text-slate-100">{{ 'catalogue.categoriesTitle' | translate }}</h1>
        <table class="mt-4 min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            @for (c of categories(); track c.id) {
              <tr>
                <td class="py-2">
                  <div class="font-medium">{{ c.name }}</div>
                  <div class="text-xs text-slate-500">{{ c.slug }}</div>
                </td>
                <td class="py-2 text-right">
                  <button type="button" class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" (click)="toggleCategory(c)">
                    {{ (c.isActive ? 'common.active' : 'common.inactive') | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <form [formGroup]="categoryForm" (ngSubmit)="addCategory()" class="mt-4 flex flex-wrap gap-2">
          <input formControlName="name" [placeholder]="'common.name' | translate" class="kv-input flex-1" maxlength="100" />
          <button type="submit" [disabled]="categoryForm.invalid" class="kv-primary">{{ 'catalogue.addCategory' | translate }}</button>
        </form>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">{{ 'catalogue.languagesTitle' | translate }}</h2>
        <table class="mt-4 min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            @for (l of languages(); track l.id) {
              <tr>
                <td class="py-2">
                  <div class="font-medium">{{ l.name }}</div>
                  <div class="text-xs text-slate-500">{{ l.code }}</div>
                </td>
                <td class="py-2 text-right">
                  <button type="button" class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" (click)="toggleLanguage(l)">
                    {{ (l.isActive ? 'common.active' : 'common.inactive') | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <form [formGroup]="languageForm" (ngSubmit)="addLanguage()" class="mt-4 flex flex-wrap gap-2">
          <input formControlName="name" [placeholder]="'common.name' | translate" class="kv-input flex-1" maxlength="100" />
          <input formControlName="code" [placeholder]="'catalogue.code' | translate" class="kv-input w-28" maxlength="12" />
          <button type="submit" [disabled]="languageForm.invalid" class="kv-primary">{{ 'catalogue.addLanguage' | translate }}</button>
        </form>
        <p class="mt-1 text-xs text-slate-500">{{ 'catalogue.codeHint' | translate }}</p>
      </section>
    </div>

  `,
  styles: `
      .kv-input { border-radius: 0.375rem; border: 1px solid rgb(203 213 225); padding: 0.5rem 0.75rem; background: white; color: rgb(15 23 42); }
      .kv-primary { border-radius: 0.375rem; background: rgb(79 70 229); color: white; padding: 0.5rem 0.75rem; font-size: 0.875rem; }
      .kv-primary:disabled { opacity: 0.5; }
  `,
})
export class CatalogueComponent {
  private readonly api = inject(StoriesApi);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = signal<Category[]>([]);
  readonly languages = signal<Language[]>([]);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  readonly languageForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    code: ['', [Validators.required, Validators.pattern(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/)]],
  });

  constructor() {
    this.loadAll();
  }

  addCategory(): void {
    if (this.categoryForm.invalid) return;
    this.api.createCategory({ name: this.categoryForm.getRawValue().name }).subscribe({
      next: () => {
        this.categoryForm.reset();
        this.saved();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  addLanguage(): void {
    if (this.languageForm.invalid) return;
    const raw = this.languageForm.getRawValue();
    this.api.createLanguage({ name: raw.name, code: raw.code }).subscribe({
      next: () => {
        this.languageForm.reset();
        this.saved();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  toggleCategory(category: Category): void {
    this.api.setCategoryActive(category.id, !category.isActive).subscribe({
      next: () => this.saved(),
      error: (err: unknown) => this.fail(err),
    });
  }

  toggleLanguage(language: Language): void {
    this.api.setLanguageActive(language.id, !language.isActive).subscribe({
      next: () => this.saved(),
      error: (err: unknown) => this.fail(err),
    });
  }

  private loadAll(): void {
    this.api.categories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (c) => this.categories.set(c),
      error: (err: unknown) => this.fail(err),
    });
    this.api.languages().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (l) => this.languages.set(l),
      error: (err: unknown) => this.fail(err),
    });
  }

  private saved(): void {
    this.message.set(translate('catalogue.saved'));
    this.error.set(null);
    this.loadAll();
  }

  private fail(err: unknown): void {
    this.message.set(null);
    this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
  }
}
