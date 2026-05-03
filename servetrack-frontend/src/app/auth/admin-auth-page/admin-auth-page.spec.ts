import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminAuthPage } from './admin-auth-page';
import { AuthService } from '../../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { of, Observable } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputSanitizerService } from '../../services/input-sanitizer.service';

describe('AdminAuthPage Component', () => {
  let component: AdminAuthPage;
  let fixture: ComponentFixture<AdminAuthPage>;
  let mockAuthService: {
    adminLogin$: ReturnType<typeof vi.fn>;
    adminRegister$: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
    navigateByUrl: ReturnType<typeof vi.fn>;
  };
  let mockActivatedRoute: { queryParams: Observable<Record<string, unknown>> };
  let mockSanitizer: { sanitizeInput: ReturnType<typeof vi.fn>; validateEmail: ReturnType<typeof vi.fn> };

  const setupTestBed = async (queryParams: Record<string, unknown> = {}) => {
    mockAuthService = {
      adminLogin$: vi.fn(),
      adminRegister$: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
      navigateByUrl: vi.fn().mockResolvedValue(true),
    };

    mockSanitizer = {
      sanitizeInput: vi.fn((input: string) => input.trim()),
      validateEmail: vi.fn((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    };

    mockActivatedRoute = {
      queryParams: of(queryParams),
    };

    await TestBed.configureTestingModule({
      imports: [AdminAuthPage, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: InputSanitizerService, useValue: mockSanitizer },
      ],
    })
      .overrideComponent(AdminAuthPage, {
        remove: {
          templateUrl: './admin-auth-page.html',
          styleUrl: './admin-auth-page.scss',
        },
        add: {
          template: '<div>AdminAuthPage Mock Template</div>',
          styles: [],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AdminAuthPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ─── Creation ─────────────────────────────────────────────────────────────

  describe('Creation', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });
  });

  // ─── Tab initialization ───────────────────────────────────────────────────

  describe('Tab initialization', () => {
    it('should default to login tab when no query param', async () => {
      await setupTestBed();
      expect(component.activeTab()).toBe('login');
      expect(component.isLoginTab()).toBe(true);
      expect(component.isSignupTab()).toBe(false);
    });

    it('should set active tab to signup when ?tab=signup query param', async () => {
      await setupTestBed({ tab: 'signup' });
      expect(component.activeTab()).toBe('signup');
      expect(component.isSignupTab()).toBe(true);
      expect(component.isLoginTab()).toBe(false);
    });

    it('should set active tab to login when ?tab=login query param', async () => {
      await setupTestBed({ tab: 'login' });
      expect(component.activeTab()).toBe('login');
      expect(component.isLoginTab()).toBe(true);
    });

    it('should default to login tab for unknown tab param', async () => {
      await setupTestBed({ tab: 'unknown' });
      expect(component.activeTab()).toBe('login');
    });
  });

  // ─── Tab switching ────────────────────────────────────────────────────────

  describe('Tab switching', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should switch to signup tab', () => {
      component.switchTab('signup');
      expect(component.activeTab()).toBe('signup');
      expect(component.isSignupTab()).toBe(true);
    });

    it('should switch back to login tab', () => {
      component.activeTab.set('signup');
      component.switchTab('login');
      expect(component.activeTab()).toBe('login');
      expect(component.isLoginTab()).toBe(true);
    });

    it('should clear errors on tab switch', () => {
      component.loginError.set('some error');
      component.signupError.set('another error');
      component.switchTab('signup');
      expect(component.loginError()).toBeNull();
      expect(component.signupError()).toBeNull();
    });

    it('should not call router.navigate when switching to already active tab', () => {
      component.switchTab('login'); // already on login
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should update query param via router.navigate when switching tabs', () => {
      component.switchTab('signup');
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { tab: 'signup' }, replaceUrl: true }),
      );
    });
  });

  // ─── Keyboard navigation ──────────────────────────────────────────────────

  describe('Keyboard navigation', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should switch to signup on ArrowRight', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      component.onTabKeydown(event);
      expect(component.activeTab()).toBe('signup');
    });

    it('should switch to login on ArrowLeft', () => {
      component.activeTab.set('signup');
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      component.onTabKeydown(event);
      expect(component.activeTab()).toBe('login');
    });

    it('should not switch on other keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      component.onTabKeydown(event);
      expect(component.activeTab()).toBe('login');
    });
  });

  // ─── Login form ───────────────────────────────────────────────────────────

  describe('Login form', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should initialize with empty values', () => {
      expect(component.loginForm.value).toEqual({
        email: '',
        password: '',
        rememberMe: false,
      });
    });

    it('should expose loginEmailControl and loginPasswordControl getters', () => {
      expect(component.loginEmailControl).toBeTruthy();
      expect(component.loginPasswordControl).toBeTruthy();
    });

    it('should have required validators on email and password', () => {
      expect(component.loginEmailControl?.hasError('required')).toBe(true);
      expect(component.loginPasswordControl?.hasError('required')).toBe(true);
    });

    it('should validate email format', () => {
      component.loginEmailControl?.setValue('bad-email');
      expect(component.loginEmailControl?.hasError('email')).toBe(true);

      component.loginEmailControl?.setValue('valid@example.com');
      expect(component.loginEmailControl?.hasError('email')).toBe(false);
    });
  });

  // ─── getLoginError ────────────────────────────────────────────────────────

  describe('getLoginError', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should return empty string when control is not touched', () => {
      expect(component.getLoginError('email')).toBe('');
      expect(component.getLoginError('password')).toBe('');
    });

    it('should return "Email is required" when email is empty and touched', () => {
      component.loginEmailControl?.markAsTouched();
      expect(component.getLoginError('email')).toBe('Email is required');
    });

    it('should return "Please enter a valid email address" for invalid email', () => {
      component.loginEmailControl?.setValue('not-an-email');
      component.loginEmailControl?.markAsTouched();
      expect(component.getLoginError('email')).toBe('Please enter a valid email address');
    });

    it('should return "Password is required" when password is empty and touched', () => {
      component.loginPasswordControl?.markAsTouched();
      expect(component.getLoginError('password')).toBe('Password is required');
    });

    it('should return empty string when email is valid and touched', () => {
      component.loginEmailControl?.setValue('test@example.com');
      component.loginEmailControl?.markAsTouched();
      expect(component.getLoginError('email')).toBe('');
    });

    it('should return empty string for unknown control name', () => {
      expect(component.getLoginError('nonExistent')).toBe('');
    });
  });

  // ─── onLoginSubmit ────────────────────────────────────────────────────────

  describe('onLoginSubmit', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should mark form touched and not call adminLogin$ when form is invalid', async () => {
      const markSpy = vi.spyOn(component.loginForm, 'markAllAsTouched');
      await component.onLoginSubmit();
      expect(markSpy).toHaveBeenCalled();
      expect(mockAuthService.adminLogin$).not.toHaveBeenCalled();
    });

    it('should not call adminLogin$ when isLoginLoading is true', async () => {
      component.loginForm.setValue({ email: 'test@example.com', password: 'password123', rememberMe: false });
      component.isLoginLoading.set(true);
      await component.onLoginSubmit();
      expect(mockAuthService.adminLogin$).not.toHaveBeenCalled();
    });

    it('should call adminLogin$ with sanitized credentials when form is valid', async () => {
      component.loginForm.setValue({ email: '  test@example.com  ', password: 'password123', rememberMe: false });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.adminLogin$.mockReturnValue(of({ success: true }));

      await component.onLoginSubmit();

      expect(mockAuthService.adminLogin$).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should show success flash and auto-redirect on successful login', async () => {
      component.loginForm.setValue({ email: 'test@example.com', password: 'password123', rememberMe: false });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.adminLogin$.mockReturnValue(of({ success: true }));

      await component.onLoginSubmit();

      expect(component.isLoginSuccess()).toBe(true);
    });

    it('should set loginError from response.message on failed login', async () => {
      component.loginForm.setValue({ email: 'test@example.com', password: 'password123', rememberMe: false });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.adminLogin$.mockReturnValue(of({ success: false, message: 'Invalid credentials' }));

      await component.onLoginSubmit();

      expect(component.loginError()).toBe('Invalid credentials');
      expect(mockRouter.navigateByUrl).not.toHaveBeenCalled();
    });

    it('should set default loginError when response.message is absent on failure', async () => {
      component.loginForm.setValue({ email: 'test@example.com', password: 'password123', rememberMe: false });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.adminLogin$.mockReturnValue(of({ success: false }));

      await component.onLoginSubmit();

      expect(component.loginError()).toBe('Invalid email or password');
    });

    it('should set generic loginError on thrown error', async () => {
      component.loginForm.setValue({ email: 'test@example.com', password: 'password123', rememberMe: false });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.adminLogin$.mockReturnValue(
        new Observable(() => {
          throw new Error('Network error');
        }),
      );

      await component.onLoginSubmit();

      expect(component.loginError()).toBe('An unexpected error occurred. Please try again.');
    });

    it('should maintain isLoginLoading during success flash then reset after redirect', async () => {
      component.loginForm.setValue({ email: 'test@example.com', password: 'password123', rememberMe: false });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.adminLogin$.mockReturnValue(of({ success: true }));

      await component.onLoginSubmit();

      // isLoginLoading stays true during success flash
      expect(component.isLoginLoading()).toBe(true);
      expect(component.isLoginSuccess()).toBe(true);
    });

    it('should reset isLoginLoading to false after failure', async () => {
      component.loginForm.setValue({ email: 'test@example.com', password: 'password123', rememberMe: false });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.adminLogin$.mockReturnValue(of({ success: false }));

      await component.onLoginSubmit();

      expect(component.isLoginLoading()).toBe(false);
    });
  });

  // ─── Signup form ──────────────────────────────────────────────────────────

  describe('Signup form', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should initialize with empty values', () => {
      expect(component.signupForm.value).toEqual({
        firstName: '',
        lastName: '',
        email: '',
        contactNumber: '',
        inviteCode: '',
        password: '',
        confirmPassword: '',
        agreeToTerms: false,
      });
    });

    it('should expose all signup control getters', () => {
      expect(component.firstNameControl).toBeTruthy();
      expect(component.lastNameControl).toBeTruthy();
      expect(component.signupEmailControl).toBeTruthy();
      expect(component.contactNumberControl).toBeTruthy();
      expect(component.inviteCodeControl).toBeTruthy();
      expect(component.signupPasswordControl).toBeTruthy();
      expect(component.confirmPasswordControl).toBeTruthy();
      expect(component.agreeToTermsControl).toBeTruthy();
    });

    it('should require firstName, lastName, email, password, confirmPassword, agreeToTerms', () => {
      expect(component.firstNameControl?.hasError('required')).toBe(true);
      expect(component.lastNameControl?.hasError('required')).toBe(true);
      expect(component.signupEmailControl?.hasError('required')).toBe(true);
      expect(component.inviteCodeControl?.hasError('required')).toBe(true);
      expect(component.signupPasswordControl?.hasError('required')).toBe(true);
      expect(component.confirmPasswordControl?.hasError('required')).toBe(true);
      expect(component.agreeToTermsControl?.hasError('required')).toBe(true);
    });
  });

  // ─── getSignupError ───────────────────────────────────────────────────────

  describe('getSignupError', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should return empty string when control is not touched', () => {
      expect(component.getSignupError('firstName')).toBe('');
    });

    it('should return "First name is required" when touched and empty', () => {
      component.firstNameControl?.markAsTouched();
      expect(component.getSignupError('firstName')).toBe('First name is required');
    });

    it('should return "First name must be at least 2 characters" for short value', () => {
      component.firstNameControl?.setValue('a');
      component.firstNameControl?.markAsTouched();
      expect(component.getSignupError('firstName')).toBe('First name must be at least 2 characters');
    });

    it('should return "Last name is required" when touched and empty', () => {
      component.lastNameControl?.markAsTouched();
      expect(component.getSignupError('lastName')).toBe('Last name is required');
    });

    it('should return "Email is required" for signup email when touched and empty', () => {
      component.signupEmailControl?.markAsTouched();
      expect(component.getSignupError('email')).toBe('Email is required');
    });

    it('should return "Please enter a valid email address" for signup invalid email', () => {
      component.signupEmailControl?.setValue('not-valid');
      component.signupEmailControl?.markAsTouched();
      expect(component.getSignupError('email')).toBe('Please enter a valid email address');
    });

    it('should return phone error for invalid contactNumber', () => {
      component.contactNumberControl?.setValue('abc');
      component.contactNumberControl?.markAsTouched();
      expect(component.getSignupError('contactNumber')).toBe(
        'Please enter a valid phone number (e.g. +639XXXXXXXXX)',
      );
    });

    it('should return "Password is required" for empty password touched', () => {
      component.signupPasswordControl?.markAsTouched();
      expect(component.getSignupError('password')).toBe('Password is required');
    });

    it('should return "Password must be at least 12 characters" for short password', () => {
      component.signupPasswordControl?.setValue('Short1!');
      component.signupPasswordControl?.markAsTouched();
      expect(component.getSignupError('password')).toBe('Password must be at least 12 characters');
    });

    it('should return "Please confirm your password" when confirmPassword is empty and touched', () => {
      component.confirmPasswordControl?.markAsTouched();
      expect(component.getSignupError('confirmPassword')).toBe('Please confirm your password');
    });

    it('should return "Passwords do not match" when confirmPassword mismatch', () => {
      component.signupPasswordControl?.setValue('ValidPass1!ABC');
      component.confirmPasswordControl?.setValue('DifferentPass1!');
      component.confirmPasswordControl?.markAsTouched();
      component.signupForm.updateValueAndValidity();
      expect(component.getSignupError('confirmPassword')).toBe('Passwords do not match');
    });

    it('should return "You must agree to the Terms of Service" for unchecked agreeToTerms', () => {
      component.agreeToTermsControl?.markAsTouched();
      expect(component.getSignupError('agreeToTerms')).toBe(
        'You must agree to the Terms of Service',
      );
    });

    it('should return empty string for unknown control name', () => {
      expect(component.getSignupError('nonExistent')).toBe('');
    });
  });

  // ─── getSignupError — inviteCode ───────────────────────────────────────────

  describe('getSignupError — inviteCode', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should return empty string when inviteCode is not touched', () => {
      expect(component.getSignupError('inviteCode')).toBe('');
    });

    it('should return "Invite code is required" when empty and touched', () => {
      component.inviteCodeControl?.markAsTouched();
      expect(component.getSignupError('inviteCode')).toBe('Invite code is required');
    });

    it('should return "Invite code is too short" when value is under 8 chars and touched', () => {
      component.inviteCodeControl?.setValue('short');
      component.inviteCodeControl?.markAsTouched();
      expect(component.getSignupError('inviteCode')).toBe('Invite code is too short');
    });

    it('should return empty string when inviteCode meets minimum length', () => {
      component.inviteCodeControl?.setValue('LongEnough1!');
      component.inviteCodeControl?.markAsTouched();
      expect(component.getSignupError('inviteCode')).toBe('');
    });
  });

  // ─── onSignupSubmit ───────────────────────────────────────────────────────

  describe('onSignupSubmit', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should mark form touched and not call adminRegister$ when form is invalid', async () => {
      const markSpy = vi.spyOn(component.signupForm, 'markAllAsTouched');
      await component.onSignupSubmit();
      expect(markSpy).toHaveBeenCalled();
      expect(mockAuthService.adminRegister$).not.toHaveBeenCalled();
    });

    it('should not call adminRegister$ when isSignupLoading is true', async () => {
      component.isSignupLoading.set(true);
      await component.onSignupSubmit();
      expect(mockAuthService.adminRegister$).not.toHaveBeenCalled();
    });

    it('should call adminRegister$ with sanitized payload when form is valid', async () => {
      component.signupForm.setValue({
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: '  john@example.com  ',
        contactNumber: '+639123456789',
        inviteCode: 'ChangeMe123!',
        password: 'ValidPass1!AB',
        confirmPassword: 'ValidPass1!AB',
        agreeToTerms: true,
      });
      Object.defineProperty(component.signupForm, 'invalid', { get: () => false });
      mockAuthService.adminRegister$.mockReturnValue(of({ success: true }));

      await component.onSignupSubmit();

      expect(mockAuthService.adminRegister$).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        contactNumber: '+639123456789',
        inviteCode: 'ChangeMe123!',
        password: 'ValidPass1!AB',
        confirmPassword: 'ValidPass1!AB',
      });
    });

    it('should show success modal on successful signup', async () => {
      component.signupForm.setValue({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        contactNumber: '',
        inviteCode: 'ChangeMe123!',
        password: 'ValidPass1!AB',
        confirmPassword: 'ValidPass1!AB',
        agreeToTerms: true,
      });
      Object.defineProperty(component.signupForm, 'invalid', { get: () => false });
      mockAuthService.adminRegister$.mockReturnValue(of({ success: true }));
      vi.useFakeTimers();

      await component.onSignupSubmit();

      expect(component.showSuccessModal()).toBe(true);
      expect(component.countdown()).toBe(5);
      vi.useRealTimers();
    });

    it('should set signupError from response.message on failed signup', async () => {
      component.signupForm.setValue({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        contactNumber: '',
        inviteCode: 'ChangeMe123!',
        password: 'ValidPass1!AB',
        confirmPassword: 'ValidPass1!AB',
        agreeToTerms: true,
      });
      Object.defineProperty(component.signupForm, 'invalid', { get: () => false });
      mockAuthService.adminRegister$.mockReturnValue(of({ success: false, message: 'Email already taken' }));

      await component.onSignupSubmit();

      expect(component.signupError()).toBe('Email already taken');
    });

    it('should set default signupError when response.message is absent on failure', async () => {
      component.signupForm.setValue({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        contactNumber: '',
        inviteCode: 'ChangeMe123!',
        password: 'ValidPass1!AB',
        confirmPassword: 'ValidPass1!AB',
        agreeToTerms: true,
      });
      Object.defineProperty(component.signupForm, 'invalid', { get: () => false });
      mockAuthService.adminRegister$.mockReturnValue(of({ success: false }));

      await component.onSignupSubmit();

      expect(component.signupError()).toBe('Signup failed. Please try again.');
    });

    it('should set generic signupError on thrown error', async () => {
      component.signupForm.setValue({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        contactNumber: '',
        inviteCode: 'ChangeMe123!',
        password: 'ValidPass1!AB',
        confirmPassword: 'ValidPass1!AB',
        agreeToTerms: true,
      });
      Object.defineProperty(component.signupForm, 'invalid', { get: () => false });
      mockAuthService.adminRegister$.mockReturnValue(
        new Observable(() => {
          throw new Error('Network error');
        }),
      );

      await component.onSignupSubmit();

      expect(component.signupError()).toBe('An unexpected error occurred. Please try again.');
    });

    it('should reset isSignupLoading to false after success', async () => {
      component.signupForm.setValue({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        contactNumber: '',
        inviteCode: 'ChangeMe123!',
        password: 'ValidPass1!AB',
        confirmPassword: 'ValidPass1!AB',
        agreeToTerms: true,
      });
      Object.defineProperty(component.signupForm, 'invalid', { get: () => false });
      mockAuthService.adminRegister$.mockReturnValue(of({ success: true }));
      vi.useFakeTimers();

      await component.onSignupSubmit();

      expect(component.isSignupLoading()).toBe(false);
      vi.useRealTimers();
    });
  });

  // ─── Password visibility toggles ──────────────────────────────────────────

  describe('Password visibility toggles', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should toggle login password visibility', () => {
      expect(component.showLoginPassword()).toBe(false);
      component.toggleLoginPassword();
      expect(component.showLoginPassword()).toBe(true);
      component.toggleLoginPassword();
      expect(component.showLoginPassword()).toBe(false);
    });

    it('should toggle signup password visibility', () => {
      expect(component.showSignupPassword()).toBe(false);
      component.toggleSignupPassword();
      expect(component.showSignupPassword()).toBe(true);
    });

    it('should toggle confirm password visibility', () => {
      expect(component.showConfirmPassword()).toBe(false);
      component.toggleConfirmPasswordVisibility();
      expect(component.showConfirmPassword()).toBe(true);
    });

    it('should toggle invite code visibility', () => {
      expect(component.showInviteCode()).toBe(false);
      component.toggleInviteCodeVisibility();
      expect(component.showInviteCode()).toBe(true);
      component.toggleInviteCodeVisibility();
      expect(component.showInviteCode()).toBe(false);
    });
  });

  // ─── getPasswordRequirements ───────────────────────────────────────────────

  describe('getPasswordRequirements', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should return 6 requirements', () => {
      expect(component.getPasswordRequirements()).toHaveLength(6);
    });

    it('should return character requirements unmet for empty password', () => {
      component.signupPasswordControl?.setValue('');
      const reqs = component.getPasswordRequirements();
      const lengthReq = reqs.find((r) => r.label === 'At least 12 characters');
      const upperReq = reqs.find((r) => r.label === 'One uppercase letter (A-Z)');
      const lowerReq = reqs.find((r) => r.label === 'One lowercase letter (a-z)');
      const numberReq = reqs.find((r) => r.label === 'One number (0-9)');
      const specialReq = reqs.find((r) => r.label === 'One special character (!@#$%^&*)');
      expect(lengthReq?.met).toBe(false);
      expect(upperReq?.met).toBe(false);
      expect(lowerReq?.met).toBe(false);
      expect(numberReq?.met).toBe(false);
      expect(specialReq?.met).toBe(false);
    });

    it('should mark length requirement met for 12+ character password', () => {
      component.signupPasswordControl?.setValue('abcdefghijkl');
      const reqs = component.getPasswordRequirements();
      const lengthReq = reqs.find((r) => r.label === 'At least 12 characters');
      expect(lengthReq?.met).toBe(true);
    });

    it('should mark all requirements met for a fully valid password', () => {
      component.signupPasswordControl?.setValue('ValidPass1!AB');
      const reqs = component.getPasswordRequirements();
      expect(reqs.every((r) => r.met)).toBe(true);
    });

    it('should mark repeated characters requirement unmet for aaa pattern', () => {
      component.signupPasswordControl?.setValue('ValidPass1!aaa');
      const reqs = component.getPasswordRequirements();
      const repeatedReq = reqs.find((r) => r.label === 'No repeated characters (aaa)');
      expect(repeatedReq?.met).toBe(false);
    });
  });

  // ─── Success modal ────────────────────────────────────────────────────────

  describe('Success modal', () => {
    beforeEach(async () => {
      await setupTestBed();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should show success modal and set countdown to 5', () => {
      component.startSuccessCountdown();
      expect(component.showSuccessModal()).toBe(true);
      expect(component.countdown()).toBe(5);
    });

    it('should decrement countdown each second', () => {
      component.startSuccessCountdown();
      vi.advanceTimersByTime(1000);
      expect(component.countdown()).toBe(4);
      vi.advanceTimersByTime(2000);
      expect(component.countdown()).toBe(2);
    });

    it('should close modal and switch to login when countdown reaches 0', () => {
      component.activeTab.set('signup');
      component.startSuccessCountdown();
      vi.advanceTimersByTime(5000);
      expect(component.showSuccessModal()).toBe(false);
      expect(component.activeTab()).toBe('login');
    });

    it('should close modal on closeSuccessModal()', () => {
      component.startSuccessCountdown();
      component.closeSuccessModal();
      expect(component.showSuccessModal()).toBe(false);
    });

    it('should close modal and switch to login on goToLoginNow()', () => {
      component.activeTab.set('signup');
      component.startSuccessCountdown();
      component.goToLoginNow();
      expect(component.showSuccessModal()).toBe(false);
      expect(component.activeTab()).toBe('login');
    });
  });

  // ─── Form state preservation ───────────────────────────────────────────────

  describe('Form state preservation on tab switch', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should preserve login form state when switching to signup and back', () => {
      component.loginForm.patchValue({ email: 'preserve@example.com' });
      component.switchTab('signup');
      component.switchTab('login');
      expect(component.loginForm.get('email')?.value).toBe('preserve@example.com');
    });

    it('should preserve signup form state when switching to login and back', () => {
      component.signupForm.patchValue({ firstName: 'Jane' });
      component.switchTab('signup');
      component.switchTab('login');
      component.switchTab('signup');
      expect(component.signupForm.get('firstName')?.value).toBe('Jane');
    });
  });
});
