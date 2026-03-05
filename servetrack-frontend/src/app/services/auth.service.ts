import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  name: string;
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
    name: string;
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
        user: {
          id: '1',
          name: 'John Doe',
          email: credentials.email,
        },
      };

      if (response.success && response.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
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

      // Validate name
      const trimmedName = data.name.trim();
      if (trimmedName.length < 2) {
        throw new Error('Name must be at least 2 characters');
      }

      // TODO: Replace with actual API call
      // Example: const response = await fetch('/api/auth/signup', { ... });
      
      // Simulate API call
      await this.delay(2000);

      // Simulate successful signup
      const response: AuthResponse = {
        success: true,
        user: {
          id: '1',
          name: trimmedName,
          email: data.email,
        },
      };

      if (response.success && response.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
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
      // Example: await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });

      // Clear local state
      this.isAuthenticated.set(false);
      this.currentUser.set(null);

      await this.router.navigate(['/login']);
    } catch (error: unknown) {
      // Use unknown type for error and avoid logging potentially sensitive info
    }
  }

  /**
   * Check if user is authenticated (e.g., on app initialization)
   */
  async checkAuthStatus(): Promise<boolean> {
    try {
      // Validate session with backend using HttpOnly cookies
      const response = await fetch('/api/v1/user', {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          this.isAuthenticated.set(true);
          this.currentUser.set(data.user);
          return true;
        }
      }

      this.isAuthenticated.set(false);
      this.currentUser.set(null);
      return false;
    } catch (error) {
      this.isAuthenticated.set(false);
      this.currentUser.set(null);
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
