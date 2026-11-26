import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_BASE } from '../config/endpoints';
import { ApiEnvelope } from '../http/api.types';
import { AuthStore, CurrentUser } from './auth.store';

interface AuthTokens {
  accessToken: string;
  expiresIn: number;
  user: CurrentUser;
  refreshToken?: string;
}

interface Message {
  message: string;
}

/** Custom header required by the backend CSRF guard on refresh and logout. */
const CSRF_HEADERS = new HttpHeaders({
  [environment.csrfHeaderName]: environment.csrfHeaderValue,
});

/** Refresh token kept per tab. sessionStorage is cleared when the tab closes; a reload keeps it. */
const REFRESH_KEY = 'kv.refreshToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(AuthStore);

  private readonly router = inject(Router);

  private accessToken: string | null = null;
  private refresh$: Observable<string> | null = null;
  private restore: Promise<void> | null = null;
  private renewTimer: ReturnType<typeof setTimeout> | null = null;

  /** Share of the access token lifetime after which the token is renewed in the background. */
  private static readonly RENEW_AT = 0.8;

  /** Current in-memory access token, or null. */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  login(email: string, password: string): Observable<CurrentUser> {
    return this.http.post<ApiEnvelope<AuthTokens>>(`${AUTH_BASE}/login`, { email, password }).pipe(
      map((res) => res.data),
      tap((data) => this.setSession(data)),
      map((data) => data.user),
    );
  }

  registerAuthor(body: {
    fullName: string;
    penName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Observable<Message> {
    return this.http.post<ApiEnvelope<Message>>(`${AUTH_BASE}/author/register`, body).pipe(map((res) => res.data));
  }

  verifyEmail(token: string): Observable<Message> {
    return this.http.post<ApiEnvelope<Message>>(`${AUTH_BASE}/verify-email`, { token }).pipe(map((res) => res.data));
  }

  forgotPassword(email: string): Observable<Message> {
    return this.http.post<ApiEnvelope<Message>>(`${AUTH_BASE}/forgot-password`, { email }).pipe(map((res) => res.data));
  }

  resetPassword(token: string, newPassword: string): Observable<Message> {
    return this.http
      .post<ApiEnvelope<Message>>(`${AUTH_BASE}/reset-password`, { token, newPassword })
      .pipe(map((res) => res.data));
  }

  /**
   * Exchanges this tab's refresh token for a new access token.
   * Concurrent callers share ONE in-flight request, so refresh is never fired twice at once.
   */
  refreshAccessToken(): Observable<string> {
    if (!this.refresh$) {
      const refreshToken = this.storedRefreshToken();
      this.refresh$ = this.http
        .post<ApiEnvelope<AuthTokens>>(`${AUTH_BASE}/refresh`, { refreshToken }, { headers: CSRF_HEADERS })
        .pipe(
          map((res) => res.data),
          tap((data) => this.setSession(data)),
          map((data) => data.accessToken),
          catchError((err) => {
            this.endSession();
            return throwError(() => err);
          }),
          finalize(() => (this.refresh$ = null)),
          shareReplay(1),
        );
    }
    return this.refresh$;
  }

  logout(): Observable<void> {
    const refreshToken = this.storedRefreshToken();
    return this.http
      .post<ApiEnvelope<unknown>>(`${AUTH_BASE}/logout`, { refreshToken }, { headers: CSRF_HEADERS })
      .pipe(
        catchError(() => of(null)),
        tap(() => this.clearSession()),
        map(() => undefined),
      );
  }

  /**
   * Runs once per page load. Restores this tab's session from its saved refresh token.
   * A tab without a saved token is logged out and makes no request.
   */
  ensureSession(): Promise<void> {
    if (!this.restore) {
      if (!this.storedRefreshToken()) {
        this.restore = Promise.resolve();
        return this.restore;
      }
      this.restore = firstValueFrom(
        this.refreshAccessToken().pipe(
          switchMap(() => this.http.get<ApiEnvelope<CurrentUser>>(`${AUTH_BASE}/me`)),
          tap((res) => this.store.setUser(res.data)),
          map(() => undefined),
          catchError(() => {
            this.clearSession();
            return of(undefined);
          }),
        ),
      );
    }
    return this.restore;
  }

  private setSession(data: AuthTokens): void {
    this.accessToken = data.accessToken;
    if (data.refreshToken) {
      this.saveRefreshToken(data.refreshToken);
    }
    this.store.setUser(data.user);
    this.scheduleRenewal(data.expiresIn);
  }

  /** Renews the access token before it expires, so the user does not hit a 401 on normal use. */
  private scheduleRenewal(expiresInSeconds: number): void {
    this.cancelRenewal();
    const delayMs = Math.max(expiresInSeconds * AuthService.RENEW_AT * 1000, 30_000);
    this.renewTimer = setTimeout(() => {
      this.renewTimer = null;
      this.refreshAccessToken().subscribe({ error: () => undefined });
    }, delayMs);
  }

  private cancelRenewal(): void {
    if (this.renewTimer !== null) {
      clearTimeout(this.renewTimer);
      this.renewTimer = null;
    }
  }

  /**
   * The refresh token has expired or was revoked. A signed-in user is sent to the login page on a
   * protected screen; on public pages the session is only cleared, so the visitor can still browse.
   */
  private endSession(): void {
    const wasSignedIn = this.store.user() !== null;
    this.clearSession();
    const url = this.router.url;
    const protectedScreen = /^\/(admin|author|reader)(\/|$)/.test(url);
    if (wasSignedIn && protectedScreen) {
      void this.router.navigate(['/auth/login'], { queryParams: { expired: 1, returnUrl: url } });
    }
  }

  clearSession(): void {
    this.cancelRenewal();
    this.accessToken = null;
    this.removeRefreshToken();
    this.store.clear();
  }

  private storedRefreshToken(): string | null {
    try {
      return sessionStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  }

  private saveRefreshToken(token: string): void {
    try {
      sessionStorage.setItem(REFRESH_KEY, token);
    } catch {
      // Storage unavailable (private mode or server render): the session lasts only in memory.
    }
  }

  private removeRefreshToken(): void {
    try {
      sessionStorage.removeItem(REFRESH_KEY);
    } catch {
      // Nothing stored.
    }
  }
}
