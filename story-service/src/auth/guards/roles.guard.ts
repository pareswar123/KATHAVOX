import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../database/entities';
import { t } from '../../i18n/i18n';
import { AuthenticatedUser, ROLES_KEY } from '../auth.decorators';

/** Enforces @Roles(...). Runs after JwtAuthGuard so request.user is populated. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user || !user.roles.some((role) => required.includes(role))) {
      throw new ForbiddenException(t('access.forbidden'));
    }
    return true;
  }
}
