import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../config/endpoints';
import { PublicStoryDetail, PublicStoryList } from '../models/public.model';
import { ApiEnvelope } from '../http/api.types';

/** Reads that need no login: the published story list and story detail. */
@Injectable({ providedIn: 'root' })
export class PublicApi {
  private readonly http = inject(HttpClient);

  stories(params: { page?: number; limit?: number; q?: string }): Observable<PublicStoryList> {
    let httpParams = new HttpParams().set('page', params.page ?? 1).set('limit', params.limit ?? 12);
    if (params.q) httpParams = httpParams.set('q', params.q);
    return this.http
      .get<ApiEnvelope<PublicStoryList>>(`${API_BASE}/public/stories`, { params: httpParams })
      .pipe(map((res) => res.data));
  }

  story(slug: string): Observable<PublicStoryDetail> {
    return this.http
      .get<ApiEnvelope<PublicStoryDetail>>(`${API_BASE}/public/stories/${encodeURIComponent(slug)}`)
      .pipe(map((res) => res.data));
  }
}
