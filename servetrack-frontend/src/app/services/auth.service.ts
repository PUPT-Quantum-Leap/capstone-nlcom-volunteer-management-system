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

export interface ValidationError {
  field: string;
  message: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    volunteer?: {
      volunteer_id: number;
      first_name: string;
      last_name: string;
    };
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
   * Login user with credentials.
   */
  login(credentials: LoginCredentials): Promise<AuthResponse> {
    return new Promise((resolve) => {
      this.login$(credentials).subscribe({
        next: (response) => resolve(response),
        error: () => resolve({ success: false, message: 'Login failed' })
      });
    });
  }

  login$(credentials: LoginCredentials): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    if (!this.isValidEmail(credentials.email)) {
      this.isLoading.set(false);
      return of({ success: false, message: 'Invalid email format' } as AuthResponse);
    }

    return this.http.post<{ user: AuthResponse['user'] }>(
      `${environment.apiUrl}/login`, 
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
   * Observable version of register for RxJS compatibility.
   */
  register$(data: RegisterData): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    if (!this.isValidEmail(data.email)) {
      this.isLoading.set(false);
      return of({ success: false, message: 'Invalid email format' } as AuthResponse);
    }

    return this.http.post<AuthResponse>(`${environment.apiUrl}/register`, data, { withCredentials: true })
      .pipe(
        tap(response => {
          if (response.success && response.user) {
            this.isAuthenticated.set(true);
            this.currentUser.set(response.user);
          }
        }),
        catchError((err: HttpErrorResponse) => {
          const message = err.error?.message || 'Registration failed';
          this.error.set(message);
          return of({ success: false, message } as AuthResponse);
        }),
        tap(() => this.isLoading.set(false)),
      );
  }

  register(data: RegisterData): Promise<AuthResponse> {
    return new Promise((resolve, reject) => {
      this.register$(data).subscribe({
        next: (response) => resolve(response),
        error: (error) => reject(error)
      });
    });
  }

  /**
   * Register new volunteer - Observable version.
   */
  volunteerSignup$(data: VolunteerSignupData): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    if (!this.isValidEmail(data.email)) {
      this.isLoading.set(false);
      return of({ success: false, message: 'Invalid email format' } as AuthResponse);
    }

    return this.http.post<AuthResponse>(
      `${environment.apiUrl}/volunteer/register`,
      data,
      { withCredentials: true }
    ).pipe(
      tap(response => {
        if (response.success && response.user) {
          this.isAuthenticated.set(true);
          this.currentUser.set(response.user);
        }
      }),
      catchError((err: HttpErrorResponse) => {
        const message = err.error?.message || 'Registration failed';
        this.error.set(message);
        return of({ success: false, message } as AuthResponse);
      }),
      tap(() => this.isLoading.set(false)),
    );
  }

  volunteerSignup(data: VolunteerSignupData): Promise<AuthResponse> {
    return new Promise((resolve, reject) => {
      this.volunteerSignup$(data).subscribe({
        next: (response) => resolve(response),
        error: (error) => reject(error)
      });
    });
  }

  /**
   * Logout current user - Observable version.
   */
  logout$(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.clearSession()),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
      );
  }

  logout(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logout$().subscribe({
        next: () => resolve(),
        error: (error) => reject(error)
      });
    });
  }

  /**
   * Check authentication status - Observable version.
   */
  checkAuthStatus$(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${environment.apiUrl}/user`, { withCredentials: true })
      .pipe(
        map(response => ({ success: true, message: response.message, user: response.user })),
        tap(response => {
          if (response.user) {
            this.isAuthenticated.set(true);
            this.currentUser.set(response.user);
          }
        }),
        catchError(() => {
          this.isAuthenticated.set(false);
          this.currentUser.set(null);
          return of({ success: false } as AuthResponse);
        }),
      );
  }

  checkAuthStatus(): Promise<boolean> {
    return new Promise((resolve) => {
      this.checkAuthStatus$().subscribe(response => {
        resolve(response.success);
      });
    });
  }

  private clearSession(): void {
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
    
    // Handle navigation errors gracefully
    this.router.navigate(['/login']).catch(error => {
      console.error('Navigation to login failed:', error);
    });
  }

  /**
   * Validate login credentials
   */
  validateLogin(credentials: LoginCredentials): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!credentials.email?.trim()) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!this.isValidEmail(credentials.email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email address' });
    }
    
    if (!credentials.password?.trim()) {
      errors.push({ field: 'password', message: 'Password is required' });
    } else if (credentials.password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
    }
    
    return errors;
  }

  /**
   * Validate registration data
   */
  validateRegistration(data: RegisterData): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Email validation
    if (!data.email?.trim()) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!this.isValidEmail(data.email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email address' });
    }
    
    // Password validation
    if (!data.password?.trim()) {
      errors.push({ field: 'password', message: 'Password is required' });
    } else {
      if (data.password.length < 8) {
        errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
      }
      if (!this.hasValidPasswordFormat(data.password)) {
        errors.push({ field: 'password', message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
      }
    }
    
    // Confirm password validation
    if (!data.confirmPassword?.trim()) {
      errors.push({ field: 'confirmPassword', message: 'Please confirm your password' });
    } else if (data.password !== data.confirmPassword) {
      errors.push({ field: 'confirmPassword', message: 'Passwords do not match' });
    }
    
    return errors;
  }

  /**
   * Validate volunteer signup data
   */
  validateVolunteerSignup(data: VolunteerSignupData): ValidationError[] {
    const errors = this.validateRegistration({
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword
    });
    
    // Name validation
    if (!data.firstName?.trim()) {
      errors.push({ field: 'firstName', message: 'First name is required' });
    }
    
    if (!data.lastName?.trim()) {
      errors.push({ field: 'lastName', message: 'Last name is required' });
    }
    
    // Mobile number validation
    if (!data.mobileNumber?.trim()) {
      errors.push({ field: 'mobileNumber', message: 'Mobile number is required' });
    } else if (!this.isValidPhoneNumber(data.mobileNumber)) {
      errors.push({ field: 'mobileNumber', message: 'Please enter a valid mobile number' });
    }
    
    // Birthdate validation
    if (!data.birthdate?.trim()) {
      errors.push({ field: 'birthdate', message: 'Birthdate is required' });
    } else if (!this.isValidBirthdate(data.birthdate)) {
      errors.push({ field: 'birthdate', message: 'You must be at least 18 years old to volunteer' });
    }
    
    // Address validation
    if (!data.completeAddress?.trim()) {
      errors.push({ field: 'completeAddress', message: 'Complete address is required' });
    }
    
    // Educational attainment validation
    if (!data.educationalAttainment?.trim()) {
      errors.push({ field: 'educationalAttainment', message: 'Educational attainment is required' });
    }
    
    // Volunteer preference validation
    if (!data.volunteerPreference?.trim()) {
      errors.push({ field: 'volunteerPreference', message: 'Volunteer preference is required' });
    }
    
    return errors;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  }

  private hasValidPasswordFormat(password: string): boolean {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    return hasUpperCase && hasLowerCase && hasNumbers;
  }

  private isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  private isValidBirthdate(birthdate: string): boolean {
    const birthDate = new Date(birthdate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1 >= 18;
    }
    
    return age >= 18;
  }
}