import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';
import { of } from 'rxjs';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Helper to determine redirect route
  const getRedirectUrl = (userType: string | undefined): string => {
    return userType === 'admin' ? '/admin-dashboard' : '/volunteer-dashboard';
  };

  // Check if there is a cached authentication state
  if (authService.isAuthenticated()) {
    const userType = authService.currentUser()?.user_type || authService.currentUser()?.role;
    return router.parseUrl(getRedirectUrl(userType));
  }

  // If not cached, check with backend
  // We use take(1) to complete the observable and allow the route to resolve
  return authService.checkAuthStatus$().pipe(
    take(1),
    map((response) => {
      if (response.success && response.user) {
        const userType = response.user.user_type || response.user.role;
        return router.parseUrl(getRedirectUrl(userType));
      }
      
      // Not authenticated, allow access to the route
      return true;
    })
  );
};
