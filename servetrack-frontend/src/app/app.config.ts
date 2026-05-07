import { ApplicationConfig, APP_INITIALIZER, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { csrfInterceptor } from './interceptors/csrf.interceptor';
import { authInitializer } from './_helpers/auth.initializer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([csrfInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: authInitializer,
      multi: true,
    },
  ],
};
