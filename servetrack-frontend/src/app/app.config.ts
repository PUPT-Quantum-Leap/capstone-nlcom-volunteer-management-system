import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
<<<<<<< HEAD

import { routes } from './app.routes';
=======
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { csrfInterceptor } from './interceptors/csrf.interceptor';
>>>>>>> origin/main

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
<<<<<<< HEAD
    provideRouter(routes)
  ]
=======
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([csrfInterceptor])),
  ],
>>>>>>> origin/main
};
