import { createHash, randomBytes } from 'crypto';

/** 32 bytes of CSPRNG output, URL-safe. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only hashes are stored in the database; raw tokens leave the server once. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
