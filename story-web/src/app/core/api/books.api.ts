import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../config/endpoints';
import { ApiEnvelope } from '../http/api.types';
import { Paginated } from '../models/story.model';

export type BookStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
export type BookAccess = 'FREE' | 'PREMIUM';

export interface StoryOption {
  id: string;
  title: string;
  slug: string;
  authorName: string;
}

export interface AdminBookStory {
  storyId: string;
  position: number;
  title: string;
  slug: string;
  storyStatus: string | null;
  pageCount: number;
  pageStart: number | null;
  pageEnd: number | null;
}

export interface AdminBook {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  accessType: BookAccess;
  pricePaise: number;
  status: BookStatus;
  publishedAt: string | null;
  updatedAt: string;
  storyCount: number;
  stories?: AdminBookStory[];
}

export interface BookInput {
  title?: string;
  description?: string;
  coverImageUrl?: string | null;
  accessType?: BookAccess;
  pricePaise?: number;
  storyIds?: string[];
}

export interface PublicBookCard {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  accessType: BookAccess;
  pricePaise: number;
  storyCount: number;
}

export interface PublicBookIndexStory {
  slug: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  pageCount: number;
}

export interface PublicBookDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  accessType: BookAccess;
  pricePaise: number;
  access: { readable: boolean; via: 'FREE' | 'PURCHASED' | 'SUBSCRIPTION' | null };
  stories: PublicBookIndexStory[];
}

/** Book calls for the admin (management and PDF) and for readers (list, index, library). */
@Injectable({ providedIn: 'root' })
export class BooksApi {
  private readonly http = inject(HttpClient);

  // ----- admin -----

  storyOptions(): Observable<StoryOption[]> {
    return this.http.get<ApiEnvelope<StoryOption[]>>(`${API_BASE}/admin/books/story-options`).pipe(map((r) => r.data));
  }

  adminList(page = 1, limit = 20, status = ''): Observable<Paginated<AdminBook>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    return this.http.get<ApiEnvelope<Paginated<AdminBook>>>(`${API_BASE}/admin/books`, { params }).pipe(map((r) => r.data));
  }

  adminDetail(id: string): Observable<AdminBook> {
    return this.http.get<ApiEnvelope<AdminBook>>(`${API_BASE}/admin/books/${id}`).pipe(map((r) => r.data));
  }

  create(body: BookInput): Observable<AdminBook> {
    return this.http.post<ApiEnvelope<AdminBook>>(`${API_BASE}/admin/books`, body).pipe(map((r) => r.data));
  }

  update(id: string, body: BookInput): Observable<AdminBook> {
    return this.http.patch<ApiEnvelope<AdminBook>>(`${API_BASE}/admin/books/${id}`, body).pipe(map((r) => r.data));
  }

  publish(id: string): Observable<AdminBook> {
    return this.http.post<ApiEnvelope<AdminBook>>(`${API_BASE}/admin/books/${id}/publish`, {}).pipe(map((r) => r.data));
  }

  unpublish(id: string): Observable<AdminBook> {
    return this.http.post<ApiEnvelope<AdminBook>>(`${API_BASE}/admin/books/${id}/unpublish`, {}).pipe(map((r) => r.data));
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete<ApiEnvelope<unknown>>(`${API_BASE}/admin/books/${id}`).pipe(map((r) => r.data));
  }

  pdf(id: string): Observable<Blob> {
    return this.http.get(`${API_BASE}/admin/books/${id}/pdf`, { responseType: 'blob' });
  }

  // ----- public and reader -----

  publicList(page = 1, limit = 20): Observable<Paginated<PublicBookCard>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ApiEnvelope<Paginated<PublicBookCard>>>(`${API_BASE}/books`, { params }).pipe(map((r) => r.data));
  }

  publicDetail(slug: string): Observable<PublicBookDetail> {
    return this.http.get<ApiEnvelope<PublicBookDetail>>(`${API_BASE}/books/${slug}`).pipe(map((r) => r.data));
  }
}
