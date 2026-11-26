import { environment } from '../../../environments/environment';

/** Backend API base and the auth endpoints, built from environment.apiBaseUrl. */
export const API_BASE = environment.apiBaseUrl;
export const AUTH_BASE = `${API_BASE}/auth`;

/** Auth endpoints that must never receive a Bearer token or trigger a refresh. */
const PUBLIC_AUTH_PATHS = [
  'login',
  'refresh',
  'logout',
  'verify-email',
  'forgot-password',
  'reset-password',
  'author/register',
];

export function isPublicAuthUrl(url: string): boolean {
  return PUBLIC_AUTH_PATHS.some((path) => url === `${AUTH_BASE}/${path}`);
}

/** Application routes, shared by guards and navigation so paths are defined once. */
export const ROUTES = {
  login: '/auth/login',
  authorRegister: '/auth/author/register',
  adminDashboard: '/admin/dashboard',
  authorDashboard: '/author/dashboard',
  readerLibrary: '/reader/my-library',
  home: '/',
} as const;
