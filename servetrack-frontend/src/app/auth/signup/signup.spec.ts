const MOCK_PASS_1 = ["A", "1", "b", "2", "C", "3", "d", "4", "!"].join("");
const MOCK_PASS_2 = ["E", "5", "f", "6", "G", "7", "h", "8", "@"].join("");
import { describe, it, expect, beforeEach } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Signup } from './signup';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';
import { ChangeDetectionStrategy, signal } from '@angular/core';

describe('Signup', () => {
  let component: Signup;
  let fixture: ComponentFixture<Signup>;
  let mockRouter: any;
  let mockAuthService: any;

  beforeEach(async () => {
    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true)
    };

    mockAuthService = {
      signup: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [Signup, ReactiveFormsModule],
      providers: [
        { provide: Router, useValue: mockRouter }, { provide: ActivatedRoute, useValue: {} },
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
    .overrideComponent(Signup, {
      set: { changeDetection: ChangeDetectionStrategy.Default }
    })
    .compileComponents();

    fixture = TestBed.createComponent(Signup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Initialization', () => {
    it('should initialize form with default values and validation', () => {
      const form = component.signupForm;
      expect(form.value).toEqual({
        email: '',
        password: '',
        confirmPassword: '',
        agreeToTerms: false
      });
      expect(form.valid).toBeFalsy();
    });

    it('should have required validators on email, password, and confirmPassword fields', () => {
      const form = component.signupForm;

      const emailControl = form.get('email');
      const passwordControl = form.get('password');
      const confirmPasswordControl = form.get('confirmPassword');
      const agreeToTermsControl = form.get('agreeToTerms');

      expect(emailControl?.hasError('required')).toBeTruthy();
      expect(passwordControl?.hasError('required')).toBeTruthy();
      expect(confirmPasswordControl?.hasError('required')).toBeTruthy();
      expect(agreeToTermsControl?.hasError('required')).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should validate email format', () => {
      const emailControl = component.signupForm.get('email')!;

      emailControl.setValue('invalid-email');
      expect(emailControl.hasError('email')).toBeTruthy();

      emailControl.setValue('valid@example.com');
      expect(emailControl.hasError('email')).toBeFalsy();
    });

    it('should validate password strength', () => {
      const passwordControl = component.signupForm.get('password')!;

      passwordControl.setValue('weak');
      expect(passwordControl.hasError('minLength')).toBeTruthy();

      passwordControl.setValue('NoSpecialChar1');
      expect(passwordControl.hasError('requiresSpecialChar')).toBeTruthy();

      passwordControl.setValue(MOCK_PASS_1);
      expect(passwordControl.errors).toBeNull();
    });

    it('should validate password match', () => {
      const form = component.signupForm;
      const passwordControl = form.get('password')!;
      const confirmPasswordControl = form.get('confirmPassword')!;

      passwordControl.setValue(MOCK_PASS_1);
      confirmPasswordControl.setValue(MOCK_PASS_2);

      // Update value and validity for the form or confirm control to trigger the cross-field validator
      form.updateValueAndValidity();

      expect(confirmPasswordControl.hasError('passwordMismatch')).toBeTruthy();

      confirmPasswordControl.setValue(MOCK_PASS_1);
      form.updateValueAndValidity();

      expect(confirmPasswordControl.hasError('passwordMismatch')).toBeFalsy();
    });

    it('should validate agreeToTerms is checked', () => {
      const agreeToTermsControl = component.signupForm.get('agreeToTerms')!;

      agreeToTermsControl.setValue(false);
      expect(agreeToTermsControl.hasError('required')).toBeTruthy();

      agreeToTermsControl.setValue(true);
      expect(agreeToTermsControl.hasError('required')).toBeFalsy();
    });
  });

  describe('Utility Methods', () => {
    describe('getErrorMessage', () => {
      it('should return empty string if control is not touched or has no errors', () => {
        expect(component.getErrorMessage('email')).toBe('');
      });

      it('should return correct error message for email', () => {
        const emailControl = component.signupForm.get('email')!;
        emailControl.markAsTouched();

        emailControl.setValue('');
        expect(component.getErrorMessage('email')).toBe('Email is required');

        emailControl.setValue('invalid');
        expect(component.getErrorMessage('email')).toBe('Please enter a valid email address');
      });

      it('should return correct error message for password', () => {
        const passwordControl = component.signupForm.get('password')!;
        passwordControl.markAsTouched();

        passwordControl.setValue('');
        expect(component.getErrorMessage('password')).toBe('Password is required');

        passwordControl.setValue('short');
        expect(component.getErrorMessage('password')).toBe('Password must be at least 8 characters');

        passwordControl.setValue('NoUppercase1!');
        // Manually set an error for this test
        passwordControl.setErrors({ requiresUppercase: true });
        expect(component.getErrorMessage('password')).toBe('Password must contain an uppercase letter');
      });

      it('should return correct error message for confirmPassword', () => {
        const passwordControl = component.signupForm.get('password')!;
        const confirmPasswordControl = component.signupForm.get('confirmPassword')!;
        confirmPasswordControl.markAsTouched();

        confirmPasswordControl.setValue('');
        expect(component.getErrorMessage('confirmPassword')).toBe('Please confirm your password');

        passwordControl.setValue(MOCK_PASS_1);
        confirmPasswordControl.setValue(MOCK_PASS_2);
        component.signupForm.updateValueAndValidity();
        expect(component.getErrorMessage('confirmPassword')).toBe('Passwords do not match');
      });

      it('should return correct error message for agreeToTerms', () => {
        const agreeToTermsControl = component.signupForm.get('agreeToTerms')!;
        agreeToTermsControl.markAsTouched();

        agreeToTermsControl.setValue(false);
        expect(component.getErrorMessage('agreeToTerms')).toBe('You must agree to the terms');
      });
    });

    describe('getPasswordRequirements', () => {
      it('should correctly identify password requirements', () => {
        const passwordControl = component.signupForm.get('password')!;

        // Initial state
        let reqs = component.getPasswordRequirements();
        expect(reqs.every(r => r.met === false)).toBeTruthy();

        // Partial match
        passwordControl.setValue('A1');
        reqs = component.getPasswordRequirements();
        expect(reqs.find(r => r.label === 'One uppercase letter')?.met).toBeTruthy();
        expect(reqs.find(r => r.label === 'One number')?.met).toBeTruthy();
        expect(reqs.find(r => r.label === 'At least 8 characters')?.met).toBeFalsy();

        // Full match
        passwordControl.setValue('Str0ngP@ss');
        reqs = component.getPasswordRequirements();
        expect(reqs.every(r => r.met === true)).toBeTruthy();
      });
    });

    describe('togglePasswordRequirements', () => {
      it('should toggle showPasswordRequirements signal', () => {
        expect(component.showPasswordRequirements()).toBeFalsy();

        component.togglePasswordRequirements();
        expect(component.showPasswordRequirements()).toBeTruthy();

        component.togglePasswordRequirements();
        expect(component.showPasswordRequirements()).toBeFalsy();
      });
    });
  });

  describe('onSubmit', () => {
    it('should not submit if form is invalid or already loading', async () => {
      // Invalid form
      component.signupForm.patchValue({
        email: 'invalid',
        password: '',
        confirmPassword: '',
        agreeToTerms: false
      });

      await component.onSubmit();

      // All fields should be marked as touched
      expect(component.signupForm.get('email')!.touched).toBeTruthy();
      expect(mockAuthService.signup).not.toHaveBeenCalled();

      // Loading state
      component.isLoading.set(true);

      // Even if form were valid, it shouldn't submit while loading
      // (Mocking valid state isn't strictly necessary since we check isLoading first, but ensures isolation)
      component.signupForm.patchValue({
        email: 'valid@example.com',
        password: MOCK_PASS_1,
        confirmPassword: MOCK_PASS_1,
        agreeToTerms: true
      });
      component.signupForm.updateValueAndValidity();

      await component.onSubmit();
      expect(mockAuthService.signup).not.toHaveBeenCalled();

      // Reset loading state for other tests
      component.isLoading.set(false);
    });

    it('should submit successfully and navigate to home', async () => {
      component.signupForm.patchValue({
        email: 'valid@example.com',
        password: MOCK_PASS_1,
        confirmPassword: MOCK_PASS_1,
        agreeToTerms: true
      });
      component.signupForm.updateValueAndValidity();

      mockAuthService.signup.mockResolvedValue({ success: true, token: 'abc-123-def' });

      await component.onSubmit();

      expect(component.isLoading()).toBeFalsy();
      expect(component.errorMessage()).toBeNull();
      expect(mockAuthService.signup).toHaveBeenCalledWith({
        email: 'valid@example.com',
        password: MOCK_PASS_1,
        confirmPassword: MOCK_PASS_1
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle signup failure and set error message', async () => {
      component.signupForm.patchValue({
        email: 'valid@example.com',
        password: MOCK_PASS_1,
        confirmPassword: MOCK_PASS_1,
        agreeToTerms: true
      });
      component.signupForm.updateValueAndValidity();

      mockAuthService.signup.mockResolvedValue({ success: false, message: 'Email already in use' });

      await component.onSubmit();

      expect(component.isLoading()).toBeFalsy();
      expect(component.errorMessage()).toBe('Email already in use');
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors during submission', async () => {
      component.signupForm.patchValue({
        email: 'valid@example.com',
        password: MOCK_PASS_1,
        confirmPassword: MOCK_PASS_1,
        agreeToTerms: true
      });
      component.signupForm.updateValueAndValidity();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuthService.signup.mockRejectedValue(new Error('Network Error'));

      await component.onSubmit();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(component.isLoading()).toBeFalsy();
      expect(component.errorMessage()).toBe('An unexpected error occurred. Please try again.');
      expect(mockRouter.navigate).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('navigateToLogin', () => {
    it('should navigate to /login', async () => {
      await component.navigateToLogin();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should handle navigation errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRouter.navigate.mockRejectedValueOnce(new Error('Navigation Failed'));

      await component.navigateToLogin();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Navigation failed:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});
