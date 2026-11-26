import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../config/endpoints';
import { ApiEnvelope } from '../http/api.types';

export interface Bookmark {
  storyId: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  accessType: 'FREE' | 'PREMIUM';
  bookmarkedAt: string;
}

export interface ReaderLibrary {
  bookmarks: Bookmark[];
  purchasedStories: Array<{ storyId: string; slug: string; title: string; purchasedAt: string }>;
  subscription: { planName: string; endDate: string; active: boolean; message: string | null } | null;
  payments: Array<{ id: string; purchaseType: string; amountPaise: number; status: string; createdAt: string }>;
}

export interface EntitledPage {
  pageNumber: number;
  title: string;
  content: string;
  totalPages: number;
}

/** Logged-in reader endpoints: library, bookmarks and entitled pages. */
@Injectable({ providedIn: 'root' })
export class ReaderApi {
  private readonly http = inject(HttpClient);

  library(): Observable<ReaderLibrary> {
    return this.http.get<ApiEnvelope<ReaderLibrary>>(`${API_BASE}/reader/library`).pipe(map((res) => res.data));
  }

  bookmarks(): Observable<Bookmark[]> {
    return this.http.get<ApiEnvelope<Bookmark[]>>(`${API_BASE}/reader/bookmarks`).pipe(map((res) => res.data));
  }

  addBookmark(storyId: string): Observable<unknown> {
    return this.http.put<ApiEnvelope<unknown>>(`${API_BASE}/reader/bookmarks/${storyId}`, {});
  }

  removeBookmark(storyId: string): Observable<unknown> {
    return this.http.delete<ApiEnvelope<unknown>>(`${API_BASE}/reader/bookmarks/${storyId}`);
  }

  page(slug: string, pageNumber: number): Observable<EntitledPage> {
    return this.http
      .get<ApiEnvelope<EntitledPage>>(`${API_BASE}/reader/stories/${encodeURIComponent(slug)}/pages/${pageNumber}`)
      .pipe(map((res) => res.data));
  }
}
