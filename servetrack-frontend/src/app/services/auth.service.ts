import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, of, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
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
  inviteCode: string;
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
  /** Success flag */
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    role?: 'volunteer' | 'admin' | 'coordinator';
    profile_photo_url?: string;
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
  public ensureCsrf$(): Observable<void> {
    const backendUrl = environment.apiUrl.replace(/\/api$/, '');
    return this.http.get<void>(`${backendUrl}/sanctum/csrf-cookie`, { withCredentials: true });
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

  /**
   * Get Facebook OAuth redirect URL.
   */
  getFacebookAuthUrl$(): Observable<{ redirect_url: string }> {
    this.error.set(null);

    return this.http
      .get<{ redirect_url: string }>(`${environment.apiUrl}/auth/facebook`, { withCredentials: true })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          const message =
            typeof err.error?.message === 'string'
              ? err.error.message
              : 'Failed to initialize Facebook login.';
          this.error.set(message);
          return throwError(() => err);
        }),
      );
  }

  exchangeFacebookCode$(code: string, state: string): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http
      .get<{ user?: AuthResponse['user']; message?: string }>(
        `${environment.apiUrl}/auth/facebook/callback`,
        {
          params: { code, state },
          withCredentials: true,
        },
      )
      .pipe(
        map((response) => {
          if (response.user) {
            return { success: true, user: response.user } as AuthResponse;
          }

          return {
            success: false,
            message: response.message || 'Facebook authentication failed.',
          } as AuthResponse;
        }),
        tap((response) => {
          if (response.user) {
            this.isAuthenticated.set(true);
            this.currentUser.set(response.user);
            localStorage.setItem('has_session', 'true');
          }
        }),
        catchError((err: HttpErrorResponse) => {
          const message =
            typeof err.error?.message === 'string'
              ? err.error.message
              : 'Facebook authentication failed.';
          this.error.set(message);
          return of({ success: false, message } as AuthResponse);
        }),
        tap(() => this.isLoading.set(false)),
      );
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

    return this.requestLogin$(credentials, endpoint).pipe(
      switchMap((response) => {
        if (response.user) {
          return of({ success: true, user: response.user } as AuthResponse);
        }

        // If stale/previous account is still authenticated, log it out and retry with provided credentials.
        if (response.message === 'Already authenticated.') {
          return this.forceLogoutForRelogin$().pipe(
            switchMap(() => this.requestLogin$(credentials, endpoint)),
            map((retryResponse) => {
              if (retryResponse.user) {
                return { success: true, user: retryResponse.user } as AuthResponse;
              }

              return {
                success: false,
                message: this.normalizeAdminLoginOnlyMessage(
                  retryResponse.message || 'Login failed after resetting previous session.',
                ),
              } as AuthResponse;
            }),
          );
        }

        return of({
          success: false,
          message: this.normalizeAdminLoginOnlyMessage(
            response.message || 'Login failed. Please try again.',
          ),
        } as AuthResponse);
      }),
      tap((response) => {
        if (response.user) {
          this.isAuthenticated.set(true);
          this.currentUser.set(response.user);
          localStorage.setItem('has_session', 'true');
        }
      }),
      catchError((err: HttpErrorResponse) => {
        const message = this.getLoginErrorMessage(err);
        this.error.set(message);
        return of({ success: false, message } as AuthResponse);
      }),
      tap(() => this.isLoading.set(false)),
    );
  }

  private requestLogin$(
    credentials: LoginCredentials,
    endpoint: '/login' | '/admin/login',
  ): Observable<{ message?: string; user?: AuthResponse['user'] }> {
    return this.ensureCsrf$().pipe(
      switchMap(() =>
        this.http.post<{
          message?: string;
          user?: AuthResponse['user'];
        }>(`${environment.apiUrl}${endpoint}`, credentials, { withCredentials: true }),
      ),
    );
  }

  private forceLogoutForRelogin$(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.isAuthenticated.set(false);
        this.currentUser.set(null);
        localStorage.removeItem('has_session');
      }),
      catchError(() => {
        this.isAuthenticated.set(false);
        this.currentUser.set(null);
        localStorage.removeItem('has_session');
        return of(undefined);
      }),
    );
  }

  private getLoginErrorMessage(err: HttpErrorResponse): string {
    const backendMessageRaw = typeof err.error?.message === 'string' ? err.error.message : '';
    const backendMessage = this.normalizeAdminLoginOnlyMessage(backendMessageRaw);
    const retryAfterHeader = err.headers?.get('Retry-After');
    const retryAfterBody = err.error?.retry_after;
    const retryAfterRaw = retryAfterBody ?? retryAfterHeader;
    const retryAfter = Number.isFinite(Number(retryAfterRaw)) ? Number(retryAfterRaw) : null;

    if (err.status === 0) {
      return 'Cannot reach server. Please make sure backend and database are running.';
    }

    if (err.status === 429) {
      if (retryAfter && retryAfter > 0) {
        const minutes = Math.ceil(retryAfter / 60);
        return `Too many attempts. Try again in about ${minutes} minute(s).`;
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
          localStorage.setItem('has_session', 'true');
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
  logout$(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.clearSession()),
      catchError(() => {
        this.clearSession();
        return of(undefined);
      }),
    );
  }

  logout(): Promise<void> {
    const redirectUrl = this.getLogoutRedirectUrl();
    return new Promise((resolve, reject) => {
      this.logout$().subscribe({
        next: () => {
          this.router.navigateByUrl(redirectUrl).catch((error) => {
            console.error('Logout navigation failed:', error);
          });
          resolve();
        },
        error: (error) => reject(error),
      });
    });
  }

  /**
   * Determines the correct redirect URL based on user role after logout.
   */
  private getLogoutRedirectUrl(): string {
    const user = this.currentUser();
    const userRole = (user?.role ?? user?.user_type ?? '').toLowerCase();
    if (userRole === 'admin') {
      return '/admin-auth';
    }
    return '/volunteer-auth';
  }

  /**
   * Check authentication status - Observable version.
   */
  checkAuthStatus$(): Observable<AuthResponse> {
    // Prevent unnecessary API calls (and 401 console errors) for guests
    if (localStorage.getItem('has_session') !== 'true') {
      this.isAuthenticated.set(false);
      this.currentUser.set(null);
      return of({ success: false } as AuthResponse);
    }

    return this.http
      .get<AuthResponse | AuthResponse['user']>(`${environment.apiUrl}/user`, { withCredentials: true })
      .pipe(
        map((response) => {
          // Supports both:
          // 1) { success, user, message } envelope
          // 2) raw user object from /api/user
          const maybeEnvelope = response as AuthResponse;
          if (maybeEnvelope && typeof maybeEnvelope === 'object' && 'user' in maybeEnvelope) {
            return {
              success: true,
              message: maybeEnvelope.message,
              user: maybeEnvelope.user ?? null,
            } as AuthResponse;
          }

          return {
            success: true,
            user: response as AuthResponse['user'],
          } as AuthResponse;
        }),
        tap((response) => {
          if (response.user) {
            this.isAuthenticated.set(true);
            this.currentUser.set(response.user);
            localStorage.setItem('has_session', 'true');
          }
        }),
        catchError(() => {
          this.isAuthenticated.set(false);
          this.currentUser.set(null);
          localStorage.removeItem('has_session');
          return of({ success: false } as AuthResponse);
        }),
      );
  }

  checkAuthStatus(): Promise<boolean> {
    return new Promise((resolve) => {
      this.checkAuthStatus$().subscribe((response) => {
        resolve(response.success);
      });
    });
  }

  private clearSession(): void {
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
    localStorage.removeItem('has_session');

    // Handle navigation errors gracefully
    this.router.navigate(['/login']).catch((error) => {
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
   * Validate volunteer signup data
   */
  validateVolunteerSignup(data: VolunteerSignupData): ValidationError[] {
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
        errors.push({
          field: 'password',
          message:
            'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        });
      }
    }

    // Confirm password validation
    if (!data.confirmPassword?.trim()) {
      errors.push({
        field: 'confirmPassword',
        message: 'Please confirm your password',
      });
    } else if (data.password !== data.confirmPassword) {
      errors.push({
        field: 'confirmPassword',
        message: 'Passwords do not match',
      });
    }

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

    return this.ensureCsrf$().pipe(
      switchMap(() =>
        this.http.post<AuthResponse>(`${environment.apiUrl}/admin/register`, data, { withCredentials: true }),
      ),
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
