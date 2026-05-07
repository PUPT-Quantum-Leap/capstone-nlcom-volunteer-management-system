import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, of } from 'rxjs';
import { take } from 'rxjs/operators';

/**
 * APP_INITIALIZER factory function to initialize authentication state on app startup.
 *
 * Flow:
 * 1. Check if 'has_session' exists in localStorage
 * 2. If yes, call authService.checkAuthStatus$() to validate with backend
 * 3. Return Observable that completes silently (even on error)
 * 4. Blocks app initialization until auth check completes
 * 5. Sets isAuthenticated signal for all components to use
 *
 * This ensures:
 * - canVote() signal is correct on page load
 * - Auth state persists across page refreshes
 * - Auth state is consistent across browser tabs
 */
export function authInitializer() {
  const authService = inject(AuthService);

  return () => {
    const hasSession = localStorage.getItem('has_session') === 'true';

    if (!hasSession) {
      return of(null);
    }

    return authService.checkAuthStatus$().pipe(
      take(1),
      catchError(() => {
        return of(null);
      })
    );
  };
}