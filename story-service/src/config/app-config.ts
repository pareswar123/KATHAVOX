import { Injectable } from '@nestjs/common';
import { env } from './env';

/**
 * Typed application settings. Every field comes from an environment variable.
 * Constructed once at startup; missing values fail fast.
 */
@Injectable()
export class AppConfig {
  readonly appName = env.nonEmpty('APP_NAME');
  readonly nodeEnv = env.nonEmpty('NODE_ENV');
  readonly port = env.number('PORT');
  readonly apiPrefix = env.nonEmpty('API_PREFIX');
  readonly apiVersion = env.nonEmpty('API_VERSION');
  readonly swaggerPath = env.nonEmpty('SWAGGER_PATH');
  readonly frontendOrigin = env.nonEmpty('FRONTEND_ORIGIN');

  readonly frontend = {
    verifyEmailPath: env.nonEmpty('FRONTEND_VERIFY_EMAIL_PATH'),
    resetPasswordPath: env.nonEmpty('FRONTEND_RESET_PASSWORD_PATH'),
    setPasswordPath: env.nonEmpty('FRONTEND_SET_PASSWORD_PATH'),
  };

  readonly database = {
    host: env.nonEmpty('DATABASE_HOST'),
    port: env.number('DATABASE_PORT'),
    name: env.nonEmpty('DATABASE_NAME'),
    username: env.nonEmpty('DATABASE_USERNAME'),
    password: env.string('DATABASE_PASSWORD'),
    logging: env.bool('DATABASE_LOGGING'),
    migrationsTable: env.nonEmpty('DATABASE_MIGRATIONS_TABLE'),
  };

  readonly jwt = {
    secret: env.nonEmpty('JWT_ACCESS_SECRET'),
    accessExpiresInMs: env.durationMs('JWT_ACCESS_EXPIRES_IN'),
    refreshExpiresInMs: env.durationMs('REFRESH_TOKEN_EXPIRES_IN'),
    refreshCookieName: env.nonEmpty('REFRESH_COOKIE_NAME'),
    /** Cookie is limited to the auth routes, e.g. /api/v1/auth. */
    refreshCookiePath: `/${env.nonEmpty('API_PREFIX').replace(/^\/+|\/+$/g, '')}/auth`,
    cookieSecure: env.bool('COOKIE_SECURE'),
  };

  readonly csrf = {
    headerName: env.nonEmpty('CSRF_HEADER_NAME'),
    headerValue: env.nonEmpty('CSRF_HEADER_VALUE'),
  };

  readonly upload = {
    directory: env.nonEmpty('UPLOAD_DIRECTORY'),
    urlPath: env.nonEmpty('UPLOAD_URL_PATH'),
    maxCoverBytes: env.number('UPLOAD_MAX_COVER_BYTES'),
    maxImageBytes: env.number('UPLOAD_MAX_IMAGE_BYTES'),
  };

  readonly stories = {
    defaultFreePreviewPages: env.number('STORY_DEFAULT_FREE_PREVIEW_PAGES'),
    maxPageContentLength: env.number('STORY_MAX_PAGE_CONTENT_LENGTH'),
  };

  /** Book-style PDF export (admin). The font must contain the story's script, e.g. Odia. */
  readonly pdf = {
    fontPath: env.nonEmpty('PDF_FONT_PATH'),
    pageSize: env.nonEmpty('PDF_PAGE_SIZE'),
    marginMm: env.number('PDF_MARGIN_MM'),
  };

  readonly password = {
    minLength: env.number('PASSWORD_MIN_LENGTH'),
    maxLength: env.number('PASSWORD_MAX_LENGTH'),
  };

  readonly tokens = {
    emailVerificationTtlMs: env.durationMs('EMAIL_VERIFICATION_TOKEN_TTL'),
    passwordResetTtlMs: env.durationMs('PASSWORD_RESET_TOKEN_TTL'),
  };

  readonly cache = {
    publicControl: `public, max-age=${env.number('PUBLIC_CACHE_MAX_AGE_SECONDS')}`,
    /** Story pages must reflect publish, unpublish and archive at once, so they are revalidated each time. */
    publicStoriesControl: env.nonEmpty('PUBLIC_STORY_CACHE_CONTROL'),
  };

  readonly pagination = {
    defaultLimit: env.number('PAGINATION_DEFAULT_LIMIT'),
    maxLimit: env.number('PAGINATION_MAX_LIMIT'),
  };

  readonly mail = {
    host: env.string('SMTP_HOST').trim() || null,
    port: env.number('SMTP_PORT'),
    user: env.string('SMTP_USER'),
    password: env.string('SMTP_PASSWORD'),
    from: env.nonEmpty('SMTP_FROM'),
  };

  /** Razorpay test-mode keys. Empty values are allowed; payments then report "not configured". */
  readonly razorpay = {
    keyId: env.string('RAZORPAY_KEY_ID').trim(),
    keySecret: env.string('RAZORPAY_KEY_SECRET').trim(),
    webhookSecret: env.string('RAZORPAY_WEBHOOK_SECRET').trim(),
    currency: env.nonEmpty('RAZORPAY_CURRENCY'),
  };

  readonly ads = {
    enabled: env.bool('ADS_ENABLED'),
  };

  /** Offset from UTC used to decide what "today" and "this month" mean for payments (IST = 330). */
  readonly payments = {
    utcOffsetMinutes: env.number('PAYMENTS_UTC_OFFSET_MINUTES'),
  };

  readonly seed = {
    adminName: env.nonEmpty('ADMIN_SEED_NAME'),
    adminEmail: env.string('ADMIN_SEED_EMAIL'),
    adminPassword: env.string('ADMIN_SEED_PASSWORD'),
  };

  readonly sampleUsers = {
    password: env.string('SEED_SAMPLE_USER_PASSWORD'),
  };

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
