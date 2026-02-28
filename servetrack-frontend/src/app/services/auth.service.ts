import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, of, map } from 'rxjs';

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
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiUrl = '/api';

  // State signals
  isAuthenticated = signal(false);
  currentUser = signal<AuthResponse['user'] | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  /**
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
  }
}
