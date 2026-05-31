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
  dateValidator,
  addressValidator,
  emergencyContactValidator,
  customAvailabilityValidator,
  lifegroupLeaderValidator,
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

  // ─── Login State ────────────────────────────────────────────────────────
  isLoginLoading = signal(false);
  isLoginSuccess = signal(false);
  loginErrorMessage = signal<string | null>(null);
  showLoginPassword = signal(false);
  isAdminLoginPage = signal(false);
  registrationSuccessMessage = signal<string | null>(null);
  private loginRedirectPath: '/volunteer-dashboard' | '/admin-dashboard' = '/volunteer-dashboard';

  // ─── Signup State ────────────────────────────────────────────────────────
  currentStep = signal(1);
  isSignupSubmitting = signal(false);
  showOtherInput = signal(false);
  showSignupPassword = signal(false);
  showConfirmPassword = signal(false);
  showPasswordRequirements = signal(false);
  signupError = signal<string | null>(null);
  showSuccessModal = signal(false);
  showErrorModal = signal(false);
  showLifegroupLeaderInput = signal(false);
  showOtherAvailabilityInput = signal(false);
  countdown = signal(5);
  private countdownInterval?: ReturnType<typeof setInterval>;

  private queryParamsSubscription?: Subscription;

  // ─── Login form ───────────────────────────────────────────────────────────
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  // ─── Signup forms ─────────────────────────────────────────────────────────
  personalInfoForm: FormGroup;
  educationForm: FormGroup;
  preferencesForm: FormGroup;

  constructor() {
    this.personalInfoForm = this.fb.group({
      firstName: ['', [Validators.required, nameValidator(this.sanitizer)]],
      lastName: ['', [Validators.required, nameValidator(this.sanitizer)]],
      facebookName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, emailValidator(this.sanitizer), Validators.maxLength(100)]],
      mobileNumber: ['', [Validators.required, phoneNumberValidator(this.sanitizer)]],
      birthdate: ['', [Validators.required, dateValidator(this.sanitizer, 'Birthdate')]],
      lastMedicalExam: ['', [Validators.required, dateValidator(this.sanitizer, 'Medical exam date')]],
      completeAddress: ['', [Validators.required, addressValidator()]],
    });

    this.educationForm = this.fb.group({
      educationalAttainment: ['', [Validators.required, Validators.maxLength(100)]],
      trainingExperience: ['', [Validators.maxLength(1000)]],
      skillsHobbies: ['', [Validators.maxLength(1000)]],
      classesTraining: ['', [Validators.maxLength(1000)]],
    });

    this.preferencesForm = this.fb.group(
      {
        volunteerPreference: ['', [Validators.required]],
        otherPreference: ['', [Validators.maxLength(255)]],
        availability: ['', [Validators.required]],
        otherAvailability: ['', [Validators.maxLength(100)]],
        partOfLifegroup: ['', [Validators.required]],
        lifegroupLeaderName: ['', [Validators.maxLength(100)]],
        leadingLifegroup: ['', [Validators.required]],
        emergencyContactName: ['', [Validators.required, Validators.maxLength(100)]],
        emergencyContactNumber: ['', [Validators.required, emergencyContactValidator(this.sanitizer)]],
        emergencyContactRelationship: ['', [Validators.required, Validators.maxLength(50)]],
        password: ['', [Validators.required, passwordStrengthValidator()]],
        confirmPassword: ['', [Validators.required]],
      },
      {
        validators: passwordMatchValidator('password', 'confirmPassword'),
      },
    );

    this.preferencesForm.get('lifegroupLeaderName')?.setValidators([
      Validators.maxLength(100),
      lifegroupLeaderValidator()
    ]);

    this.preferencesForm.get('otherAvailability')?.setValidators([
      Validators.maxLength(100),
      customAvailabilityValidator()
    ]);

    this.preferencesForm.get('volunteerPreference')?.valueChanges.subscribe((value) => {
      this.showOtherInput.set(value === 'other');
      if (value !== 'other') {
        this.preferencesForm.get('otherPreference')?.setValue('');
      }
    });

    this.preferencesForm.get('availability')?.valueChanges.subscribe((value) => {
      this.showOtherAvailabilityInput.set(value === 'others');
      if (value !== 'others') {
        this.preferencesForm.get('otherAvailability')?.setValue('');
      }
    });

    this.preferencesForm.get('partOfLifegroup')?.valueChanges.subscribe((value) => {
      const lifegroupLeaderControl = this.preferencesForm.get('lifegroupLeaderName');
      this.showLifegroupLeaderInput.set(value === 'yes');
      
      if (value === 'yes') {
        lifegroupLeaderControl?.setValidators([Validators.required]);
      } else {
        lifegroupLeaderControl?.clearValidators();
        lifegroupLeaderControl?.setValue('');
      }
      lifegroupLeaderControl?.updateValueAndValidity();
    });

    // ─── Programmatic form disabled state management ──────────────────────────
    // Listen to isLoginLoading signal and disable/enable login form accordingly
    effect(() => {
      if (this.isLoginLoading()) {
        this.loginForm.disable({ emitEvent: false });
      } else {
        this.loginForm.enable({ emitEvent: false });
      }
    });

    // Listen to isSignupSubmitting signal and disable/enable all signup forms
    effect(() => {
      if (this.isSignupSubmitting()) {
        this.personalInfoForm.disable({ emitEvent: false });
        this.educationForm.disable({ emitEvent: false });
        this.preferencesForm.disable({ emitEvent: false });
      } else {
        this.personalInfoForm.enable({ emitEvent: false });
        this.educationForm.enable({ emitEvent: false });
        this.preferencesForm.enable({ emitEvent: false });
      }
    });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.isAdminLoginPage.set(this.route.snapshot?.routeConfig?.path === 'admin-login');

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

    if (tab === 'login') {
      this.currentStep.set(1);
    }

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
    const password = this.preferencesForm.get('password')?.value || '';

    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter', met: /[a-z]/.test(password) },
      { label: 'One number', met: /[0-9]/.test(password) },
      { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
    ];
  }

  // ─── Error Messages ───────────────────────────────────────────────────────
  getLoginErrorMessage(controlName: string): string {
    const control = this.loginForm.get(controlName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }

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
    const control = this.getCurrentForm().get(fieldName);
    if (!control || !control.touched || !control.errors) {
      return '';
    }

    const errors = control.errors;

    if (errors['required']) return 'This field is required';
    if (errors['email'] || errors['invalidEmail']) return 'Please enter a valid email address';
    if (errors['minlength']) return `Minimum ${errors['minlength'].requiredLength} characters required`;
    if (errors['maxLength']) return `Maximum ${errors['maxLength'].requiredLength} characters exceeded`;
    if (errors['invalidPhone']) return 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567)';
    if (errors['invalidName']) return 'Name contains invalid characters';
    if (errors['futureDate']) return errors['futureDate'];
    if (errors['addressTooShort']) return 'Address is too short';
    
    if (errors['pattern']) {
      if (fieldName === 'mobileNumber' || fieldName === 'emergencyContactNumber') {
        return 'Please enter a valid Philippine mobile number';
      }
      return 'Invalid format';
    }

    if (fieldName === 'password') {
      if (errors['minLength']) return 'Password must be at least 8 characters';
      if (errors['maxLength']) return 'Password is too long (max 128 characters)';
      if (errors['requiresUppercase']) return 'Password must contain an uppercase letter';
      if (errors['requiresLowercase']) return 'Password must contain a lowercase letter';
      if (errors['requiresNumber']) return 'Password must contain a number';
      if (errors['requiresSpecialChar']) return 'Password must contain a special character';
    }

    if (fieldName === 'confirmPassword') {
      if (errors['passwordMismatch']) return 'Passwords do not match';
    }

    return '';
  }

  // ─── Login Logic ──────────────────────────────────────────────────────────
  async loginWithGoogle(): Promise<void> {
    try {
      const { redirect_url } = await firstValueFrom(this.authService.getGoogleAuthUrl$());
      window.location.href = redirect_url;
    } catch {
      this.loginErrorMessage.set('Failed to initialize Google login. Please try again.');
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
        password: formValue.password,
        remember: formValue.rememberMe ?? false,
      };

      const response = await firstValueFrom(
        this.isAdminLoginPage()
          ? this.authService.adminLogin$(credentials)
          : this.authService.login$(credentials),
      );

      if (response.success) {
        const userType = response.user?.user_type || response.user?.role || 'volunteer';

        if (userType === 'admin' && !this.isAdminLoginPage()) {
          this.loginErrorMessage.set('ERROR: Admins must login via /admin-auth');
          await firstValueFrom(this.authService.logout$());
          this.isLoginLoading.set(false);
          return;
        }

        this.loginRedirectPath = userType === 'admin' ? '/admin-dashboard' : '/volunteer-dashboard';
        this.isLoginSuccess.set(true);

        setTimeout(async () => {
          try {
            // Check if there's a redirect parameter from RSVP page
            const redirectPath = this.route.snapshot.queryParams['redirect'];
            const finalRedirect = redirectPath || this.loginRedirectPath;
            await this.router.navigateByUrl(finalRedirect);
          } catch {
            this.loginErrorMessage.set('Redirect failed. Please try again.');
          } finally {
            this.isLoginLoading.set(false);
          }
        }, 1200);
        return;
      } else {
        this.loginErrorMessage.set(response.message || 'Invalid email or password');
        this.isLoginLoading.set(false);
      }
    } catch (error) {
      this.loginErrorMessage.set('An unexpected error occurred. Please try again.');
      this.isLoginLoading.set(false);
    }
  }

  // ─── Signup Logic ─────────────────────────────────────────────────────────
  getCurrentForm(): FormGroup {
    if (this.currentStep() === 1) return this.personalInfoForm;
    if (this.currentStep() === 2) return this.educationForm;
    return this.preferencesForm;
  }

  onNextStep(): void {
    const currentForm = this.getCurrentForm();

    if (currentForm.valid) {
      if (this.currentStep() < 3) {
        this.currentStep.set(this.currentStep() + 1);
      } else {
        this.onSignupSubmit();
      }
    } else {
      this.markFormGroupTouched(currentForm);
    }
  }

  onPrevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  onSignupSubmit(): void {
    if (this.personalInfoForm.valid && this.educationForm.valid && this.preferencesForm.valid) {
      this.isSignupSubmitting.set(true);
      
      const formData = this.sanitizeAndValidateFormData();
      
      if (!formData) {
        this.isSignupSubmitting.set(false);
        return;
      }

      this.authService
        .volunteerSignup(formData)
        .then((response: { success: boolean; message?: string }) => {
          if (response.success) {
            this.startSuccessCountdown();
          } else {
            this.signupError.set(response.message || 'Registration failed');
            this.showErrorModal.set(true);
          }
        })
        .catch((error: any) => {
          this.signupError.set('Registration failed. Please try again.');
          this.showErrorModal.set(true);
        })
        .finally(() => {
          this.isSignupSubmitting.set(false);
        });
    }
  }

  private sanitizeAndValidateFormData(): any | null {
    const rawData = {
      ...this.personalInfoForm.value,
      ...this.educationForm.value,
      ...this.preferencesForm.value,
    };

    const sanitized = {
      firstName: this.sanitizer.sanitizeInput(rawData.firstName, 'both'),
      lastName: this.sanitizer.sanitizeInput(rawData.lastName, 'both'),
      facebookName: this.sanitizer.sanitizeInput(rawData.facebookName, 'both'),
      email: this.sanitizer.sanitizeInput(rawData.email, 'text'),
      mobileNumber: this.sanitizer.sanitizeInput(rawData.mobileNumber, 'text'),
      birthdate: rawData.birthdate,
      lastMedicalExam: rawData.lastMedicalExam,
      completeAddress: this.sanitizer.sanitizeInput(rawData.completeAddress, 'both'),
      educationalAttainment: this.sanitizer.sanitizeInput(rawData.educationalAttainment, 'both'),
      trainingExperience: this.sanitizer.sanitizeInput(rawData.trainingExperience, 'both'),
      skillsHobbies: this.sanitizer.sanitizeInput(rawData.skillsHobbies, 'both'),
      classesTraining: this.sanitizer.sanitizeInput(rawData.classesTraining, 'both'),
      volunteerPreference: rawData.volunteerPreference,
      otherPreference: this.sanitizer.sanitizeInput(rawData.otherPreference, 'both'),
      availability: rawData.availability,
      otherAvailability: this.sanitizer.sanitizeInput(rawData.otherAvailability, 'both'),
      partOfLifegroup: rawData.partOfLifegroup,
      lifegroupLeaderName: this.sanitizer.sanitizeInput(rawData.lifegroupLeaderName, 'both'),
      leadingLifegroup: rawData.leadingLifegroup,
      emergencyContactName: this.sanitizer.sanitizeInput(rawData.emergencyContactName, 'both'),
      emergencyContactNumber: this.sanitizer.sanitizeInput(rawData.emergencyContactNumber, 'text'),
      emergencyContactRelationship: this.sanitizer.sanitizeInput(rawData.emergencyContactRelationship, 'both'),
      password: rawData.password,
      confirmPassword: rawData.confirmPassword,
    };

    const errors: string[] = [];

    if (!this.sanitizer.validateEmail(sanitized.email)) errors.push('Invalid email format');
    if (!this.sanitizer.validatePhoneNumber(sanitized.mobileNumber)) errors.push('Invalid mobile number format');
    if (!this.sanitizer.validatePhoneNumber(sanitized.emergencyContactNumber)) errors.push('Invalid emergency contact number format');
    if (this.sanitizer.isFutureDate(sanitized.birthdate)) errors.push('Birthdate cannot be in the future');
    if (this.sanitizer.isFutureDate(sanitized.lastMedicalExam)) errors.push('Medical exam date cannot be in the future');
    if (!this.sanitizer.validateName(sanitized.firstName)) errors.push('Invalid first name');
    if (!this.sanitizer.validateName(sanitized.lastName)) errors.push('Invalid last name');

    const passwordValidation = this.sanitizer.validatePasswordStrength(sanitized.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }

    if (sanitized.partOfLifegroup === 'yes' && !sanitized.lifegroupLeaderName) {
      errors.push('Lifegroup leader name is required when part of a lifegroup');
    }

    if (sanitized.availability === 'others' && !sanitized.otherAvailability) {
      errors.push('Custom availability description is required');
    }

    if (errors.length > 0) {
      this.signupError.set(errors.join('; '));
      this.showErrorModal.set(true);
      return null;
    }

    return sanitized;
  }

  closeErrorModal(): void {
    this.showErrorModal.set(false);
  }

  // ─── Success Modal & Redirect ─────────────────────────────────────────────
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
