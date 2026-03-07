import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Reads the XSRF-TOKEN cookie set by Laravel's Sanctum and attaches it
 * as the X-XSRF-TOKEN header on every state-changing request (non-GET/HEAD).
 * Angular's built-in XSRF handler only covers same-origin XHR; this interceptor
 * ensures withCredentials fetch requests also carry the token.
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const csrfToken = getCsrfToken();

    if (csrfToken) {
      req = req.clone({
        setHeaders: {
          'X-XSRF-TOKEN': csrfToken,
        },
      });
    } else {
      // Log warning for debugging - CSRF token should be present after initial page load
      console.warn('[CSRF Interceptor] XSRF-TOKEN cookie not found. Request may fail.');
    }
  }

  return next(req);
};

function getCsrfToken(): string | null {
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
