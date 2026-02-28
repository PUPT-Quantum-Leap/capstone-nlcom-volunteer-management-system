import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    id: string;
    email: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);

  // State signals
  isAuthenticated = signal(false);
  currentUser = signal<AuthResponse['user'] | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  /**
   * Login user with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Validate email format
      if (!this.isValidEmail(credentials.email)) {
        throw new Error('Invalid email format');
      }

      // TODO: Replace with actual API call
      // Example: const response = await fetch('/api/auth/login', { ... });
      
      // Simulate API call
      await this.delay(2000);

      // Simulate successful login
      const response: AuthResponse = {
        success: true,
        token: 'mock-jwt-token',
        user: {
          id: '1',
          email: credentials.email,
        },
      };

      if (response.success && response.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
        
        // Store token securely (consider using httpOnly cookies in production)
        if (response.token) {
          sessionStorage.setItem('auth_token', response.token);
        }

        console.log('Login successful', {
          email: credentials.email,
          // Never log password
        });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      this.error.set(errorMessage);
      
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Register new user
   */
  async signup(data: SignupData): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Validate email format
      if (!this.isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      // TODO: Replace with actual API call
      // Example: const response = await fetch('/api/auth/signup', { ... });
      
      // Simulate API call
      await this.delay(2000);

      // Simulate successful signup
      const response: AuthResponse = {
        success: true,
        token: 'mock-jwt-token',
        user: {
          id: '1',
          email: data.email,
        },
      };

      if (response.success && response.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
        
        // Store token securely
        if (response.token) {
          sessionStorage.setItem('auth_token', response.token);
        }

        console.log('Signup successful', {
          email: data.email,
          // Never log password
        });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed';
      this.error.set(errorMessage);
      
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      // TODO: Call API to invalidate token on server
      
      // Clear local state
      this.isAuthenticated.set(false);
      this.currentUser.set(null);
      sessionStorage.removeItem('auth_token');
      
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  /**
   * Check if user is authenticated (e.g., on app initialization)
   */
  async checkAuthStatus(): Promise<boolean> {
    const token = sessionStorage.getItem('auth_token');
    
    if (!token) {
      return false;
    }

    try {
      // TODO: Validate token with backend
      // Example: const response = await fetch('/api/auth/me', { ... });
      
      // For now, assume token is valid
      this.isAuthenticated.set(true);
      return true;
    } catch (error) {
      this.isAuthenticated.set(false);
      sessionStorage.removeItem('auth_token');
      return false;
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Delay helper for simulating async operations
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
