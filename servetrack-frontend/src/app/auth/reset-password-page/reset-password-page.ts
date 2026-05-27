import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';
import { passwordStrengthValidator, passwordMatchValidator } from '../../validators/password.validator';

@Component({
  selector: 'app-reset-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sanitizer = inject(InputSanitizerService);

  token = signal('');
  email = signal('');
  isLoading = signal(false);
  isSuccess = signal(false);
  error = signal<string | null>(null);

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  showPasswordRequirements = signal(false);

  private querySub?: Subscription;

  form: FormGroup = this.fb.group(
    {
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator('password', 'confirmPassword') },
  );

  get passwordControl(): AbstractControl | null {
    return this.form.get('password');
  }

  get confirmPasswordControl(): AbstractControl | null {
    return this.form.get('confirmPassword');
  }

  ngOnInit(): void {
    this.querySub = this.route.queryParams.subscribe((params) => {
      this.token.set(params['token'] ?? '');
      this.email.set(params['email'] ?? '');

      if (!this.token() || !this.email()) {
        this.error.set('Invalid reset link. Please request a new password reset.');
      }
    });
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  getPasswordRequirements(): { label: string; met: boolean }[] {
    const password = this.passwordControl?.value ?? '';
    return [
      { label: 'At least 12 characters', met: password.length >= 12 },
      { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
      { label: 'One number (0-9)', met: /[0-9]/.test(password) },
      { label: 'One special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
      { label: 'No repeated characters (aaa)', met: !/(.)\1{2,}/.test(password) },
    ];
  }

  getFieldError(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control?.errors || !control.touched) return '';
    const e = control.errors;

    if (controlName === 'password') {
      if (e['required']) return 'Password is required';
      if (e['minLength']) return 'Password must be at least 12 characters';
      if (e['maxLength']) return 'Password is too long (max 128 characters)';
      if (e['requiresUppercase']) return 'Password must contain an uppercase letter';
      if (e['requiresLowercase']) return 'Password must contain a lowercase letter';
      if (e['requiresNumber']) return 'Password must contain a number';
      if (e['requiresSpecialChar']) return 'Password must contain a special character';
      if (e['commonPattern']) return 'Password cannot start with common words';
      if (e['repeatedChars']) return 'Password cannot have 3+ repeated characters';
    }
    if (controlName === 'confirmPassword') {
      if (e['required']) return 'Please confirm your password';
      if (e['passwordMismatch']) return 'Passwords do not match';
    }
    return '';
  }

  async onSubmit(): Promise<void> {
    if (this.isLoading() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const raw = this.form.value;

      const response = await firstValueFrom(
        this.authService.resetPassword$({
          email: this.email(),
          token: this.token(),
          password: raw.password,
          password_confirmation: raw.confirmPassword,
        }),
      );

      if (response.success) {
        this.isSuccess.set(true);
        setTimeout(() => {
          this.router.navigateByUrl('/admin-auth');
        }, 2000);
      } else {
        this.error.set(response.message || 'Failed to reset password. The link may have expired.');
      }
    } catch {
      this.error.set('An unexpected error occurred. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
