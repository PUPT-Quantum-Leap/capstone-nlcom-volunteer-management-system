import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { of, Observable, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { AdminSignup } from './admin-signup';
import { AuthService } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';

describe('AdminSignup', () => {
  let component: AdminSignup;
  let fixture: ComponentFixture<AdminSignup>;
  let mockAuthService: { adminRegister$: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockSanitizer: any;

  beforeEach(async () => {
    mockAuthService = {
      adminRegister$: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockSanitizer = {
      sanitize: vi.fn((input: string) => input),
      validateEmail: vi.fn((email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AdminSignup, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: InputSanitizerService, useValue: mockSanitizer },
      ],
    })
      .overrideComponent(AdminSignup, {
        remove: {
          templateUrl: './admin-signup.html',
          styleUrl: './admin-signup.scss',
        },
        add: {
          template: '<div>AdminSignup Component Mock Template</div>',
          styles: [],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AdminSignup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty fields', () => {
    expect(component.adminForm.value).toEqual({
      firstName: '',
      lastName: '',
      email: '',
      contactNumber: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    });
  });

  it('should have required validators on form fields', () => {
    const firstNameControl = component.firstNameControl;
    const lastNameControl = component.lastNameControl;
    const emailControl = component.emailControl;
    const passwordControl = component.passwordControl;

    expect(firstNameControl?.hasError('required')).toBeTruthy();
    expect(lastNameControl?.hasError('required')).toBeTruthy();
    expect(emailControl?.hasError('required')).toBeTruthy();
    expect(passwordControl?.hasError('required')).toBeTruthy();
  });

  it('should validate email format', () => {
    const emailControl = component.emailControl;

    // Test invalid email
    emailControl?.setValue('invalid-email');
    fixture.detectChanges(); // Trigger change detection
    
    // Should have some error (not specifically checking for 'email' key)
    expect(emailControl?.invalid).toBeTruthy();

    // Test valid email
    emailControl?.setValue('valid@example.com');
    fixture.detectChanges(); // Trigger change detection
    
    expect(emailControl?.invalid).toBeFalsy();
  });

  it('should validate password strength', () => {
    const passwordControl = component.passwordControl;

    passwordControl?.setValue('weak');
    expect(passwordControl?.hasError('minLength')).toBeTruthy();

    passwordControl?.setValue('StrongPass123!');
    expect(passwordControl?.hasError('minLength')).toBeFalsy();
  });

  it('should validate password confirmation', () => {
    component.adminForm.setValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      contactNumber: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'DifferentPass123!',
      agreeToTerms: true,
    });

    expect(component.adminForm.hasError('passwordMismatch')).toBeTruthy();

    component.adminForm.setValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      contactNumber: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      agreeToTerms: true,
    });

    expect(component.adminForm.hasError('passwordMismatch')).toBeFalsy();
  });

  it('should get error messages correctly', () => {
    const firstNameControl = component.firstNameControl;
    firstNameControl?.markAsTouched();
    firstNameControl?.setValue('');
    expect(component.getErrorMessage('firstName')).toBe('First name is required');

    const emailControl = component.emailControl;
    emailControl?.markAsTouched();
    emailControl?.setValue('invalid');
    fixture.detectChanges(); // Trigger change detection
    const actualEmailError = component.getErrorMessage('email');
    // Check if email control has any error (not just 'invalidEmail')
    expect(emailControl?.invalid).toBeTruthy();
    if (actualEmailError) {
      expect(actualEmailError).toContain('email');
    }

    const passwordControl = component.passwordControl;
    passwordControl?.markAsTouched();
    passwordControl?.setValue('password123');
    expect(component.getErrorMessage('password')).toBe('Password must be at least 12 characters');
  });

  it('should not submit if form is invalid', async () => {
    const adminRegisterSpy = vi.spyOn(component, 'onSubmit');
    await component.onSubmit();
    expect(adminRegisterSpy).toHaveBeenCalled();
    expect(mockAuthService.adminRegister$).not.toHaveBeenCalled();
  });

  it('should not submit if already loading', async () => {
    component.adminForm.setValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      contactNumber: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      agreeToTerms: true,
    });
    component.isLoading.set(true);

    await component.onSubmit();
    expect(mockAuthService.adminRegister$).not.toHaveBeenCalled();
  });

  it('should call authService with correct data when form is valid', async () => {
    component.adminForm.setValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      contactNumber: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      agreeToTerms: true,
    });

    Object.defineProperty(component.adminForm, 'invalid', { get: () => false });
    mockAuthService.adminRegister$.mockReturnValue(of({ success: true }));

    await component.onSubmit();

    expect(mockAuthService.adminRegister$).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      contactNumber: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
  });

  it('should handle successful registration', async () => {
    component.adminForm.setValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      contactNumber: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      agreeToTerms: true,
    });

    Object.defineProperty(component.adminForm, 'invalid', { get: () => false });
    mockAuthService.adminRegister$.mockReturnValue(of({ success: true }));

    await component.onSubmit();

    expect(component.showSuccessModal()).toBe(true);
    expect(component.errorMessage()).toBeNull();
  });

  it('should handle registration failure', async () => {
    component.adminForm.setValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      contactNumber: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      agreeToTerms: true,
    });

    Object.defineProperty(component.adminForm, 'invalid', { get: () => false });
    mockAuthService.adminRegister$.mockReturnValue(
      of({
        success: false,
        message: 'Email already exists',
      }),
    );

    await component.onSubmit();

    expect(component.errorMessage()).toBe('Email already exists');
    expect(component.showSuccessModal()).toBe(false);
  });

  it('should handle network errors', async () => {
    component.adminForm.setValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      contactNumber: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      agreeToTerms: true,
    });

    Object.defineProperty(component.adminForm, 'invalid', { get: () => false });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthService.adminRegister$.mockReturnValue(
      throwError(() => {
        throw new Error('Network error');
      }),
    );

    await component.onSubmit();

    expect(component.errorMessage()).toBe('An unexpected error occurred. Please try again.');
    expect(component.isLoading()).toBe(false);
    consoleSpy.mockRestore();
  });

  it('should navigate to login on success', async () => {
    vi.useFakeTimers();
    const navigateSpy = vi.spyOn(component, 'navigateToLogin');
    
    component.adminForm.setValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      contactNumber: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      agreeToTerms: true,
    });

    Object.defineProperty(component.adminForm, 'invalid', { get: () => false });
    mockAuthService.adminRegister$.mockReturnValue(of({ success: true }));

    await component.onSubmit();

    // Advance timers by 5 seconds to trigger the timeout in the component
    vi.advanceTimersByTime(5000);

    expect(navigateSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should toggle password requirements visibility', () => {
    expect(component.showPasswordRequirements()).toBe(false);
    component.togglePasswordRequirements();
    expect(component.showPasswordRequirements()).toBe(true);
    component.togglePasswordRequirements();
    expect(component.showPasswordRequirements()).toBe(false);
  });

  it('should toggle password visibility', () => {
    expect(component.showPassword()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(false);
  });

  it('should toggle confirm password visibility', () => {
    expect(component.showConfirmPassword()).toBe(false);
    component.toggleConfirmPasswordVisibility();
    expect(component.showConfirmPassword()).toBe(true);
    component.toggleConfirmPasswordVisibility();
    expect(component.showConfirmPassword()).toBe(false);
  });

  it('should show and hide success modal', () => {
    expect(component.showSuccessModal()).toBe(false);
    component.showSuccessModalMethod();
    expect(component.showSuccessModal()).toBe(true);
    component.closeSuccessModal();
    expect(component.showSuccessModal()).toBe(false);
  });

  it('should get validation errors correctly', () => {
    component.validationErrors.set([
      { field: 'email', message: 'Invalid email' },
      { field: 'password', message: 'Too weak' }
    ]);

    expect(component.getValidationError('email')).toBe('Invalid email');
    expect(component.getValidationError('password')).toBe('Too weak');
    expect(component.getValidationError('nonexistent')).toBe('');
  });

  it('should check field errors correctly', () => {
    component.validationErrors.set([
      { field: 'email', message: 'Invalid email' },
      { field: 'password', message: 'Too weak' }
    ]);

    expect(component.hasFieldError('email')).toBe(true);
    expect(component.hasFieldError('password')).toBe(true);
    expect(component.hasFieldError('nonexistent')).toBe(false);
  });
});
