import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { passwordStrengthValidator, passwordMatchValidator } from '../../validators/password.validator';

@Component({
  selector: 'app-signup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  // State signals
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPasswordRequirements = signal(false);

  // Form group with validators
  signupForm: FormGroup = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]],
      agreeToTerms: [false, [Validators.requiredTrue]],
    },
    {
      validators: passwordMatchValidator('password', 'confirmPassword'),
    }
  );

  // Computed getters for form controls
  get nameControl(): AbstractControl | null {
    return this.signupForm.get('name');
  }

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

    // Name errors
    if (controlName === 'name') {
      if (errors['required']) return 'Name is required';
      if (errors['minlength']) return 'Name must be at least 2 characters';
      if (errors['maxlength']) return 'Name is too long';
    }

    // Email errors
    if (controlName === 'email') {
      if (errors['required']) return 'Email is required';
      if (errors['email']) return 'Please enter a valid email address';
    }

    // Password errors
    if (controlName === 'password') {
      if (errors['required']) return 'Password is required';
      if (errors['minLength']) return 'Password must be at least 8 characters';
      if (errors['maxLength']) return 'Password is too long (max 128 characters)';
      if (errors['requiresUppercase']) return 'Password must contain an uppercase letter';
      if (errors['requiresLowercase']) return 'Password must contain a lowercase letter';
      if (errors['requiresNumber']) return 'Password must contain a number';
      if (errors['requiresSpecialChar']) return 'Password must contain a special character';
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
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter', met: /[a-z]/.test(password) },
      { label: 'One number', met: /[0-9]/.test(password) },
      { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
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
      // Trim whitespace from inputs
      const formValue = this.signupForm.value;
      const signupData = {
        name: formValue.name.trim(),
        email: formValue.email.trim(),
        password: formValue.password,
        confirmPassword: formValue.confirmPassword,
      };

      // Call auth service
      const response = await this.authService.signup(signupData);

      if (response.success) {
        // Navigate to dashboard or home on success
        await this.router.navigate(['/']);
      } else {
        this.errorMessage.set(response.message || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
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
      console.error('Navigation failed:', error);
    }
  }

  /**
   * Toggle password requirements visibility
   */
  togglePasswordRequirements(): void {
    this.showPasswordRequirements.update(show => !show);
  }
}
