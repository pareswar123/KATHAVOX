import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AUTH_BASE } from '../config/endpoints';
import { ApiEnvelope } from '../http/api.types';

/** Public account calls: reader sign-up and forgot password. Both answer the same way for any email. */
@Injectable({ providedIn: 'root' })
export class AuthFlowsApi {
  private readonly http = inject(HttpClient);

  registerReader(body: { fullName: string; email: string }): Observable<{ message: string }> {
    return this.http
      .post<ApiEnvelope<{ message: string }>>(`${AUTH_BASE}/reader/register`, body)
      .pipe(map((res) => res.data));
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http
      .post<ApiEnvelope<{ message: string }>>(`${AUTH_BASE}/forgot-password`, { email })
      .pipe(map((res) => res.data));
  }
}
