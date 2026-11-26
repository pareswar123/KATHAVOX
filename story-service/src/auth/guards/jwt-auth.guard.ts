import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthSession, User } from '../../database/entities';
import { t } from '../../i18n/i18n';
import { AuthenticatedUser, IS_PUBLIC_KEY } from '../auth.decorators';

interface AccessTokenPayload {
  sub: string;
  sid: string;
}

/**
 * Verifies the Bearer access token, then re-checks the database:
 * the session must not be revoked and the user must still be active.
 * Roles are read from user_roles, never trusted from the JWT alone.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = this.extractBearer(request.headers['authorization']);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException(t('auth.authRequired'));
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException(t('auth.tokenInvalid'));
    }

    const session = await this.sessions.findOne({
      where: { id: payload.sid, userId: payload.sub, revokedAt: IsNull() },
    });
    if (!session) {
      if (isPublic) return true;
      throw new UnauthorizedException(t('auth.sessionInactive'));
    }

    const user = await this.users.findOne({ where: { id: payload.sub }, relations: { roles: true } });
    if (!user || !user.isActive) {
      if (isPublic) return true;
      throw new UnauthorizedException(t('auth.accountInactive'));
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      roles: (user.roles ?? []).map((r) => r.role),
      sessionId: session.id,
    };
    request.user = authUser;
    return true;
  }

  private extractBearer(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
