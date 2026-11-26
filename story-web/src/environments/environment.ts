/**
 * Frontend configuration. Change values here, never inline in components or services.
 * csrfHeaderName / csrfHeaderValue must match CSRF_HEADER_NAME / CSRF_HEADER_VALUE in story-service/.env.
 */
export const environment = {
  production: false,
  brandName: 'KATHAVOX',
  apiBaseUrl: '/api/v1',
  csrfHeaderName: 'X-Requested-With',
  csrfHeaderValue: 'KATHAVOX-Web',
};
