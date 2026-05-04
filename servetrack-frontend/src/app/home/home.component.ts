import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LandingPage } from '../landing-page/landing-page';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, LandingPage],
  template: `
    @if (!isAuthenticated()) {
      <app-landing-page></app-landing-page>
    } @else {
      <!-- Empty div or loading spinner while redirecting -->
      <div class="flex items-center justify-center min-h-screen">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    }
  `,
})
export class HomeComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Use a local signal/property to prevent rendering landing page briefly before redirect
  isAuthenticated = this.authService.isAuthenticated;

  ngOnInit(): void {
    // Check cached auth state first
    if (this.authService.isAuthenticated()) {
      this.redirectBasedOnRole();
      return;
    }

    // Verify with backend (non-blocking check)
    this.authService.checkAuthStatus$().pipe(take(1)).subscribe((response) => {
      if (response.success && response.user) {
        this.redirectBasedOnRole();
      }
    });
  }

  private redirectBasedOnRole(): void {
    const user = this.authService.currentUser();
    const userType = user?.user_type || user?.role || '';
    
    let redirectUrl = '/volunteer-auth'; // Safe default
    
    if (userType === 'admin') {
      redirectUrl = '/admin-dashboard';
    } else if (userType === 'coordinator' || userType === 'volunteer') {
      redirectUrl = '/volunteer-dashboard';
    }
    
    this.router.navigateByUrl(redirectUrl);
  }
}
