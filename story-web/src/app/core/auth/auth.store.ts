import { Injectable, computed, signal } from '@angular/core';

export type UserRole = 'ADMIN' | 'AUTHOR' | 'READER';
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  penName: string | null;
  emailVerified: boolean;
  roles: UserRole[];
}

/**
 * Signals-based session state. The access token itself is NOT stored here;
 * AuthService keeps it in memory only (never in localStorage).
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _user = signal<CurrentUser | null>(null);
  private readonly _status = signal<AuthStatus>('idle');

  readonly user = this._user.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly roles = computed<UserRole[]>(() => this._user()?.roles ?? []);

  hasRole(role: UserRole): boolean {
    return this.roles().includes(role);
  }

  setLoading(): void {
    this._status.set('loading');
  }

  setUser(user: CurrentUser): void {
    this._user.set(user);
    this._status.set('authenticated');
  }

  clear(): void {
    this._user.set(null);
    this._status.set('anonymous');
  }
}
