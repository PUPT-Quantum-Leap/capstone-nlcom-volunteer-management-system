import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';

@Component({
  selector: 'app-forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sanitizer = inject(InputSanitizerService);
  private route = inject(ActivatedRoute);

  isLoading = signal(false);
  isSuccess = signal(false);
  error = signal<string | null>(null);
  role = signal<'admin' | 'volunteer'>('admin');

  signInLink = signal('/admin-auth');

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    const role = this.route.snapshot.data['role'];
    if (role === 'volunteer') {
      this.role.set('volunteer');
      this.signInLink.set('/volunteer-auth');
    }
  }

  get emailControl(): AbstractControl | null {
    return this.form.get('email');
  }

  getFieldError(): string {
    const control = this.emailControl;
    if (!control?.errors || !control.touched) return '';
    const e = control.errors;
    if (e['required']) return 'Email is required';
    if (e['email']) return 'Please enter a valid email address';
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
      const email = this.sanitizer.sanitizeInput(raw.email ?? '', 'text');

      const forgotPasswordFn = this.role() === 'volunteer'
        ? this.authService.volunteerForgotPassword$(email)
        : this.authService.forgotPassword$(email);

      const response = await firstValueFrom(forgotPasswordFn);

      if (response.success) {
        this.isSuccess.set(true);
      } else {
        this.error.set(response.message || 'Something went wrong. Please try again.');
      }
    } catch {
      this.error.set('An unexpected error occurred. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
