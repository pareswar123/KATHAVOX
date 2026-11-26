import { env } from './env';

/** Multer size cap for the whole request. Per-kind limits are enforced in UploadsService. */
export const UPLOAD_REQUEST_LIMITS = {
  fileSize: Math.max(env.number('UPLOAD_MAX_COVER_BYTES'), env.number('UPLOAD_MAX_IMAGE_BYTES')),
  files: 1,
};
