import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, of, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface VolunteerSignupData {
  firstName: string;
  lastName: string;
  facebookName?: string;
  email: string;
  mobileNumber: string;
  birthdate: string;
  completeAddress: string;
  educationalAttainment: string;
  lastMedicalExam: string;
  trainingExperience?: string;
  skillsHobbies?: string;
  classesTraining?: string;
  volunteerPreference: string;
  otherPreference?: string;
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
   * Returns both Promise and Observable for compatibility.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      if (!this.isValidEmail(credentials.email)) {
        throw new Error('Invalid email format');
      }

      const response = await this.http.post<AuthResponse>(
        `${environment.apiUrl}/login`,
        credentials
      ).toPromise();

      if (response?.success && response?.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
        
        if (response.token) {
          sessionStorage.setItem('auth_token', response.token);
        }
      }

      return response!;
    } catch (error: any) {
      const errorMessage = error?.error?.message || 'Login failed';
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
   * Observable version of login for RxJS compatibility.
   */
  login$(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<{ user: AuthResponse['user'] }>(
      `${this.apiUrl}/login`, 
      credentials, 
      { withCredentials: true }
    ).pipe(
      map(response => ({ success: true, user: response.user })),
      tap(response => {
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
   * Register a new user - Promise version (your working version).
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      if (!this.isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      const response = await this.http.post<AuthResponse>(
        `${environment.apiUrl}/register`,
        data
      ).toPromise();

      if (response?.success && response?.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
        
        if (response.token) {
          sessionStorage.setItem('auth_token', response.token);
        }
      }

      return response!;
    } catch (error: any) {
      const errorMessage = error?.error?.message || 'Registration failed';
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
   * Register new volunteer - Promise version (your working version).
   */
  async volunteerSignup(data: VolunteerSignupData): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      if (!this.isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      const response = await this.http.post<AuthResponse>(
        `${environment.apiUrl}/volunteer/register`,
        data
      ).toPromise();

      if (response?.success && response?.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
        
        if (response.token) {
          sessionStorage.setItem('auth_token', response.token);
        }
      }

      return response!;
    } catch (error: any) {
      const errorMessage = error?.error?.message || 'Registration failed';
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
   * Logout current user - both Promise and Observable versions.
   */
  async logout(): Promise<void> {
    try {
      const token = sessionStorage.getItem('auth_token');
      
      if (token) {
        await this.http.post(`${this.apiUrl}/logout`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).toPromise();
      }
      
      this.isAuthenticated.set(false);
      this.currentUser.set(null);
      sessionStorage.removeItem('auth_token');
      
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  logout$(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.clearSession()),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
      );
  }

  /**
   * Check authentication status - both Promise and Observable versions.
   */
  async checkAuthStatus(): Promise<boolean> {
    const token = sessionStorage.getItem('auth_token');
    
    if (!token) {
      return false;
    }

    try {
      const response = await this.http.get<AuthResponse>(
        `${this.apiUrl}/user`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      ).toPromise();

      if (response?.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
        return true;
      }
      
      return false;
    } catch (error) {
      this.isAuthenticated.set(false);
      sessionStorage.removeItem('auth_token');
      return false;
    }
  }

  checkAuthStatus$(): Observable<AuthResponse> {
    return this.http.get<AuthResponse['user']>(`${this.apiUrl}/user`, { withCredentials: true })
      .pipe(
        tap(user => {
          this.isAuthenticated.set(true);
          this.currentUser.set(user);
        }),
        catchError(() => {
          this.isAuthenticated.set(false);
          this.currentUser.set(null);
          return of({ success: false } as AuthResponse);
        }),
      );
  }

  private clearSession(): void {
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
}