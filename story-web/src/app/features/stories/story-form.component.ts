import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { StoriesApi, StoryInput } from '../../core/api/stories.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { AuthorOption, Category, Language, Portal, Story, StoryStatus } from '../../core/models/story.model';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

/** Create or edit a story. Admins also see pricing, featured and workflow controls. */
@Component({
  selector: 'kv-story-form',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {{ (storyId() ? 'stories.form.editTitle' : 'stories.form.createTitle') | translate }}
      </h1>
      @if (story(); as s) {
        <div class="flex items-center gap-3">
          <kv-status-badge [status]="s.publicationStatus" />
          <a [routerLink]="base + '/stories/' + s.id + '/pages'" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            {{ 'stories.form.managePages' | translate }}
          </a>
        </div>
      }
    </div>

    @if (story(); as s) {
      @if (s.publicationStatus === 'REJECTED' && s.rejectionReason) {
        <p class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ 'stories.rejectionNote' | translate: { reason: s.rejectionReason } }}</p>
      }
      @if (s.publicationStatus === 'PUBLISHED' && !isAdmin) {
        <p class="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">{{ 'stories.pendingNote' | translate }}</p>
      }
    }

    @if (message(); as msg) {
      <p role="status" class="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ msg }}</p>
    }
    @if (error(); as err) {
      <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{{ err }}</p>
    }

    <section class="mt-6 max-w-2xl rounded-lg border border-slate-200 p-5 dark:border-slate-800">
      <h2 class="text-lg font-medium">{{ 'stories.form.details' | translate }}</h2>
      <form [formGroup]="details" (ngSubmit)="saveDetails()" class="mt-4 space-y-4" novalidate>
        @if (isAdmin && !storyId()) {
          <label class="block">
            <span class="text-sm font-medium">{{ 'stories.form.author' | translate }}</span>
            <select formControlName="authorId" class="kv-input">
              <option value="">{{ 'stories.form.choosePlaceholder' | translate }}</option>
              @for (a of authors(); track a.id) {
                <option [value]="a.id">{{ a.penName || a.fullName }} ({{ a.email }})</option>
              }
            </select>
          </label>
        }

        <label class="block">
          <span class="text-sm font-medium">{{ 'common.title' | translate }}</span>
          <input formControlName="title" class="kv-input" maxlength="200" />
        </label>

        <label class="block">
          <span class="text-sm font-medium">{{ 'common.description' | translate }}</span>
          <textarea formControlName="description" rows="4" maxlength="5000" class="kv-input"></textarea>
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-sm font-medium">{{ 'stories.form.category' | translate }}</span>
            <select formControlName="categoryId" class="kv-input">
              <option value="">{{ 'stories.form.choosePlaceholder' | translate }}</option>
              @for (c of categories(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </label>
          <label class="block">
            <span class="text-sm font-medium">{{ 'stories.form.language' | translate }}</span>
            <select formControlName="languageId" class="kv-input">
              <option value="">{{ 'stories.form.choosePlaceholder' | translate }}</option>
              @for (l of languages(); track l.id) {
                <option [value]="l.id">{{ l.name }}</option>
              }
            </select>
          </label>
        </div>

        <div>
          <span class="text-sm font-medium">{{ 'stories.form.cover' | translate }}</span>
          <p class="text-xs text-slate-500">{{ 'stories.form.coverHint' | translate }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-3">
            @if (coverUrl()) {
              <img [src]="coverUrl()" alt="" class="h-24 w-16 rounded object-cover" />
              <button type="button" class="text-sm text-red-600 hover:underline" (click)="removeCover()">{{ 'stories.form.removeCover' | translate }}</button>
            }
            <label class="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
              {{ (uploading() ? 'stories.form.uploading' : 'stories.form.uploadCover') | translate }}
              <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" (change)="onCover($event)" />
            </label>
          </div>
        </div>

        <button type="submit" [disabled]="details.invalid || saving()" class="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {{ (saving() ? 'common.saving' : 'stories.form.saveDetails') | translate }}
        </button>
      </form>
    </section>

    @if (storyId() && story(); as s) {
      @if (isAdmin) {
        <section class="mt-6 max-w-2xl rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <h2 class="text-lg font-medium">{{ 'stories.form.pricing' | translate }}</h2>
          <form [formGroup]="pricing" (ngSubmit)="savePricing()" class="mt-4 space-y-4" novalidate>
            <div class="grid gap-4 sm:grid-cols-3">
              <label class="block">
                <span class="text-sm font-medium">{{ 'stories.form.access' | translate }}</span>
                <select formControlName="accessType" class="kv-input">
                  <option value="FREE">{{ 'access.FREE' | translate }}</option>
                  <option value="PREMIUM">{{ 'access.PREMIUM' | translate }}</option>
                </select>
              </label>
              <label class="block">
                <span class="text-sm font-medium">{{ 'common.price' | translate }}</span>
                <input type="number" min="0" step="0.01" formControlName="priceRupees" class="kv-input" />
                <span class="text-xs text-slate-500">{{ 'common.rupeesHint' | translate }}</span>
              </label>
              <label class="block">
                <span class="text-sm font-medium">{{ 'stories.form.freePreviewPages' | translate }}</span>
                <input type="number" min="0" step="1" formControlName="freePreviewPages" class="kv-input" />
                <span class="text-xs text-slate-500">{{ 'stories.form.freePreviewHint' | translate }}</span>
              </label>
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" formControlName="isFeatured" />
              {{ 'stories.form.featured' | translate }}
            </label>
            @if (pricingError()) {
              <p class="text-sm text-red-600">{{ pricingError() }}</p>
            }
            <button type="submit" class="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
              {{ 'stories.form.savePricing' | translate }}
            </button>
          </form>
        </section>

        <section class="mt-6 max-w-2xl rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <h2 class="text-lg font-medium">{{ 'stories.form.workflow' | translate }}</h2>
          <div class="mt-3 flex flex-wrap gap-2">
            @if (s.publicationStatus === 'PENDING_APPROVAL') {
              <button type="button" class="kv-action" (click)="workflow('approve')">{{ 'stories.approve' | translate }}</button>
            }
            @if (s.publicationStatus === 'DRAFT' || s.publicationStatus === 'REJECTED' || s.publicationStatus === 'ARCHIVED') {
              <button type="button" class="kv-action" (click)="workflow('publish')">{{ 'stories.publish' | translate }}</button>
            }
            @if (s.publicationStatus === 'PUBLISHED' || s.publicationStatus === 'PENDING_APPROVAL') {
              <button type="button" class="kv-action" (click)="workflow('unpublish')">{{ 'stories.unpublish' | translate }}</button>
            }
            @if (s.publicationStatus !== 'ARCHIVED') {
              <button type="button" class="kv-action" (click)="workflow('archive')">{{ 'stories.archive' | translate }}</button>
            }
          </div>
        </section>
      } @else if (canSubmit(s.publicationStatus)) {
        <section class="mt-6 max-w-2xl rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <button type="button" class="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700" (click)="submit()">
            {{ 'stories.submit' | translate }}
          </button>
        </section>
      }
    }

  `,
  styles: `
    .kv-input { margin-top: 0.25rem; width: 100%; border-radius: 0.375rem; border: 1px solid rgb(203 213 225); padding: 0.5rem 0.75rem; background: white; color: rgb(15 23 42); }
    .kv-action { border: 1px solid rgb(203 213 225); border-radius: 0.375rem; padding: 0.375rem 0.75rem; font-size: 0.875rem; }
  `,
})
export class StoryFormComponent {
  private readonly api = inject(StoriesApi);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly portal: Portal = this.route.snapshot.data['portal'];
  readonly isAdmin = this.portal === 'admin';
  readonly base = `/${this.portal}`;
  readonly storyId = signal<string | null>(this.route.snapshot.paramMap.get('id'));

  readonly story = signal<Story | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly languages = signal<Language[]>([]);
  readonly authors = signal<AuthorOption[]>([]);
  readonly coverUrl = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly saving = signal(false);
  readonly pricingError = signal<string | null>(null);
  readonly message = signal<string | null>(
    this.route.snapshot.queryParamMap.get('created') ? translate('stories.form.created') : null,
  );
  readonly error = signal<string | null>(null);

  readonly details = this.fb.nonNullable.group({
    authorId: [''],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(5000)]],
    categoryId: ['', [Validators.required]],
    languageId: ['', [Validators.required]],
  });

  readonly pricing = this.fb.nonNullable.group({
    accessType: ['FREE' as 'FREE' | 'PREMIUM'],
    priceRupees: [0],
    freePreviewPages: [2],
    isFeatured: [false],
  });

  constructor() {
    this.api.publicCategories().subscribe((c) => this.categories.set(c));
    this.api.publicLanguages().subscribe((l) => this.languages.set(l));
    if (this.isAdmin && !this.storyId()) {
      this.api.authors().subscribe((a) => this.authors.set(a));
      this.details.controls.authorId.addValidators(Validators.required);
    }

    const id = this.storyId();
    if (id) {
      this.api.get(this.portal, id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((s) => this.load(s));
    }
  }

  canSubmit(status: StoryStatus): boolean {
    return status === 'DRAFT' || status === 'REJECTED';
  }

  saveDetails(): void {
    if (this.details.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const raw = this.details.getRawValue();
    const body: StoryInput = {
      title: raw.title,
      description: raw.description,
      categoryId: raw.categoryId,
      languageId: raw.languageId,
      coverImageUrl: this.coverUrl(),
    };

    const id = this.storyId();
    if (!id) {
      const createBody: StoryInput = this.isAdmin ? { ...body, authorId: raw.authorId } : body;
      this.api.create(this.portal, createBody).subscribe({
        next: (s) => {
          this.saving.set(false);
          void this.router.navigate([this.base, 'stories', s.id, 'edit'], { queryParams: { created: 1 } });
        },
        error: (err: unknown) => this.fail(err),
      });
      return;
    }

    this.api.update(this.portal, id, body).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.load(s);
        this.message.set(translate('common.saved'));
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  onCover(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.api.uploadImage(file, 'cover').subscribe({
      next: ({ url }) => {
        this.uploading.set(false);
        this.coverUrl.set(url);
        this.details.markAsDirty();
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.fail(err);
      },
    });
  }

  removeCover(): void {
    this.coverUrl.set(null);
  }

  savePricing(): void {
    const id = this.storyId();
    if (!id) return;
    const raw = this.pricing.getRawValue();
    const paise = Math.round(Number(raw.priceRupees) * 100);
    if (raw.accessType === 'PREMIUM' && paise <= 0) {
      this.pricingError.set(translate('stories.form.priceRequired'));
      return;
    }
    this.pricingError.set(null);

    this.api
      .pricing(id, {
        accessType: raw.accessType,
        pricePaise: raw.accessType === 'FREE' ? 0 : paise,
        freePreviewPages: Number(raw.freePreviewPages),
      })
      .pipe(switchMap(() => this.api.setFeatured(id, raw.isFeatured)))
      .subscribe({
        next: (s) => {
          this.load(s);
          this.message.set(translate('stories.form.pricingSaved'));
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  workflow(action: 'approve' | 'publish' | 'unpublish' | 'archive'): void {
    const id = this.storyId();
    if (!id) return;
    this.api.workflow(id, action).subscribe({
      next: (s) => {
        this.load(s);
        this.message.set(translate(`stories.${action === 'approve' ? 'approved' : action === 'publish' ? 'published' : action === 'unpublish' ? 'unpublished' : 'archived'}`));
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  submit(): void {
    const id = this.storyId();
    if (!id) return;
    this.api.submit(id).subscribe({
      next: (s) => {
        this.load(s);
        this.message.set(translate('stories.submitted'));
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private load(s: Story): void {
    this.story.set(s);
    this.storyId.set(s.id);
    this.coverUrl.set(s.coverImageUrl);
    this.details.patchValue({
      authorId: s.authorId,
      title: s.title,
      description: s.description,
      categoryId: s.categoryId,
      languageId: s.languageId,
    });
    this.details.markAsPristine();
    this.pricing.patchValue({
      accessType: s.accessType,
      priceRupees: s.pricePaise / 100,
      freePreviewPages: s.freePreviewPages,
      isFeatured: s.isFeatured,
    });
  }

  private fail(err: unknown): void {
    this.saving.set(false);
    this.message.set(null);
    this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
  }
}
