<<<<<<< HEAD
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
=======
import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
>>>>>>> origin/main
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
<<<<<<< HEAD
=======
import { firstValueFrom } from 'rxjs';
>>>>>>> origin/main
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
<<<<<<< HEAD
export class Login {
  private router = inject(Router);
=======
export class Login implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
>>>>>>> origin/main
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  // State signals
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
<<<<<<< HEAD
=======
  registrationSuccessMessage = signal<string | null>(null);
  showPassword = signal(false);

  // Popup signal
  showPopup = signal(false);
  showLoginSuccessModal = signal(false);
  loginSuccessMessage = signal<string | null>(null);
  isAdminLoginPage = signal(false);
  private loginRedirectPath: '/volunteer-dashboard' | '/admin-dashboard' = '/volunteer-dashboard';

  // Popup methods
  showPopupModal() {
    this.showPopup.set(true);
  }

  closePopup() {
    this.showPopup.set(false);
  }

  closeLoginSuccessModal(): void {
    this.showLoginSuccessModal.set(false);
  }

  async continueAfterSuccessfulLogin(): Promise<void> {
    this.closeLoginSuccessModal();
    try {
      const navigated = await this.router.navigateByUrl(this.loginRedirectPath);
      if (!navigated) {
        this.errorMessage.set('Login succeeded, but dashboard navigation failed. Please try again.');
      }
    } catch {
      this.errorMessage.set('Login succeeded, but dashboard navigation failed. Please try again.');
    }
  }

  // Password visibility methods
  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  ngOnInit(): void {
    this.isAdminLoginPage.set(this.route.snapshot?.routeConfig?.path === 'admin-login');

    this.route.queryParams.subscribe((params) => {
      if (params['registered'] === 'true') {
        this.registrationSuccessMessage.set(
          'Registration successful! Please log in with your new credentials.',
        );
        // Clear the query param from the URL without navigation
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
  }
>>>>>>> origin/main

  // Form group with validators
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  // Computed getters for form controls
  get emailControl(): AbstractControl | null {
    return this.loginForm.get('email');
  }

  get passwordControl(): AbstractControl | null {
    return this.loginForm.get('password');
  }

  /**
   * Get error message for a specific form control
   */
  getErrorMessage(controlName: string): string {
    const control = this.loginForm.get(controlName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    const errors = control.errors;

    // Email errors
    if (controlName === 'email') {
      if (errors['required']) return 'Email is required';
      if (errors['email']) return 'Please enter a valid email address';
    }

    // Password errors
    if (controlName === 'password') {
      if (errors['required']) return 'Password is required';
    }

    return '';
  }

  /**
   * Handle form submission
   */
  async onSubmit(): Promise<void> {
    // Prevent multiple submissions
    if (this.isLoading() || this.loginForm.invalid) {
      // Mark all fields as touched to show validation errors
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      // Trim whitespace from inputs
      const formValue = this.loginForm.value;
      const credentials = {
        email: formValue.email.trim(),
        password: formValue.password,
      };

      // Call auth service
<<<<<<< HEAD
      const response = await this.authService.login(credentials);

      if (response.success) {
        // Navigate to dashboard or home on success
        await this.router.navigate(['/']);
=======
      const response = await firstValueFrom(
        this.isAdminLoginPage()
          ? this.authService.adminLogin$(credentials)
          : this.authService.login$(credentials),
      );

      if (response.success) {
        // Smart routing based on user type
        const userType = response.user?.user_type || response.user?.role || 'volunteer';

        if (userType === 'admin' && !this.isAdminLoginPage()) {
          this.errorMessage.set('ERROR');
          this.showLoginSuccessModal.set(false);
          await firstValueFrom(this.authService.logout$());
          return;
        }

        if (userType === 'admin') {
          this.loginRedirectPath = '/admin-dashboard';
          this.loginSuccessMessage.set('Login successful. Redirecting to admin dashboard.');
        } else {
          this.loginRedirectPath = '/volunteer-dashboard';
          this.loginSuccessMessage.set('Login successful. Redirecting to volunteer dashboard.');
        }

        this.showLoginSuccessModal.set(true);
>>>>>>> origin/main
      } else {
        this.errorMessage.set(response.message || 'Invalid email or password');
      }
    } catch (error) {
<<<<<<< HEAD
      console.error('Login error:', error);
=======
>>>>>>> origin/main
      this.errorMessage.set('An unexpected error occurred. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Navigate to signup page
   */
  async navigateToSignup(): Promise<void> {
    try {
      await this.router.navigate(['/signup']);
    } catch (error) {
<<<<<<< HEAD
      console.error('Navigation failed:', error);
    }
  }

  /**
   * Navigate to forgot password page
   */
=======
      this.errorMessage.set('Navigation error. Please try again.');
    }
  }

>>>>>>> origin/main
  async navigateToForgotPassword(): Promise<void> {
    try {
      await this.router.navigate(['/forgot-password']);
    } catch (error) {
<<<<<<< HEAD
      console.error('Navigation failed:', error);
=======
      this.errorMessage.set('Navigation error. Please try again.');
>>>>>>> origin/main
    }
  }
}
