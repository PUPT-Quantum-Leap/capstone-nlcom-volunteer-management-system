import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  // State signals
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  // Popup signal
  showPopup = signal(false);


  // Popup methods
  showPopupModal() {
    this.showPopup.set(true);
  }

  closePopup() {
    this.showPopup.set(false);
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
      // Trim whitespace from inputs
      const formValue = this.loginForm.value;
      const credentials = {
        email: formValue.email.trim(),
        password: formValue.password,
      };

      // Call auth service
      const response = await firstValueFrom(this.authService.login$(credentials));

      if (response.success) {
        // Navigate to volunteer dashboard on success
        await this.router.navigate(['/volunteer-dashboard']);
      } else {
        this.errorMessage.set(response.message || 'Invalid email or password');
      }
    } catch (error) {
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
      // Navigation failed silently
    }
  }

  /**
   * Navigate to forgot password page
   */
  async navigateToForgotPassword(): Promise<void> {
    try {
      await this.router.navigate(['/forgot-password']);
    } catch (error) {
      // Navigation failed silently
    }
  }
}
