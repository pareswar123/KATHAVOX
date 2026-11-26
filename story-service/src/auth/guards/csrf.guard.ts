import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { t } from '../../i18n/i18n';

/**
 * CSRF protection for cookie-authenticated endpoints (refresh, logout).
 * The request must carry the configured custom header with the configured value,
 * and any Origin header must match FRONTEND_ORIGIN.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly cfg: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers[this.cfg.csrf.headerName.toLowerCase()];
    if (header !== this.cfg.csrf.headerValue) {
      throw new ForbiddenException(t('csrf.headerMissing'));
    }

    const origin: string | undefined = request.headers['origin'];
    if (origin && origin !== this.cfg.frontendOrigin) {
      throw new ForbiddenException(t('csrf.originNotAllowed'));
    }
    return true;
  }
}
