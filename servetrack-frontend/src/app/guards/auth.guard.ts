import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Consider it authenticated if signal says so, or if there's a token in sessionStorage
    if (authService.isAuthenticated() || sessionStorage.getItem('auth_token')) {
        return true;
    }

    return router.parseUrl('/login');
};
