import { RenderMode, ServerRoute } from '@angular/ssr';

// Protected areas and the public reader are rendered in the browser for now. Server rendering of
// public story pages needs the API reachable from the Node server (a /api proxy), which comes with SEO work.
export const serverRoutes: ServerRoute[] = [
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'author/**', renderMode: RenderMode.Client },
  { path: 'reader/**', renderMode: RenderMode.Client },
  { path: 'story/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client },
];
