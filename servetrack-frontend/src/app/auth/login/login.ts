import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sanitizer = inject(InputSanitizerService);

  // State signals
  isLoading = signal(false);
  isSuccess = signal(false);  // Success flash state
  errorMessage = signal<string | null>(null);
  registrationSuccessMessage = signal<string | null>(null);
  showPassword = signal(false);

  // Popup signal
  showPopup = signal(false);
  isAdminLoginPage = signal(false);
  private loginRedirectPath: '/volunteer-dashboard' | '/admin-dashboard' = '/volunteer-dashboard';
  private queryParamsSubscription?: Subscription;

  // Popup methods
  showPopupModal() {
    this.showPopup.set(true);
  }

  closePopup() {
    this.showPopup.set(false);
  }

  // Password visibility methods
  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  ngOnInit(): void {
    this.isAdminLoginPage.set(this.route.snapshot?.routeConfig?.path === 'admin-login');

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      if (params['registered'] === 'true') {
        this.registrationSuccessMessage.set(
          'Registration successful! Please log in with your new credentials.',
        );
        // Clear the query param from the URL without navigation
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
  }

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
      // Trim whitespace and sanitize inputs
      const formValue = this.loginForm.value;
      const credentials = {
        email: this.sanitizer.sanitizeInput(formValue.email ?? '', 'text'),
        password: formValue.password,
      };

      // Call auth service
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
          await firstValueFrom(this.authService.logout$());
          this.isLoading.set(false);
          return;
        }

        // Set redirect path
        this.loginRedirectPath = userType === 'admin' ? '/admin-dashboard' : '/volunteer-dashboard';

        // Show success flash and auto-redirect
        this.isSuccess.set(true);

        // Auto-redirect after short delay
        setTimeout(async () => {
          try {
            await this.router.navigateByUrl(this.loginRedirectPath);
          } catch {
            this.errorMessage.set('Redirect failed. Please try again.');
          } finally {
            this.isLoading.set(false);
          }
        }, 1200);
        return;
      } else {
        this.errorMessage.set(response.message || 'Invalid email or password');
        this.isLoading.set(false);
      }
    } catch (error) {
      this.errorMessage.set('An unexpected error occurred. Please try again.');
      this.isLoading.set(false);
    }
  }

  /**
   * Navigate to signup page
   */
  async navigateToSignup(): Promise<void> {
    try {
      await this.router.navigate(['/signup-form']);
    } catch (error) {
      this.errorMessage.set('Navigation error. Please try again.');
    }
  }

  async navigateToForgotPassword(): Promise<void> {
    try {
      await this.router.navigate(['/forgot-password']);
    } catch (error) {
      this.errorMessage.set('Navigation error. Please try again.');
    }
  }

  /**
   * Login with Facebook
   */
  async loginWithFacebook(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(
        this.authService.getFacebookAuthUrl$(),
      );

      if (response.redirect_url) {
        window.location.assign(response.redirect_url);
      } else {
        this.errorMessage.set('Failed to initialize Facebook login.');
      }
    } catch (error) {
      this.errorMessage.set(this.authService.error() || 'An error occurred. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
