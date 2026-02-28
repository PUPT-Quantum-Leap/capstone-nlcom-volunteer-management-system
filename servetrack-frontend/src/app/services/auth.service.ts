import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
<<<<<<< HEAD
=======
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, of, map } from 'rxjs';
>>>>>>> origin/main

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
<<<<<<< HEAD
  token?: string;
  user?: {
    id: string;
    email: string;
=======
  user?: {
    id: string;
    email: string;
    name?: string;
>>>>>>> origin/main
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
<<<<<<< HEAD
=======
  private http = inject(HttpClient);
  private apiUrl = '/api';
>>>>>>> origin/main

  // State signals
  isAuthenticated = signal(false);
  currentUser = signal<AuthResponse['user'] | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  /**
<<<<<<< HEAD
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
=======
   * Login user with credentials.
   * Returns an Observable; callers may subscribe or use firstValueFrom/lastValueFrom.
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http
      .post<{ user: AuthResponse['user'] }>(`${this.apiUrl}/login`, credentials, {
        withCredentials: true,
      })
      .pipe(
        map((response) => ({ success: true, user: response.user })),
        tap((response) => {
          if (response.user) {
            this.isAuthenticated.set(true);
            this.currentUser.set(response.user);
          }
        }),
        catchError((err: HttpErrorResponse) => {
          const message = err.error?.message || 'Login failed';
          this.error.set(message);
          return of({ success: false, message } as AuthResponse);
        }),
        tap(() => this.isLoading.set(false)),
      );
  }

  /**
   * Register a new user.
   * Returns an Observable; callers may subscribe or use firstValueFrom/lastValueFrom.
   */
  signup(data: SignupData): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http
      .post<{ user: AuthResponse['user'] }>(
        `${this.apiUrl}/register`,
        {
          name: data.email.split('@')[0],
          email: data.email,
          password: data.password,
          password_confirmation: data.confirmPassword,
        },
        { withCredentials: true },
      )
      .pipe(
        map((response) => ({ success: true, user: response.user })),
        tap((response) => {
          if (response.user) {
            this.isAuthenticated.set(true);
            this.currentUser.set(response.user);
          }
        }),
        catchError((err: HttpErrorResponse) => {
          const message = err.error?.message || 'Signup failed';
          this.error.set(message);
          return of({ success: false, message } as AuthResponse);
        }),
        tap(() => this.isLoading.set(false)),
      );
  }

  /**
   * Logout current user.
   */
  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.clearSession()),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
      );
  }

  /**
   * Check authentication status against the API.
   */
  checkAuthStatus(): Observable<AuthResponse> {
    return this.http
      .get<AuthResponse['user']>(`${this.apiUrl}/user`, { withCredentials: true })
      .pipe(
        tap((user) => {
          this.isAuthenticated.set(true);
          this.currentUser.set(user);
        }),
        catchError(() => {
          this.isAuthenticated.set(false);
          this.currentUser.set(null);
          return of({ success: false } as AuthResponse);
        }),
      ) as Observable<AuthResponse>;
  }

  private clearSession(): void {
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
>>>>>>> origin/main
  }
}
