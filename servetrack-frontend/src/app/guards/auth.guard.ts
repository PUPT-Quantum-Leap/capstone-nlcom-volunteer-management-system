import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService, AuthResponse } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

function resolveUserType(user: AuthResponse['user'] | null | undefined): string {
  return user?.user_type || user?.role || '';
}

function canAccessTarget(targetUrl: string, userType: string): boolean {
  if (targetUrl.startsWith('/volunteer-dashboard')) {
    return userType === 'volunteer' || userType === 'coordinator';
  }

  if (targetUrl.startsWith('/admin-dashboard')) {
    return userType === 'admin';
  }

  return true;
}

function getFallbackRoute(userType: string): string {
  if (userType === 'admin') {
    return '/admin-dashboard';
  }

  return '/volunteer-dashboard';
}

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const targetUrl = state.url;

  // Check if there is a cached authentication state
  if (authService.isAuthenticated()) {
    const user = authService.currentUser();
    const userType = resolveUserType(user);
    if (canAccessTarget(targetUrl, userType)) {
      return true;
    }

    return router.parseUrl(getFallbackRoute(userType));
  }

  // If not cached, check with backend
  return authService.checkAuthStatus$().pipe(
    take(1),
    map((response) => {
      if (response.success && response.user) {
        const userType = resolveUserType(response.user);
        if (canAccessTarget(targetUrl, userType)) {
          return true;
        }

        return router.parseUrl(getFallbackRoute(userType));
      }

      // Not authenticated, redirect to login
      return router.parseUrl('/login');
    }),
  );
};
