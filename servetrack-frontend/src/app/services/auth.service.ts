import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
  private http = inject(HttpClient);

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
      if (!this.isValidEmail(credentials.email)) {
        throw new Error('Invalid email format');
      }

      // Real API call to Laravel backend
      const response = await this.http.post<AuthResponse>(
        `${environment.apiUrl}/login`,
        credentials
      ).toPromise();

      if (response?.success && response?.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
        
        // Store token securely
        if (response.token) {
          sessionStorage.setItem('auth_token', response.token);
        }

        return response!;
      }

      return {
        success: false,
        message: 'Login failed',
      };
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
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      if (!this.isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      // Real API call to Laravel backend
      const response = await this.http.post<AuthResponse>(
        `${environment.apiUrl}/register`,
        data
      ).toPromise();

      if (response?.success && response?.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
        
        // Store token securely
        if (response.token) {
          sessionStorage.setItem('auth_token', response.token);
        }

        return response!;
      }

      return {
        success: false,
        message: 'Registration failed',
      };
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
   * Register new volunteer
   */
  async volunteerSignup(data: VolunteerSignupData): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Validate email format
      if (!this.isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      // Real API call to Laravel backend
      const response = await this.http.post<AuthResponse>(
        `${environment.apiUrl}/volunteer/register`,
        data
      ).toPromise();

      if (response?.success && response?.user) {
        this.isAuthenticated.set(true);
        this.currentUser.set(response.user);
        
        // Store token securely
        if (response.token) {
          sessionStorage.setItem('auth_token', response.token);
        }

        return response!;
      }

      return {
        success: false,
        message: 'Registration failed',
      };
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
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      const token = sessionStorage.getItem('auth_token');
      
      if (token) {
        await this.http.post(
          `${environment.apiUrl}/logout`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        ).toPromise();
      }
      
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
      // Validate token with backend
      const response = await this.http.get<AuthResponse>(
        `${environment.apiUrl}/user`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
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
