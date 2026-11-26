import { Injectable, signal } from '@angular/core';

/**
 * The header search term. It lives in memory only, so a page refresh clears it and the home
 * list shows every story again. An empty term means "all stories".
 */
@Injectable({ providedIn: 'root' })
export class StorySearchService {
  readonly term = signal('');
}
