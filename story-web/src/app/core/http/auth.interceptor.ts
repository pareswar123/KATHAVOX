import { HttpContext, HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE, isPublicAuthUrl } from '../config/endpoints';

/** Marks a request that has already been retried after a token refresh (prevents loops). */
const RETRIED = new HttpContextToken<boolean>(() => false);

/**
 * Adds the Authorization header to API calls. On a 401 it refreshes the access token once
 * (shared across concurrent requests) and retries the original request exactly once.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isApi = req.url.startsWith(API_BASE);
  const skip = !isApi || isPublicAuthUrl(req.url);

  const token = auth.getAccessToken();
  const outgoing = !skip && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      const canRetry = !skip && !req.context.get(RETRIED);
      if (err instanceof HttpErrorResponse && err.status === 401 && canRetry) {
        return auth.refreshAccessToken().pipe(
          switchMap((newToken) =>
            next(
              req.clone({
                context: req.context.set(RETRIED, true),
                setHeaders: { Authorization: `Bearer ${newToken}` },
              }),
            ),
          ),
          // Surface the original 401 if the refresh itself fails.
          catchError(() => throwError(() => err)),
        );
      }
      return throwError(() => err);
    }),
  );
};
