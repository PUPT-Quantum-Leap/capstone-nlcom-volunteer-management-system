import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { InviteService } from '../../services/invite.service';
import {
  passwordStrengthValidator,
  passwordMatchValidator,
} from '../../validators/password.validator';

@Component({
  selector: 'app-signup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup implements OnInit, OnDestroy {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private inviteService = inject(InviteService);

  // State signals
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPasswordRequirements = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  showSuccessModal = signal(false);
  token = signal<string | null>(null);
  inviteEmail = signal<string | null>(null);
  isValidInvite = signal(false);
  private queryParamsSub?: Subscription;

  // Form group with validators
  signupForm: FormGroup = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]],
      agreeToTerms: [false, [Validators.requiredTrue]],
    },
    {
      validators: passwordMatchValidator('password', 'confirmPassword'),
    },
  );

  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.token.set(token);
        this.validateInvite(token);
      }
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSub?.unsubscribe();
  }

  private validateInvite(token: string): void {
    this.inviteService.validateInvite(token).subscribe({
      next: (response) => {
        if (response.success && response.data?.email) {
          this.inviteEmail.set(response.data.email);
          this.isValidInvite.set(true);
          this.signupForm.get('email')?.setValue(response.data.email);
          this.signupForm.get('email')?.disable();
        }
      },
      error: () => {
        this.isValidInvite.set(false);
        this.errorMessage.set('Invalid or expired invite token');
      },
    });
  }

  // Computed getters for form controls
  get emailControl(): AbstractControl | null {
    return this.signupForm.get('email');
  }

  get passwordControl(): AbstractControl | null {
    return this.signupForm.get('password');
  }

  get confirmPasswordControl(): AbstractControl | null {
    return this.signupForm.get('confirmPassword');
  }

  get agreeToTermsControl(): AbstractControl | null {
    return this.signupForm.get('agreeToTerms');
  }

  /**
   * Get error message for a specific form control
   */
  getErrorMessage(controlName: string): string {
    const control = this.signupForm.get(controlName);
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
      if (errors['minLength']) return 'Password must be at least 12 characters';
      if (errors['maxLength']) return 'Password is too long (max 128 characters)';
      if (errors['requiresUppercase']) return 'Password must contain an uppercase letter';
      if (errors['requiresLowercase']) return 'Password must contain a lowercase letter';
      if (errors['requiresNumber']) return 'Password must contain a number';
      if (errors['requiresSpecialChar']) return 'Password must contain a special character';
      if (errors['commonPattern']) return 'Password cannot start with common words like "password"';
      if (errors['repeatedChars']) return 'Password cannot have 3 or more repeated characters';
    }

    // Confirm password errors
    if (controlName === 'confirmPassword') {
      if (errors['required']) return 'Please confirm your password';
      if (errors['passwordMismatch']) return 'Passwords do not match';
    }

    // Terms errors
    if (controlName === 'agreeToTerms') {
      if (errors['required']) return 'You must agree to the terms';
    }

    return '';
  }

  /**
   * Get password strength requirements status
   */
  getPasswordRequirements(): {
    label: string;
    met: boolean;
  }[] {
    const password = this.passwordControl?.value || '';

    return [
      { label: 'At least 12 characters', met: password.length >= 12 },
      { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
      { label: 'One number (0-9)', met: /[0-9]/.test(password) },
      { label: 'One special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
      { label: 'No repeated characters (aaa)', met: !/(.)\1{2,}/.test(password) },
    ];
  }

  /**
   * Handle form submission
   */
  async onSubmit(): Promise<void> {
    // Prevent multiple submissions
    if (this.isLoading() || this.signupForm.invalid) {
      // Mark all fields as touched to show validation errors
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const formValue = this.signupForm.getRawValue();
      const signupData = {
        name: formValue.email.split('@')[0], // Default name from email prefix
        email: formValue.email.trim(),
        password: formValue.password,
        confirmPassword: formValue.confirmPassword,
        token: this.token() || undefined,
      };

      const response = await firstValueFrom(this.authService.coordinatorRegister$(signupData));

      if (response.success) {
        // Show success modal
        this.showSuccessModal.set(true);
        
        setTimeout(() => {
          this.navigateToLogin();
        }, 5000);
      } else {
        this.errorMessage.set(response.message || 'Signup failed. Please try again.');
      }
    } catch (error) {
      this.errorMessage.set('An unexpected error occurred. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Navigate to login page
   */
  async navigateToLogin(): Promise<void> {
    try {
      await this.router.navigate(['/login']);
    } catch (error) {
      // Navigation failed - handle silently
    }
  }

  /**
   * Toggle password requirements visibility
   */
  togglePasswordRequirements(): void {
    this.showPasswordRequirements.update((show) => !show);
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  /**
   * Toggle confirm password visibility
   */
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  /**
   * Show success modal
   */
  showSuccessModalMethod(): void {
    this.showSuccessModal.set(true);
  }

  /**
   * Close success modal
   */
  closeSuccessModal(): void {
    this.showSuccessModal.set(false);
  }

  /**
   * Navigate to login immediately
   */
  navigateToLoginNow(): void {
    this.closeSuccessModal();
    this.navigateToLogin();
  }
}
