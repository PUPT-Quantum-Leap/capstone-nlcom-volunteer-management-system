import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Check if there is a cached authentication state
    if (authService.isAuthenticated()) {
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

    // If not cached, check with backend
    return authService.checkAuthStatus$().pipe(
        take(1),
        map(response => {
            if (response.success && response.user) {
                const user = response.user;
                
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

            // Not authenticated, redirect to login
            return router.parseUrl('/login');
        })
    );
};
