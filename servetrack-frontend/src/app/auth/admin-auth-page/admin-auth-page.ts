import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService, AdminSignupData } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';
import { passwordStrengthValidator, passwordMatchValidator } from '../../validators/password.validator';
import { emailValidator } from '../../validators/form.validator';

export type AuthTab = 'login' | 'signup';

@Component({
  selector: 'app-admin-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './admin-auth-page.html',
  styleUrl: './admin-auth-page.scss',
})
export class AdminAuthPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sanitizer = inject(InputSanitizerService);

  // ─── Tab state ────────────────────────────────────────────────────────────
  activeTab = signal<AuthTab>('login');

  isLoginTab = computed(() => this.activeTab() === 'login');
  isSignupTab = computed(() => this.activeTab() === 'signup');

  // ─── Shared state ────────────────────────────────────────────────────────
  loginError = signal<string | null>(null);
  signupError = signal<string | null>(null);
  isLoginLoading = signal(false);
  isSignupLoading = signal(false);

  // ─── Password visibility ─────────────────────────────────────────────────
  showLoginPassword = signal(false);
  showSignupPassword = signal(false);
  showConfirmPassword = signal(false);
  showInviteCode = signal(false);
  showPasswordRequirements = signal(false);

  // ─── Signup success modal ─────────────────────────────────────────────────
  showSuccessModal = signal(false);
  countdown = signal(5);
  private countdownInterval?: ReturnType<typeof setInterval>;

  private queryParamsSub?: Subscription;

  // ─── Login form ───────────────────────────────────────────────────────────
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  // ─── Signup form ──────────────────────────────────────────────────────────
  signupForm: FormGroup = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, emailValidator(this.sanitizer)]],
      contactNumber: ['', [Validators.pattern(/^[\+]?[1-9][\d]{0,15}$/)]],
      inviteCode: ['', [Validators.required, Validators.minLength(8)]],
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]],
      agreeToTerms: [false, [Validators.requiredTrue]],
    },
    { validators: passwordMatchValidator('password', 'confirmPassword') },
  );

  // ─── Login form control getters ───────────────────────────────────────────
  get loginEmailControl(): AbstractControl | null {
    return this.loginForm.get('email');
  }

  get loginPasswordControl(): AbstractControl | null {
    return this.loginForm.get('password');
  }

  // ─── Signup form control getters ──────────────────────────────────────────
  get firstNameControl(): AbstractControl | null {
    return this.signupForm.get('firstName');
  }

  get lastNameControl(): AbstractControl | null {
    return this.signupForm.get('lastName');
  }

  get signupEmailControl(): AbstractControl | null {
    return this.signupForm.get('email');
  }

  get contactNumberControl(): AbstractControl | null {
    return this.signupForm.get('contactNumber');
  }

  get inviteCodeControl(): AbstractControl | null {
    return this.signupForm.get('inviteCode');
  }

  get signupPasswordControl(): AbstractControl | null {
    return this.signupForm.get('password');
  }

  get confirmPasswordControl(): AbstractControl | null {
    return this.signupForm.get('confirmPassword');
  }

  get agreeToTermsControl(): AbstractControl | null {
    return this.signupForm.get('agreeToTerms');
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.queryParamsSub = this.route.queryParams.subscribe((params) => {
      const tab = params['tab'];
      if (tab === 'signup') {
        this.activeTab.set('signup');
      } else {
        this.activeTab.set('login');
      }
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSub?.unsubscribe();
    this.clearCountdown();
  }

  // ─── Tab switching ────────────────────────────────────────────────────────
  switchTab(tab: AuthTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.loginError.set(null);
    this.signupError.set(null);
    // Update query param without triggering navigation guard
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      replaceUrl: true,
    });
  }

  /** Keyboard navigation: ArrowLeft/ArrowRight switches tabs per WCAG tablist pattern */
  onTabKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.switchTab('signup');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.switchTab('login');
    }
  }

  // ─── Password visibility toggles ──────────────────────────────────────────
  toggleLoginPassword(): void {
    this.showLoginPassword.update((v) => !v);
  }

  toggleSignupPassword(): void {
    this.showSignupPassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  toggleInviteCodeVisibility(): void {
    this.showInviteCode.update((v) => !v);
  }

  // ─── Password strength requirements ───────────────────────────────────────
  getPasswordRequirements(): { label: string; met: boolean }[] {
    const password = this.signupPasswordControl?.value ?? '';
    return [
      { label: 'At least 12 characters', met: password.length >= 12 },
      { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
      { label: 'One number (0-9)', met: /[0-9]/.test(password) },
      { label: 'One special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
      { label: 'No repeated characters (aaa)', met: !/(.)\1{2,}/.test(password) },
    ];
  }

  // ─── Error messages ───────────────────────────────────────────────────────
  getLoginError(controlName: string): string {
    const control = this.loginForm.get(controlName);
    if (!control?.errors || !control.touched) return '';
    const e = control.errors;
    if (controlName === 'email') {
      if (e['required']) return 'Email is required';
      if (e['email']) return 'Please enter a valid email address';
    }
    if (controlName === 'password') {
      if (e['required']) return 'Password is required';
    }
    return '';
  }

  getSignupError(controlName: string): string {
    const control = this.signupForm.get(controlName);
    if (!control?.errors || !control.touched) return '';
    const e = control.errors;

    if (controlName === 'firstName') {
      if (e['required']) return 'First name is required';
      if (e['minlength']) return 'First name must be at least 2 characters';
      if (e['maxlength']) return 'First name must not exceed 50 characters';
    }
    if (controlName === 'lastName') {
      if (e['required']) return 'Last name is required';
      if (e['minlength']) return 'Last name must be at least 2 characters';
      if (e['maxlength']) return 'Last name must not exceed 50 characters';
    }
    if (controlName === 'email') {
      if (e['required']) return 'Email is required';
      if (e['invalidEmail']) return 'Please enter a valid email address';
    }
    if (controlName === 'contactNumber') {
      if (e['pattern']) return 'Please enter a valid phone number (e.g. +639XXXXXXXXX)';
    }
    if (controlName === 'inviteCode') {
      if (e['required']) return 'Invite code is required';
      if (e['minlength']) return 'Invite code is too short';
    }
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
    if (controlName === 'agreeToTerms') {
      if (e['required']) return 'You must agree to the Terms of Service';
    }
    return '';
  }

  // ─── Form submission ──────────────────────────────────────────────────────
  async onLoginSubmit(): Promise<void> {
    if (this.isLoginLoading() || this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoginLoading.set(true);
    this.loginError.set(null);

    try {
      const raw = this.loginForm.value;
      const credentials = {
        email: this.sanitizer.sanitizeInput(raw.email ?? '', 'text'),
        password: raw.password,
      };

      const response = await firstValueFrom(this.authService.adminLogin$(credentials));

      if (response.success) {
        await this.router.navigateByUrl('/admin-dashboard');
      } else {
        this.loginError.set(response.message || 'Invalid email or password');
      }
    } catch {
      this.loginError.set('An unexpected error occurred. Please try again.');
    } finally {
      this.isLoginLoading.set(false);
    }
  }

  async onSignupSubmit(): Promise<void> {
    if (this.isSignupLoading() || this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isSignupLoading.set(true);
    this.signupError.set(null);

    try {
      const raw = this.signupForm.value;
      const adminData: AdminSignupData = {
        firstName: this.sanitizer.sanitizeInput(raw.firstName ?? '', 'both'),
        lastName: this.sanitizer.sanitizeInput(raw.lastName ?? '', 'both'),
        email: this.sanitizer.sanitizeInput(raw.email ?? '', 'text'),
        contactNumber: this.sanitizer.sanitizeInput(raw.contactNumber ?? '', 'text'),
        inviteCode: raw.inviteCode,
        password: raw.password,
        confirmPassword: raw.confirmPassword,
      };

      const response = await firstValueFrom(this.authService.adminRegister$(adminData));

      if (response.success) {
        this.startSuccessCountdown();
      } else {
        this.signupError.set(response.message || 'Signup failed. Please try again.');
      }
    } catch {
      this.signupError.set('An unexpected error occurred. Please try again.');
    } finally {
      this.isSignupLoading.set(false);
    }
  }

  // ─── Success modal ────────────────────────────────────────────────────────
  startSuccessCountdown(): void {
    this.countdown.set(5);
    this.showSuccessModal.set(true);
    this.countdownInterval = setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(Math.max(0, next));
      if (next <= 0) {
        this.clearCountdown();
        this.switchTab('login');
        this.showSuccessModal.set(false);
      }
    }, 1000);
  }

  closeSuccessModal(): void {
    this.clearCountdown();
    this.showSuccessModal.set(false);
  }

  goToLoginNow(): void {
    this.closeSuccessModal();
    this.switchTab('login');
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
  }
}
