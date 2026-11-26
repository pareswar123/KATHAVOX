import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AppConfig } from '../config/app-config';
import { generateOpaqueToken, hashToken } from '../common/token.util';
import {
  AuthSession,
  RefreshToken,
  User,
  UserRole,
  UserRoleEntity,
  VerificationToken,
  VerificationTokenType,
} from '../database/entities';
import { t } from '../i18n/i18n';
import { MailService } from '../mail/mail.service';
import { AuthTokensDto, ChangePasswordDto, CurrentUserDto, ForgotPasswordDto, LoginDto, RegisterAuthorDto, RegisterReaderDto } from './dto/auth.dto';

/** Used to keep login timing similar when the email does not exist. */
const DUMMY_HASH = argon2.hash(randomBytes(16).toString('hex'), { type: argon2.argon2id });

export interface IssuedSession {
  tokens: AuthTokensDto;
  refreshToken: string;
}

type RefreshOutcome = { ok: true; session: IssuedSession } | { ok: false; reason: 'invalid' | 'reuse' };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(VerificationToken) private readonly verificationTokens: Repository<VerificationToken>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly cfg: AppConfig,
    private readonly mail: MailService,
  ) {}

  // ---------- Registration and verification ----------

  /** Always returns the same message so the response does not reveal whether an email is registered. */
  async registerAuthor(dto: RegisterAuthorDto): Promise<{ message: string }> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException(t('auth.passwordMismatch'));
    }
    this.assertPasswordPolicy(dto.password);

    const email = normalizeEmail(dto.email);
    const existing = await this.users.findOne({ where: { email } });

    if (!existing) {
      const rawToken = await this.dataSource.transaction(async (m) => {
        const user = await m.save(
          m.create(User, {
            fullName: dto.fullName.trim(),
            penName: dto.penName.trim(),
            email,
            passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
            emailVerified: false,
            isActive: true,
          }),
        );
        await m.save(m.create(UserRoleEntity, { userId: user.id, role: UserRole.AUTHOR }));
        return this.createVerificationToken(m, user.id, VerificationTokenType.EMAIL_VERIFICATION, this.cfg.tokens.emailVerificationTtlMs);
      });
      const message = this.mail.verificationEmail(this.frontendLink(this.cfg.frontend.verifyEmailPath, rawToken));
      await this.mail.send(email, message.subject, message.text);
    } else if (!existing.emailVerified) {
      // Registered earlier but never verified (for example before email was set up): send a fresh link.
      const rawToken = await this.dataSource.transaction((m) =>
        this.createVerificationToken(m, existing.id, VerificationTokenType.EMAIL_VERIFICATION, this.cfg.tokens.emailVerificationTtlMs),
      );
      const message = this.mail.verificationEmail(this.frontendLink(this.cfg.frontend.verifyEmailPath, rawToken));
      await this.mail.send(email, message.subject, message.text);
    }

    return { message: t('auth.registerAccepted') };
  }

  /**
   * Reader self-registration. The reader gets no password yet: an emailed link lets them set one.
   * Same response for new and existing emails, so the form cannot reveal who is registered.
   */
  async registerReader(dto: RegisterReaderDto): Promise<{ message: string }> {
    const email = normalizeEmail(dto.email);
    const existing = await this.users.findOne({ where: { email } });

    // Only create a link when nothing usable exists: a new account, or an account that still has no password.
    if (!existing || !existing.passwordHash) {
      const rawToken = await this.dataSource.transaction(async (m) => {
        let user = existing;
        if (!user) {
          user = await m.save(
            m.create(User, {
              fullName: dto.fullName.trim(),
              penName: null,
              email,
              passwordHash: null,
              emailVerified: false,
              isActive: true,
            }),
          );
          await m.save(m.create(UserRoleEntity, { userId: user.id, role: UserRole.READER }));
        }
        return this.createVerificationToken(m, user.id, VerificationTokenType.SET_PASSWORD, 24 * 60 * 60 * 1000);
      });
      const message = this.mail.welcomeEmail(this.frontendLink(this.cfg.frontend.setPasswordPath, rawToken));
      await this.mail.send(email, message.subject, message.text);
    }

    return { message: t('auth.readerRegisterAccepted') };
  }

  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const record = await this.findUsableVerificationToken(rawToken, [VerificationTokenType.EMAIL_VERIFICATION]);
    if (!record) {
      throw new BadRequestException(t('auth.verificationInvalid'));
    }
    await this.dataSource.transaction(async (m) => {
      await m.update(VerificationToken, record.id, { usedAt: new Date() });
      await m.update(User, record.userId, { emailVerified: true });
    });
    return { message: t('auth.emailVerified') };
  }

  // ---------- Login, refresh, logout ----------

  async login(dto: LoginDto): Promise<IssuedSession> {
    const user = await this.users.findOne({ where: { email: normalizeEmail(dto.email) }, relations: { roles: true } });

    let passwordOk = false;
    if (user?.passwordHash) {
      passwordOk = await argon2.verify(user.passwordHash, dto.password);
    } else {
      // Spend comparable time when the account is unknown or has no password yet.
      await argon2.verify(await DUMMY_HASH, dto.password).catch(() => false);
    }

    if (!user || !passwordOk || !user.isActive) {
      throw new UnauthorizedException(t('auth.invalidCredentials'));
    }
    if (!user.emailVerified) {
      throw new ForbiddenException(t('auth.verifyEmailFirst'));
    }

    return this.dataSource.transaction(async (m) => {
      const session = await m.save(m.create(AuthSession, { userId: user.id, userAgent: null }));
      const issued = await this.issueTokens(m, user, session.id);
      return issued.session;
    });
  }

  /**
   * Rotates the refresh token. Presenting an already-rotated token is treated as theft:
   * the whole session family is revoked. The revocation is committed before the error is
   * thrown, otherwise it would roll back together with the transaction.
   */
  async refresh(rawToken: string | undefined): Promise<IssuedSession> {
    if (!rawToken) {
      throw new UnauthorizedException(t('auth.sessionExpired'));
    }
    const hash = hashToken(rawToken);

    const outcome: RefreshOutcome = await this.dataSource.transaction(async (m): Promise<RefreshOutcome> => {
      const token = await m.findOne(RefreshToken, {
        where: { tokenHash: hash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!token) return { ok: false, reason: 'invalid' };

      if (token.revokedAt) {
        await this.revokeSessionFamily(m, token.sessionId);
        return { ok: false, reason: 'reuse' };
      }

      const now = new Date();
      const session = await m.findOne(AuthSession, { where: { id: token.sessionId } });
      if (!session || session.revokedAt || token.expiresAt <= now) {
        return { ok: false, reason: 'invalid' };
      }

      const user = await m.findOne(User, { where: { id: token.userId }, relations: { roles: true } });
      if (!user || !user.isActive) return { ok: false, reason: 'invalid' };

      const issued = await this.issueTokens(m, user, session.id);
      await m.update(RefreshToken, token.id, { revokedAt: now, replacedById: issued.newRefreshTokenId });
      return { ok: true, session: issued.session };
    });

    if (!outcome.ok) {
      throw new UnauthorizedException(outcome.reason === 'reuse' ? t('auth.reuseDetected') : t('auth.sessionExpired'));
    }
    return outcome.session;
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const token = await this.refreshTokens.findOne({ where: { tokenHash: hashToken(rawToken) } });
    if (token) {
      await this.dataSource.transaction((m) => this.revokeSessionFamily(m, token.sessionId));
    }
  }

  // ---------- Passwords ----------

  /** Generic response to avoid account enumeration. */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.users.findOne({ where: { email: normalizeEmail(dto.email) } });
    if (user && user.isActive) {
      const rawToken = await this.dataSource.transaction((m) =>
        this.createVerificationToken(m, user.id, VerificationTokenType.PASSWORD_RESET, this.cfg.tokens.passwordResetTtlMs),
      );
      const message = this.mail.resetEmail(this.frontendLink(this.cfg.frontend.resetPasswordPath, rawToken));
      await this.mail.send(user.email, message.subject, message.text);
    }
    return { message: t('auth.resetAccepted') };
  }

  /** Used for password reset and for setting the first password on a purchase-created reader account. */
  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    this.assertPasswordPolicy(newPassword);
    const record = await this.findUsableVerificationToken(rawToken, [
      VerificationTokenType.PASSWORD_RESET,
      VerificationTokenType.SET_PASSWORD,
    ]);
    if (!record) {
      throw new BadRequestException(t('auth.resetInvalid'));
    }
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.dataSource.transaction(async (m) => {
      await m.update(VerificationToken, record.id, { usedAt: new Date() });
      await m.update(User, record.userId, { passwordHash, emailVerified: true });
      // A password reset signs out every existing session.
      await m.update(AuthSession, { userId: record.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      await m.update(RefreshToken, { userId: record.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    });
    return { message: t('auth.passwordReset') };
  }

  async changePassword(userId: string, currentSessionId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    this.assertPasswordPolicy(dto.newPassword);
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException(t('auth.currentPasswordIncorrect'));
    }
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.dataSource.transaction(async (m) => {
      await m.update(User, userId, { passwordHash });
      // Keep the current session; sign out all others.
      const others = await m.find(AuthSession, { where: { userId, revokedAt: IsNull() } });
      for (const session of others) {
        if (session.id !== currentSessionId) {
          await this.revokeSessionFamily(m, session.id);
        }
      }
    });
    return { message: t('auth.passwordChanged') };
  }

  // ---------- Profile ----------

  async me(userId: string): Promise<CurrentUserDto> {
    const user = await this.users.findOne({ where: { id: userId }, relations: { roles: true } });
    if (!user) throw new UnauthorizedException(t('auth.accountNotFound'));
    return this.toCurrentUser(user);
  }

  // ---------- Helpers ----------

  private assertPasswordPolicy(password: string): void {
    const { minLength, maxLength } = this.cfg.password;
    if (password.length < minLength || password.length > maxLength) {
      throw new BadRequestException(t('auth.passwordLength', { min: minLength, max: maxLength }));
    }
  }

  private toCurrentUser(user: User): CurrentUserDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      penName: user.penName,
      emailVerified: user.emailVerified,
      roles: (user.roles ?? []).map((r) => r.role),
    };
  }

  /** Creates a refresh token (stored as hash) and a new access token for a session. */
  private async issueTokens(
    m: EntityManager,
    user: User,
    sessionId: string,
  ): Promise<{ session: IssuedSession; newRefreshTokenId: string }> {
    const rawRefresh = generateOpaqueToken();
    const saved = await m.save(
      m.create(RefreshToken, {
        tokenHash: hashToken(rawRefresh),
        sessionId,
        userId: user.id,
        expiresAt: new Date(Date.now() + this.cfg.jwt.refreshExpiresInMs),
      }),
    );
    const accessToken = await this.jwt.signAsync({ sub: user.id, sid: sessionId });

    return {
      newRefreshTokenId: saved.id,
      session: {
        refreshToken: rawRefresh,
        tokens: {
          accessToken,
          expiresIn: Math.floor(this.cfg.jwt.accessExpiresInMs / 1000),
          user: this.toCurrentUser(user),
        },
      },
    };
  }

  private async revokeSessionFamily(m: EntityManager, sessionId: string): Promise<void> {
    const now = new Date();
    await m.update(AuthSession, sessionId, { revokedAt: now });
    await m.update(RefreshToken, { sessionId, revokedAt: IsNull() }, { revokedAt: now });
  }

  private async createVerificationToken(
    m: EntityManager,
    userId: string,
    type: VerificationTokenType,
    ttlMs: number,
  ): Promise<string> {
    const raw = generateOpaqueToken();
    await m.save(
      m.create(VerificationToken, {
        userId,
        type,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      }),
    );
    return raw;
  }

  private async findUsableVerificationToken(
    rawToken: string,
    types: VerificationTokenType[],
  ): Promise<VerificationToken | null> {
    const record = await this.verificationTokens.findOne({ where: { tokenHash: hashToken(rawToken) } });
    if (!record || record.usedAt || record.expiresAt <= new Date() || !types.includes(record.type)) {
      return null;
    }
    return record;
  }

  private frontendLink(path: string, token: string): string {
    return `${this.cfg.frontendOrigin}${path}?token=${encodeURIComponent(token)}`;
  }
}
