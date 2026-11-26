import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import { t } from '../i18n/i18n';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    statusCode: number;
    message: string | string[];
    path: string;
    timestamp: string;
  };
}

/** Wraps every successful controller result as { success: true, data }. */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<SuccessEnvelope<unknown>> {
    return next.handle().pipe(map((data) => ({ success: true as const, data: data ?? null })));
  }
}

/** Converts every error into the same { success: false, error } shape without leaking stack traces. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = t('errors.internal');

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse() as string | { message?: string | string[] };
      message = typeof body === 'string' ? body : (body.message ?? exception.message);
    } else {
      // Unknown error: log server-side only, never expose details to the client.
      console.error('[unhandled]', exception);
    }

    const payload: ErrorEnvelope = {
      success: false,
      error: { statusCode, message, path: request.url, timestamp: new Date().toISOString() },
    };
    response.status(statusCode).json(payload);
  }
}
