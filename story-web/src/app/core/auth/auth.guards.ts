import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthStore, UserRole } from './auth.store';

/** Requires a logged-in user. Waits for the session restore on first navigation. */
export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const store = inject(AuthStore);
  const router = inject(Router);

  await auth.ensureSession();
  if (store.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};

/** Requires a logged-in user holding the given role. Backend enforcement is still authoritative. */
export const roleGuard = (role: UserRole): CanActivateFn => async (_route, state) => {
  const auth = inject(AuthService);
  const store = inject(AuthStore);
  const router = inject(Router);

  await auth.ensureSession();
  if (!store.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
  }
  return store.hasRole(role) ? true : router.createUrlTree(['/']);
};
