import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { translate } from '../i18n/i18n';
import { ApiErrorBody } from './api.types';

/** Error thrown to components; `message` is always a human-readable string. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Converts backend and network errors into ApiError with a safe, readable message. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      if (err.status === 0) {
        return throwError(() => new ApiError(0, translate('errors.network')));
      }

      const body = err.error as Partial<ApiErrorBody> | null;
      const raw = body?.error?.message;
      const message = Array.isArray(raw) ? raw.join(', ') : raw;
      return throwError(() => new ApiError(err.status, message ?? translate('errors.generic')));
    }),
  );
