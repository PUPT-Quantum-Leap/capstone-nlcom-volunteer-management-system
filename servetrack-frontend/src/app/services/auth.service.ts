import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, of, map, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  password_confirmation: string;
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
  availability: string;
  otherAvailability?: string;
  partOfLifegroup: string;
  lifegroupLeaderName?: string;
  leadingLifegroup: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  emergencyContactRelationship: string;
  password: string;
  confirmPassword: string;
}

export interface AdminSignupData {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber?: string;
  password: string;
  confirmPassword: string;
}

export interface CoordinatorSignupData {
  name: string;
  email: string;
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
    role?: 'volunteer' | 'admin' | 'coordinator';
    user_type?: 'volunteer' | 'admin' | 'coordinator';
    volunteer_profile?: {
      volunteer_id: number;
      first_name: string;
      last_name: string;
    };
    admin_profile?: {
      id: number;
      first_name: string;
      last_name: string;
      contact_number?: string;
    };
    coordinator_profile?: {
      id: number;
      name: string;
      email: string;
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
   * Fetch CSRF cookie before making stateful requests
   */
  public ensureCsrf$(): Observable<any> {
    const backendUrl = environment.apiUrl.replace('/api', '');
    return this.http.get(`${backendUrl}/sanctum/csrf-cookie`, { withCredentials: true });
  }

  /**
   * Login user with credentials.
   */
  login(credentials: LoginCredentials): Promise<AuthResponse> {
    return new Promise((resolve) => {
      this.login$(credentials).subscribe({
        next: (response) => resolve(response),
        error: () => resolve({ success: false, message: 'Login failed' }),
      });
    });
  }

  login$(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.loginWithEndpoint$(credentials, '/login');
  }

  /**
   * Login using the admin-only endpoint.
   */
  adminLogin$(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.loginWithEndpoint$(credentials, '/admin/login');
  }

  private loginWithEndpoint$(
    credentials: LoginCredentials,
    endpoint: '/login' | '/admin/login',
  ): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    if (!this.isValidEmail(credentials.email)) {
      this.isLoading.set(false);
      return of({ success: false, message: 'Invalid email format' } as AuthResponse);
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
      return backendMessage || 'Too many login attempts. Please try again later.';
    }

    if (err.status === 401 || err.status === 422) {
      if (backendMessage === 'ERROR') {
        return backendMessage;
      }
      return 'Invalid email or password.';
    }

    if (err.status >= 500) {
      return 'Server error while logging in. Please try again shortly.';
    }

    return backendMessage || 'Login failed. Please try again.';
  }

  private normalizeAdminLoginOnlyMessage(message: string): string {
    const normalizedMessage = message.toLowerCase();
    if (normalizedMessage.includes('admin accounts must') && normalizedMessage.includes('/admin-login')) {
      return 'ERROR';
    }

    return message;
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

    return this.ensureCsrf$().pipe(
      switchMap(() => 
        this.http.post<AuthResponse>(`${environment.apiUrl}/volunteer/register`, data, {
          withCredentials: true,
        })
      ),
      tap((response) => {
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
        error: (error) => reject(error),
      });
    });
  }

  /**
   * Logout current user - Observable version.
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

    return errors;
  }

  /**
   * Validate volunteer signup data
   */
  validateVolunteerSignup(data: VolunteerSignupData): ValidationError[] {
    const errors = this.validateRegistration({
      email: data.email,
      password: data.password,
      password_confirmation: data.confirmPassword,
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
      errors.push({
        field: 'birthdate',
        message: 'You must be at least 18 years old to volunteer',
      });
    }

    // Address validation
    if (!data.completeAddress?.trim()) {
      errors.push({ field: 'completeAddress', message: 'Complete address is required' });
    }

    // Educational attainment validation
    if (!data.educationalAttainment?.trim()) {
      errors.push({
        field: 'educationalAttainment',
        message: 'Educational attainment is required',
      });
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

  /**
   * Register a new coordinator user
   */
  coordinatorRegister(data: CoordinatorSignupData): Promise<AuthResponse> {
    return new Promise((resolve) => {
      this.coordinatorRegister$(data).subscribe({
        next: (response) => resolve(response),
        error: () => resolve({ success: false, message: 'Coordinator registration failed' }),
      });
    });
  }

  coordinatorRegister$(data: CoordinatorSignupData): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    if (!this.isValidEmail(data.email)) {
      this.isLoading.set(false);
      return of({ success: false, message: 'Invalid email format' } as AuthResponse);
    }

    if (data.password !== data.confirmPassword) {
      this.isLoading.set(false);
      return of({ success: false, message: 'Passwords do not match' } as AuthResponse);
    }

    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/coordinator/register`, data, { withCredentials: true })
      .pipe(
        map((response) => response),
        tap((response) => {
          this.isLoading.set(false);
          if (response.success) {
            // Auto-login after successful registration
            this.login({ email: data.email, password: data.password });
          }
        }),
        catchError((error: HttpErrorResponse) => {
          this.isLoading.set(false);
          const errorMessage = error.error?.message || 'Admin registration failed';
          this.error.set(errorMessage);
          return of({ success: false, message: errorMessage } as AuthResponse);
        }),
      );
  }

  /**
   * Validate admin registration data
   */
  validateAdminRegistration(data: AdminSignupData): ValidationError[] {
    const errors: ValidationError[] = [];

    // First name validation
    if (!data.firstName?.trim()) {
      errors.push({ field: 'firstName', message: 'First name is required' });
    } else if (data.firstName.length < 2) {
      errors.push({ field: 'firstName', message: 'First name must be at least 2 characters long' });
    }

    // Last name validation
    if (!data.lastName?.trim()) {
      errors.push({ field: 'lastName', message: 'Last name is required' });
    } else if (data.lastName.length < 2) {
      errors.push({ field: 'lastName', message: 'Last name must be at least 2 characters long' });
    }

    // Email validation
    if (!data.email?.trim()) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!this.isValidEmail(data.email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email address' });
    }

    // Contact number validation (optional)
    if (data.contactNumber?.trim() && !this.isValidPhoneNumber(data.contactNumber)) {
      errors.push({ field: 'contactNumber', message: 'Please enter a valid contact number' });
    }

    // Password validation
    if (!data.password?.trim()) {
      errors.push({ field: 'password', message: 'Password is required' });
    } else if (data.password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
    } else if (!this.hasValidPasswordFormat(data.password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      });
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
   * Register a new admin user
   */
  adminRegister(data: AdminSignupData): Promise<AuthResponse> {
    return new Promise((resolve) => {
      this.adminRegister$(data).subscribe({
        next: (response) => resolve(response),
        error: () => resolve({ success: false, message: 'Admin registration failed' }),
      });
    });
  }

  adminRegister$(data: AdminSignupData): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    if (!this.isValidEmail(data.email)) {
      this.isLoading.set(false);
      return of({ success: false, message: 'Invalid email format' } as AuthResponse);
    }

    if (data.password !== data.confirmPassword) {
      this.isLoading.set(false);
      return of({ success: false, message: 'Passwords do not match' } as AuthResponse);
    }

    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/admin/register`, data, { withCredentials: true })
      .pipe(
        map((response) => response),
        tap((response) => {
          this.isLoading.set(false);
          if (response.success) {
            // Registration successful - user will login manually
            // No auto-login - just show success message
          }
        }),
        catchError((error: HttpErrorResponse) => {
          this.isLoading.set(false);
          const errorMessage = error.error?.message || 'Admin registration failed';
          this.error.set(errorMessage);
          return of({ success: false, message: errorMessage } as AuthResponse);
        }),
      );
  }
}
