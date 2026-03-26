import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-facebook-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      @if (isLoading()) {
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Completing Facebook login...</p>
        </div>
      } @else if (errorMessage()) {
        <div class="error-container">
          <h2>Login Failed</h2>
          <p>{{ errorMessage() }}</p>
          <button (click)="goToLogin()">Back to Login</button>
        </div>
      } @else {
        <div class="success-container">
          <h2>Login Successful!</h2>
          <p>Redirecting to your dashboard...</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f9fafb;
    }
    .loading-spinner, .error-container, .success-container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .error-container h2 {
      color: #dc2626;
    }
    .error-container button {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .success-container h2 {
      color: #16a34a;
    }
  `]
})
export class FacebookCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    const error = this.route.snapshot.queryParamMap.get('error');

    if (error) {
      this.errorMessage.set('Facebook login was denied.');
      this.isLoading.set(false);
      return;
    }

    if (!code) {
      this.errorMessage.set('Authorization code not received.');
      this.isLoading.set(false);
      return;
    }

    this.authService.checkAuthStatus$().subscribe({
      next: (response) => {
        if (response.success && response.user) {
          this.authService.isAuthenticated.set(true);
          this.authService.currentUser.set(response.user);
          this.redirectBasedOnRole(response.user);
        } else {
          this.errorMessage.set('Session verification failed. Please try logging in again.');
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('An error occurred while verifying your session.');
        this.isLoading.set(false);
      }
    });
  }

  private redirectBasedOnRole(user: NonNullable<ReturnType<typeof this.authService.currentUser.get>>): void {
    const role = user.role || user.user_type;
    if (role === 'admin') {
      this.router.navigate(['/admin-dashboard']);
    } else {
      this.router.navigate(['/volunteer-dashboard']);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
