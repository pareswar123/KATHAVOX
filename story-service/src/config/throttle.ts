import { env } from './env';

/**
 * Rate-limit profiles. Values come from .env. Decorators are evaluated at import time,
 * which is why these are built from env directly rather than injected.
 */
export const GLOBAL_THROTTLE = {
  ttl: env.number('THROTTLE_TTL_MS'),
  limit: env.number('THROTTLE_LIMIT'),
};

/** Login, registration and password reset. */
export const AUTH_THROTTLE = {
  default: { ttl: env.number('AUTH_THROTTLE_TTL_MS'), limit: env.number('AUTH_THROTTLE_LIMIT') },
};

/** Forgot-password requests, which send email and are therefore stricter. */
export const RECOVERY_THROTTLE = {
  default: { ttl: env.number('AUTH_THROTTLE_TTL_MS'), limit: env.number('RECOVERY_THROTTLE_LIMIT') },
};
