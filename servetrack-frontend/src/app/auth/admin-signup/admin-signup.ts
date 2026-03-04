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
import { firstValueFrom } from 'rxjs';
import { AuthService, AdminSignupData, ValidationError } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';
import {
  passwordStrengthValidator,
  passwordMatchValidator,
} from '../../validators/password.validator';
import { emailValidator } from '../../validators/form.validator';

@Component({
  selector: 'app-admin-signup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './admin-signup.html',
  styleUrl: './admin-signup.scss',
})
export class AdminSignup {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sanitizer = inject(InputSanitizerService);

  // State signals
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPasswordRequirements = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  showSuccessModal = signal(false);
  countdown = signal(5);
  validationErrors = signal<ValidationError[]>([]);

  // Form group with validators
  adminForm: FormGroup = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2), 
                   Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), 
                  Validators.maxLength(50)]],
      email: ['', [Validators.required, emailValidator(this.sanitizer)]],
      contactNumber: ['', [Validators.pattern(/^[\+]?[1-9][\d]{0,15}$/)]],
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]],
      agreeToTerms: [false, [Validators.requiredTrue]],
    },
    {
      validators: passwordMatchValidator('password', 'confirmPassword'),
    },
  );

  get firstNameControl(): AbstractControl | null {
    return this.adminForm.get('firstName');
  }

  get lastNameControl(): AbstractControl | null {
    return this.adminForm.get('lastName');
  }

  get emailControl(): AbstractControl | null {
    return this.adminForm.get('email');
  }

  get contactNumberControl(): AbstractControl | null {
    return this.adminForm.get('contactNumber');
  }

  get passwordControl(): AbstractControl | null {
    return this.adminForm.get('password');
  }

  get confirmPasswordControl(): AbstractControl | null {
    return this.adminForm.get('confirmPassword');
  }

  get agreeToTermsControl(): AbstractControl | null {
    return this.adminForm.get('agreeToTerms');
  }

  getErrorMessage(controlName: string): string {
    const control = this.adminForm.get(controlName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    const errors = control.errors;

    if (controlName === 'firstName') {
      if (errors['required']) return 'First name is required';
      if (errors['minlength']) return 'First name must be at least 2 characters';
      if (errors['maxlength']) return 'First name must not exceed 50 characters';
    }

    if (controlName === 'lastName') {
      if (errors['required']) return 'Last name is required';
      if (errors['minlength']) return 'Last name must be at least 2 characters';
      if (errors['maxlength']) return 'Last name must not exceed 50 characters';
    }

    if (controlName === 'email') {
      if (errors['required']) return 'Email is required';
      if (errors['email']) return 'Please enter a valid email address';
    }

    if (controlName === 'contactNumber') {
      if (errors['pattern']) return 'Please enter a valid phone number';
    }

    if (controlName === 'password') {
      if (errors['required']) return 'Password is required';
      if (errors['minLength']) return 'Password must be at least 12 characters';
      if (errors['maxLength']) return 'Password is too long (max 128 characters)';
      if (errors['requiresUppercase']) return 'Password must contain an uppercase letter';
      if (errors['requiresLowercase']) return 'Password must contain a lowercase letter';
      if (errors['requiresNumber']) return 'Password must contain a number';
      if (errors['requiresSpecialChar']) return 'Password must contain a special character';
      if (errors['commonPattern']) return 'Password cannot start with common words';
      if (errors['repeatedChars']) return 'Password cannot have 3+ repeated characters';
    }

    if (controlName === 'confirmPassword') {
      if (errors['required']) return 'Please confirm your password';
      if (errors['passwordMismatch']) return 'Passwords do not match';
    }

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
      { label: 'One special character (!@#$%^&*)', 
        met: /[^A-Za-z0-9]/.test(password) },
      { label: 'No repeated characters (aaa)', 
        met: !/(.)\1{2,}/.test(password) },
    ];
  }

  /**
   * Handle form submission
   */
  async onSubmit(): Promise<void> {
    if (this.isLoading() || this.adminForm.invalid) {
      this.adminForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const formValue = this.adminForm.value;
      const adminData: AdminSignupData = {
        firstName: formValue.firstName.trim(),
        lastName: formValue.lastName.trim(),
        email: formValue.email.trim(),
        contactNumber: formValue.contactNumber,
        password: formValue.password,
        confirmPassword: formValue.confirmPassword,
      };

      const response = await firstValueFrom(
        this.authService.adminRegister$(adminData)
      );

      if (response.success) {
        // Show success modal
        this.showSuccessModal.set(true);
        
        // Start countdown timer
        this.startCountdown();
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
   * Start countdown timer for success modal
   */
  startCountdown(): void {
    const timer = setInterval(() => {
      const current = this.countdown() - 1;
      this.countdown.set(Math.max(0, current));
      
      if (current <= 0) {
        clearInterval(timer);
        // Auto-navigate to login when countdown reaches zero
        this.navigateToLogin();
      }
    }, 1000);
  }

  /**
   * Navigate to login page
   */
  async navigateToLogin(): Promise<void> {
    try {
      await this.router.navigate(['/admin-login']);
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

  /**
   * Get validation error for a field
   */
  getValidationError(fieldName: string): string {
    const errors = this.validationErrors();
    const error = errors.find(err => err.field === fieldName);
    return error?.message || '';
  }

  /**
   * Check if field has validation error
   */
  hasFieldError(fieldName: string): boolean {
    return this.getValidationError(fieldName) !== '';
  }
}
