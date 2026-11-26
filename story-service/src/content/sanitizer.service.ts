import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { AppConfig } from '../config/app-config';

const ALLOWED_TAGS = ['p', 'h2', 'h3', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'br', 'img'];

/**
 * Cleans story HTML on the server. Only the tags the editor produces are kept, scripts and
 * event handlers are removed, and images may point only to files in our upload folder.
 */
@Injectable()
export class SanitizerService {
  constructor(private readonly cfg: AppConfig) {}

  sanitizeStoryHtml(html: string): string {
    const uploadPrefix = `${this.cfg.upload.urlPath}/`;
    return sanitizeHtml(html, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: { img: ['src', 'alt'] },
      allowedSchemes: [],
      allowedSchemesByTag: {},
      allowProtocolRelative: false,
      exclusiveFilter: (frame) => frame.tag === 'img' && !(frame.attribs.src ?? '').startsWith(uploadPrefix),
    });
  }
}
