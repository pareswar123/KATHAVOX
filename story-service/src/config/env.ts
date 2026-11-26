import 'dotenv/config';

/**
 * Typed access to environment variables. Every value must be defined in .env (see .env.example).
 * A missing or malformed variable throws immediately, so the app never runs with a silent default.
 */

function read(key: string): string {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error(`Missing environment variable ${key}. Define it in story-service/.env (see .env.example).`);
  }
  return value;
}

export const env = {
  /** May be empty; use for optional values such as SMTP_USER. */
  string(key: string): string {
    return read(key);
  },

  nonEmpty(key: string): string {
    const value = read(key).trim();
    if (!value) throw new Error(`Environment variable ${key} must not be empty.`);
    return value;
  },

  number(key: string): number {
    const raw = read(key).trim();
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) {
      throw new Error(`Environment variable ${key} must be a number, got "${raw}".`);
    }
    return value;
  },

  bool(key: string): boolean {
    const raw = read(key).trim().toLowerCase();
    if (raw !== 'true' && raw !== 'false') {
      throw new Error(`Environment variable ${key} must be "true" or "false", got "${raw}".`);
    }
    return raw === 'true';
  },

  /** Durations such as "15m", "7d", "12h", "30s" → milliseconds. */
  durationMs(key: string): number {
    const match = /^(\d+)\s*(s|m|h|d)?$/.exec(read(key).trim());
    if (!match) {
      throw new Error(`Environment variable ${key} must look like 15m, 7d, 12h or 30s.`);
    }
    const factor = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[(match[2] ?? 's') as 's' | 'm' | 'h' | 'd'];
    return Number(match[1]) * factor;
  },
};
