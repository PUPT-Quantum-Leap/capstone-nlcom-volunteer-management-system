import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { NgOptimizedImage, CommonModule } from '@angular/common';
import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';
import {
  passwordStrengthValidator,
  passwordMatchValidator,
} from '../../validators/password.validator';
import {
  phoneNumberValidator,
  nameValidator,
  emailValidator,
} from '../../validators/form.validator';

export type AuthTab = 'login' | 'signup';

@Component({
  selector: 'app-volunteer-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgOptimizedImage, CommonModule],
  templateUrl: './volunteer-auth-page.html',
  styleUrl: './volunteer-auth-page.scss',
})
export class VolunteerAuthPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sanitizer = inject(InputSanitizerService);

  // ─── Tab state ────────────────────────────────────────────────────────────
  activeTab = signal<AuthTab>('login');
  isLoginTab = computed(() => this.activeTab() === 'login');
  isSignupTab = computed(() => this.activeTab() === 'signup');

  // ─── Login State ──────────────────────────────────────────────────────────
  isLoginLoading = signal(false);
  isLoginSuccess = signal(false);
  loginErrorMessage = signal<string | null>(null);
  showLoginPassword = signal(false);
  registrationSuccessMessage = signal<string | null>(null);

  // ─── Signup State ─────────────────────────────────────────────────────────
  isSignupSubmitting = signal(false);
  showSignupPassword = signal(false);
  showConfirmPassword = signal(false);
  showPasswordRequirements = signal(false);
  signupError = signal<string | null>(null);
  showSuccessModal = signal(false);
  showErrorModal = signal(false);
  countdown = signal(5);
  private countdownInterval?: ReturnType<typeof setInterval>;

  private queryParamsSubscription?: Subscription;

  // ─── Login form ───────────────────────────────────────────────────────────
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  // ─── Signup form (minimal — remaining fields collected in /complete-profile)
  signupForm: FormGroup = this.fb.group(
    {
      firstName: ['', [Validators.required, nameValidator(this.sanitizer)]],
      lastName: ['', [Validators.required, nameValidator(this.sanitizer)]],
      email: ['', [Validators.required, emailValidator(this.sanitizer), Validators.maxLength(100)]],
      mobileNumber: ['', [Validators.required, phoneNumberValidator(this.sanitizer)]],
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: passwordMatchValidator('password', 'confirmPassword'),
    },
  );

  constructor() {
    // Disable/enable forms based on loading state
    effect(() => {
      if (this.isLoginLoading()) {
        this.loginForm.disable({ emitEvent: false });
      } else {
        this.loginForm.enable({ emitEvent: false });
      }
    });

    effect(() => {
      if (this.isSignupSubmitting()) {
        this.signupForm.disable({ emitEvent: false });
      } else {
        this.signupForm.enable({ emitEvent: false });
      }
    });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      const tab = params['tab'];
      if (tab === 'signup') {
        this.activeTab.set('signup');
      } else {
        this.activeTab.set('login');
      }

      if (params['registered'] === 'true') {
        this.registrationSuccessMessage.set(
          'Registration successful! Please log in with your new credentials.',
        );
        this.router.navigate([], { queryParams: { registered: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    this.clearCountdown();
  }

  // ─── Tab switching ────────────────────────────────────────────────────────
  switchTab(tab: AuthTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.loginErrorMessage.set(null);
    this.signupError.set(null);
    this.registrationSuccessMessage.set(null);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'signup' ? 'signup' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onTabKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.switchTab('signup');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.switchTab('login');
    }
  }

  // ─── Login Form Getters ───────────────────────────────────────────────────
  get loginEmailControl(): AbstractControl | null {
    return this.loginForm.get('email');
  }

  get loginPasswordControl(): AbstractControl | null {
    return this.loginForm.get('password');
  }

  // ─── Visibility Toggles ───────────────────────────────────────────────────
  toggleLoginPasswordVisibility(): void {
    this.showLoginPassword.update((v) => !v);
  }

  toggleSignupPasswordVisibility(): void {
    this.showSignupPassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  // ─── Password Requirements ────────────────────────────────────────────────
  getPasswordRequirements(): { label: string; met: boolean }[] {
    const password = this.signupForm.get('password')?.value || '';

    return [
      { label: 'At least 12 characters', met: password.length >= 12 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter', met: /[a-z]/.test(password) },
      { label: 'One number', met: /[0-9]/.test(password) },
      { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
      { label: 'No common patterns (password, 123456, etc.)', met: !/^(password|123456|qwerty|admin)/i.test(password) },
      { label: 'No 3+ repeated characters', met: !/(.)\\1{2,}/.test(password) },
    ];
  }

  // ─── Error Messages ───────────────────────────────────────────────────────
  getLoginErrorMessage(controlName: string): string {
    const control = this.loginForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';

    const errors = control.errors;

    if (controlName === 'email') {
      if (errors['required']) return 'Email is required';
      if (errors['email']) return 'Please enter a valid email address';
    }

    if (controlName === 'password') {
      if (errors['required']) return 'Password is required';
    }

    return '';
  }

  getSignupErrorMessage(fieldName: string): string {
    const control = this.signupForm.get(fieldName);
    if (!control || !control.touched || !control.errors) return '';

    const errors = control.errors;

    if (errors['required']) return 'This field is required';
    if (errors['email'] || errors['invalidEmail']) return 'Please enter a valid email address';
    if (errors['invalidPhone']) return 'Please enter a valid Philippine mobile number';
    if (errors['invalidName']) return 'Name contains invalid characters';
    if (errors['maxlength']) return `Maximum ${errors['maxlength'].requiredLength} characters`;

    if (fieldName === 'password') {
      if (errors['minLength']) return 'Password must be at least 8 characters';
      if (errors['requiresUppercase']) return 'Must contain an uppercase letter';
      if (errors['requiresLowercase']) return 'Must contain a lowercase letter';
      if (errors['requiresNumber']) return 'Must contain a number';
      if (errors['requiresSpecialChar']) return 'Must contain a special character';
      if (errors['commonPattern']) return 'Password cannot start with common words like "password" or "123456"';
      if (errors['repeatedChars']) return 'Password cannot contain 3 or more repeated characters';
    }

    if (fieldName === 'confirmPassword') {
      if (errors['passwordMismatch']) return 'Passwords do not match';
    }

    return '';
  }

  // ─── Login Logic ──────────────────────────────────────────────────────────
  async loginWithGoogle(): Promise<void> {
    if (this.isLoginLoading()) return;
    this.isLoginLoading.set(true);
    this.loginErrorMessage.set(null);
    try {
      const { redirect_url, state } = await firstValueFrom(this.authService.getGoogleAuthUrl$());
      sessionStorage.setItem('google_oauth_state', state);
      window.location.href = redirect_url;
    } catch {
      this.loginErrorMessage.set('Failed to initialize Google login. Please try again.');
      this.isLoginLoading.set(false);
    }
  }

  async onLoginSubmit(): Promise<void> {
    if (this.isLoginLoading() || this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoginLoading.set(true);
    this.loginErrorMessage.set(null);

    try {
      const formValue = this.loginForm.value;
      const credentials = {
        email: this.sanitizer.sanitizeInput(formValue.email ?? '', 'text'),
        password: formValue.password ?? '',
        remember: formValue.rememberMe ?? false,
      };

      const response = await firstValueFrom(this.authService.login$(credentials));

      if (response.success) {
        const userType = response.user?.user_type || response.user?.role || 'volunteer';

        if (userType === 'admin') {
          this.loginErrorMessage.set('Admin accounts must use the Admin Portal.');
          await firstValueFrom(this.authService.logout$());
          this.isLoginLoading.set(false);
          return;
        }

        this.isLoginSuccess.set(true);

        setTimeout(async () => {
          try {
            const redirectPath = this.route.snapshot.queryParams['redirect'];
            await this.router.navigateByUrl(redirectPath || '/volunteer-dashboard');
          } catch {
            this.loginErrorMessage.set('Redirect failed. Please try again.');
          } finally {
            this.isLoginLoading.set(false);
          }
        }, 1000);
      } else {
        this.loginErrorMessage.set(response.message || 'Invalid email or password');
        this.isLoginLoading.set(false);
      }
    } catch {
      this.loginErrorMessage.set('An unexpected error occurred. Please try again.');
      this.isLoginLoading.set(false);
    }
  }

  // ─── Signup Logic ─────────────────────────────────────────────────────────
  async onSignupSubmit(): Promise<void> {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }
    if (this.isSignupSubmitting()) return;

    this.isSignupSubmitting.set(true);
    this.signupError.set(null);

    const raw = this.signupForm.value;
    const formData = {
      firstName: this.sanitizer.sanitizeInput(raw.firstName, 'both'),
      lastName: this.sanitizer.sanitizeInput(raw.lastName, 'both'),
      email: this.sanitizer.sanitizeInput(raw.email, 'text'),
      mobileNumber: this.sanitizer.sanitizeInput(raw.mobileNumber, 'text'),
      password: raw.password,
      confirmPassword: raw.confirmPassword,
    };

    try {
      const response = await this.authService.volunteerSignup(formData);

      if (response.success) {
        this.startSuccessCountdown();
      } else {
        this.signupError.set(response.message || 'Registration failed');
        this.showErrorModal.set(true);
      }
    } catch {
      this.signupError.set('Registration failed. Please try again.');
      this.showErrorModal.set(true);
    } finally {
      this.isSignupSubmitting.set(false);
    }
  }

  // ─── Modals & Redirect ────────────────────────────────────────────────────
  closeErrorModal(): void {
    this.showErrorModal.set(false);
  }

  startSuccessCountdown(): void {
    this.countdown.set(5);
    this.showSuccessModal.set(true);
    this.countdownInterval = setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(Math.max(0, next));
      if (next <= 0) {
        this.goToLoginNow();
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
    this.registrationSuccessMessage.set('Registration successful! Please log in with your new credentials.');
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
  }
}
