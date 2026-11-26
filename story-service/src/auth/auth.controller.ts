import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/app-config';
import { AUTH_THROTTLE, RECOVERY_THROTTLE } from '../config/throttle';
import { AuthService } from './auth.service';
import { CurrentUser, type AuthenticatedUser, Public } from './auth.decorators';
import { CsrfGuard } from './guards/csrf.guard';
import {
  AuthTokensDto,
  ChangePasswordDto,
  CurrentUserDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterAuthorDto,
  RegisterReaderDto,
  ResetPasswordDto,
  TokenDto,
  RefreshTokenDto,
} from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cfg: AppConfig,
  ) {}

  @Public()
  @Post('author/register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Register a free author account (email verification required)' })
  registerAuthor(@Body() dto: RegisterAuthorDto) {
    return this.auth.registerAuthor(dto);
  }

  @Public()
  @Post('reader/register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Register as a reader. An emailed link lets the reader set a password.' })
  registerReader(@Body() dto: RegisterReaderDto) {
    return this.auth.registerReader(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ type: AuthTokensDto })
  async login(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    const issued = await this.auth.login(dto);
    return { ...issued.tokens, refreshToken: issued.refreshToken };
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  @ApiOkResponse({ type: AuthTokensDto })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    const issued = await this.auth.refresh(dto.refreshToken);
    return { ...issued.tokens, refreshToken: issued.refreshToken };
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke the current session and clear the refresh cookie' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.auth.logout(dto.refreshToken);
    return { loggedOut: true };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address using the emailed token' })
  verifyEmail(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(RECOVERY_THROTTLE)
  @ApiOperation({ summary: 'Request a password reset email (always returns the same response)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Set a new password using a single-use token; revokes all sessions' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password; signs out all other sessions' })
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, user.sessionId, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile and roles' })
  @ApiOkResponse({ type: CurrentUserDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserDto> {
    return this.auth.me(user.id);
  }

  // ---------- cookie helpers ----------

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(this.cfg.jwt.refreshCookieName, token, {
      ...this.cookieOptions(),
      maxAge: this.cfg.jwt.refreshExpiresInMs,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.cfg.jwt.cookieSecure,
      sameSite: 'strict' as const,
      path: this.cfg.jwt.refreshCookiePath,
    };
  }
}
