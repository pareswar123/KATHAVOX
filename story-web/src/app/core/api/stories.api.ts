import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../config/endpoints';
import { ApiEnvelope } from '../http/api.types';
import {
  AdminDashboard,
  AuthorDashboard,
  AuthorOption,
  Category,
  Language,
  Paginated,
  Portal,
  Story,
  StoryListParams,
  StoryPage,
} from '../models/story.model';

function unwrap<T>() {
  return (source: Observable<ApiEnvelope<T>>) => source.pipe(map((res) => res.data));
}

export interface StoryInput {
  title?: string;
  description?: string;
  categoryId?: string;
  languageId?: string;
  coverImageUrl?: string | null;
  authorId?: string;
}

export interface PricingInput {
  accessType: 'FREE' | 'PREMIUM';
  pricePaise: number;
  freePreviewPages: number;
}

export interface PageInput {
  title?: string;
  content: string;
}

/**
 * Story, page, workflow and catalogue calls. The portal decides the URL prefix, so one service
 * serves both the author and the admin screens. The backend enforces the real permissions.
 */
@Injectable({ providedIn: 'root' })
export class StoriesApi {
  private readonly http = inject(HttpClient);

  private base(portal: Portal): string {
    return `${API_BASE}/${portal}`;
  }

  list(portal: Portal, params: StoryListParams): Observable<Paginated<Story>> {
    let httpParams = new HttpParams().set('page', params.page ?? 1).set('limit', params.limit ?? 10);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);
    return this.http
      .get<ApiEnvelope<Paginated<Story>>>(`${this.base(portal)}/stories`, { params: httpParams })
      .pipe(unwrap<Paginated<Story>>());
  }

  get(portal: Portal, id: string): Observable<Story> {
    return this.http.get<ApiEnvelope<Story>>(`${this.base(portal)}/stories/${id}`).pipe(unwrap<Story>());
  }

  create(portal: Portal, body: StoryInput): Observable<Story> {
    return this.http.post<ApiEnvelope<Story>>(`${this.base(portal)}/stories`, body).pipe(unwrap<Story>());
  }

  update(portal: Portal, id: string, body: StoryInput): Observable<Story> {
    return this.http.patch<ApiEnvelope<Story>>(`${this.base(portal)}/stories/${id}`, body).pipe(unwrap<Story>());
  }

  remove(portal: Portal, id: string): Observable<unknown> {
    return this.http.delete<ApiEnvelope<unknown>>(`${this.base(portal)}/stories/${id}`).pipe(unwrap<unknown>());
  }

  /** Author action. */
  submit(id: string): Observable<Story> {
    return this.http.post<ApiEnvelope<Story>>(`${this.base('author')}/stories/${id}/submit`, {}).pipe(unwrap<Story>());
  }

  /** Admin workflow actions. */
  workflow(id: string, action: 'approve' | 'publish' | 'unpublish' | 'archive'): Observable<Story> {
    return this.http
      .post<ApiEnvelope<Story>>(`${this.base('admin')}/stories/${id}/${action}`, {})
      .pipe(unwrap<Story>());
  }

  reject(id: string, reason: string): Observable<Story> {
    return this.http
      .post<ApiEnvelope<Story>>(`${this.base('admin')}/stories/${id}/reject`, { reason })
      .pipe(unwrap<Story>());
  }

  pricing(id: string, body: PricingInput): Observable<Story> {
    return this.http
      .patch<ApiEnvelope<Story>>(`${this.base('admin')}/stories/${id}/pricing`, body)
      .pipe(unwrap<Story>());
  }

  setFeatured(id: string, isFeatured: boolean): Observable<Story> {
    return this.http
      .patch<ApiEnvelope<Story>>(`${this.base('admin')}/stories/${id}/featured`, { isFeatured })
      .pipe(unwrap<Story>());
  }

  approvals(params: StoryListParams): Observable<Paginated<Story>> {
    const httpParams = new HttpParams().set('page', params.page ?? 1).set('limit', params.limit ?? 10);
    return this.http
      .get<ApiEnvelope<Paginated<Story>>>(`${this.base('admin')}/approvals`, { params: httpParams })
      .pipe(unwrap<Paginated<Story>>());
  }

  authors(): Observable<AuthorOption[]> {
    return this.http.get<ApiEnvelope<AuthorOption[]>>(`${this.base('admin')}/authors`).pipe(unwrap<AuthorOption[]>());
  }

  /** Admin: published version of a story as a book-style PDF. */
  downloadPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base('admin')}/stories/${id}/pdf`, { responseType: 'blob' });
  }

  // ----- pages -----

  listPages(portal: Portal, storyId: string): Observable<StoryPage[]> {
    return this.http
      .get<ApiEnvelope<StoryPage[]>>(`${this.base(portal)}/stories/${storyId}/pages`)
      .pipe(unwrap<StoryPage[]>());
  }

  createPage(portal: Portal, storyId: string, body: PageInput): Observable<StoryPage> {
    return this.http
      .post<ApiEnvelope<StoryPage>>(`${this.base(portal)}/stories/${storyId}/pages`, body)
      .pipe(unwrap<StoryPage>());
  }

  updatePage(portal: Portal, storyId: string, pageId: string, body: PageInput): Observable<StoryPage> {
    return this.http
      .patch<ApiEnvelope<StoryPage>>(`${this.base(portal)}/stories/${storyId}/pages/${pageId}`, body)
      .pipe(unwrap<StoryPage>());
  }

  deletePage(portal: Portal, storyId: string, pageId: string): Observable<unknown> {
    return this.http
      .delete<ApiEnvelope<unknown>>(`${this.base(portal)}/stories/${storyId}/pages/${pageId}`)
      .pipe(unwrap<unknown>());
  }

  reorderPages(portal: Portal, storyId: string, pageIds: string[]): Observable<unknown> {
    return this.http
      .put<ApiEnvelope<unknown>>(`${this.base(portal)}/stories/${storyId}/pages/order`, { pageIds })
      .pipe(unwrap<unknown>());
  }

  // ----- dashboards -----

  authorDashboard(): Observable<AuthorDashboard> {
    return this.http.get<ApiEnvelope<AuthorDashboard>>(`${API_BASE}/author/dashboard`).pipe(unwrap<AuthorDashboard>());
  }

  adminDashboard(): Observable<AdminDashboard> {
    return this.http.get<ApiEnvelope<AdminDashboard>>(`${API_BASE}/admin/dashboard`).pipe(unwrap<AdminDashboard>());
  }

  // ----- uploads -----

  uploadImage(file: File, kind: 'cover' | 'image'): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http
      .post<ApiEnvelope<{ url: string }>>(`${API_BASE}/uploads`, form, { params: { kind } })
      .pipe(unwrap<{ url: string }>());
  }

  // ----- catalogue (admin) -----

  categories(): Observable<Category[]> {
    return this.http.get<ApiEnvelope<Category[]>>(`${this.base('admin')}/categories`).pipe(unwrap<Category[]>());
  }

  createCategory(body: { name: string; description?: string }): Observable<Category> {
    return this.http.post<ApiEnvelope<Category>>(`${this.base('admin')}/categories`, body).pipe(unwrap<Category>());
  }

  setCategoryActive(id: string, isActive: boolean): Observable<Category> {
    return this.http
      .patch<ApiEnvelope<Category>>(`${this.base('admin')}/categories/${id}`, { isActive })
      .pipe(unwrap<Category>());
  }

  languages(): Observable<Language[]> {
    return this.http.get<ApiEnvelope<Language[]>>(`${this.base('admin')}/languages`).pipe(unwrap<Language[]>());
  }

  createLanguage(body: { name: string; code: string }): Observable<Language> {
    return this.http.post<ApiEnvelope<Language>>(`${this.base('admin')}/languages`, body).pipe(unwrap<Language>());
  }

  setLanguageActive(id: string, isActive: boolean): Observable<Language> {
    return this.http
      .patch<ApiEnvelope<Language>>(`${this.base('admin')}/languages/${id}`, { isActive })
      .pipe(unwrap<Language>());
  }

  /** Public lookups used by the story form, so authors only see active options. */
  publicCategories(): Observable<Category[]> {
    return this.http.get<ApiEnvelope<Category[]>>(`${API_BASE}/public/categories`).pipe(unwrap<Category[]>());
  }

  publicLanguages(): Observable<Language[]> {
    return this.http.get<ApiEnvelope<Language[]>>(`${API_BASE}/public/languages`).pipe(unwrap<Language[]>());
  }
}
