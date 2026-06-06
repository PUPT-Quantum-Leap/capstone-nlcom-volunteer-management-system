import { HttpInterceptorFn, inject } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

/**
 * Reads the XSRF-TOKEN cookie set by Laravel's Sanctum and attaches it
 * as the X-XSRF-TOKEN header on every state-changing request (non-GET/HEAD).
 *
 * Falls back to a cached token from AuthService (captured from the
 * X-CSRF-TOKEN response header sent by the backend). This covers environments
 * where the Set-Cookie header may be dropped by a proxy/CDN (e.g. Vercel
 * preview deployments).
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const csrfToken = getCsrfTokenFromCookie()
      ?? inject(AuthService).getStoredCsrfToken();

    if (csrfToken) {
      req = req.clone({
        setHeaders: {
          'X-XSRF-TOKEN': csrfToken,
        },
      });
    } else {
      console.warn('[CSRF Interceptor] XSRF-TOKEN cookie not found. Request may fail.');
    }
  }

  return next(req);
};

function getCsrfTokenFromCookie(): string | null {
  const name = 'XSRF-TOKEN';
  const cookies = document.cookie.split(';');

  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(name + '=')) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }

  return null;
}
