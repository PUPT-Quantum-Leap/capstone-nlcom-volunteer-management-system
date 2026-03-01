import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Consider it authenticated if signal says so, or if there's a token in sessionStorage
    if (authService.isAuthenticated() || sessionStorage.getItem('auth_token')) {
        const user = authService.currentUser();
        
        // If user has volunteer profile, they're a volunteer
        if (user?.volunteer) {
            return true;
        } else {
            // User without volunteer profile is considered admin
            // Redirect to admin dashboard if trying to access volunteer dashboard
            const currentUrl = router.url;
            if (currentUrl.includes('volunteer-dashboard')) {
                return router.parseUrl('/admin-dashboard');
            }
            return true;
        }
    }

    return router.parseUrl('/login');
};
