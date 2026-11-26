import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppConfig } from '../config/app-config';
import { t } from '../i18n/i18n';

export type UploadKind = 'cover' | 'image';

interface SniffedImage {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
}

/** Detects the real image type from the file header. The client-supplied name or MIME type is ignored. */
export function sniffImage(buffer: Buffer): SniffedImage | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= 8 && pngSignature.every((byte, i) => buffer[i] === byte)) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }
  return null;
}

@Injectable()
export class UploadsService {
  constructor(private readonly cfg: AppConfig) {
    mkdirSync(this.directory, { recursive: true });
  }

  private get directory(): string {
    return resolve(this.cfg.upload.directory);
  }

  /** Validates type and size for the given kind, saves under a random name, and returns the public URL. */
  save(buffer: Buffer, kind: UploadKind): { url: string } {
    const limit = kind === 'cover' ? this.cfg.upload.maxCoverBytes : this.cfg.upload.maxImageBytes;
    if (buffer.length > limit) {
      throw new PayloadTooLargeException(t('uploads.tooLarge', { maxMb: Math.round((limit / 1048576) * 10) / 10 }));
    }
    const image = sniffImage(buffer);
    if (!image) {
      throw new BadRequestException(t('uploads.unsupportedType'));
    }

    const fileName = `${randomUUID()}.${image.extension}`;
    writeFileSync(resolve(this.directory, fileName), buffer);
    return { url: `${this.cfg.upload.urlPath}/${fileName}` };
  }
}
