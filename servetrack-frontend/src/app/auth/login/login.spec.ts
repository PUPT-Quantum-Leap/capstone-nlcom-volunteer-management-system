

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Login } from './login';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Login Component', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let mockAuthService: { login: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = {
      login: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Login, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
    .overrideComponent(Login, {
      remove: {
        templateUrl: './login.html',
        styleUrl: './login.scss'
      },
      add: {
        template: '<div>Login Component Mock Template</div>',
        styles: []
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty fields', () => {
    expect(component.loginForm.value).toEqual({
      email: '',
      password: '',
      rememberMe: false
    });
  });

  it('should have required validators on email and password', () => {
    const emailControl = component.emailControl;
    const passwordControl = component.passwordControl;

    expect(emailControl?.hasError('required')).toBeTruthy();
    expect(passwordControl?.hasError('required')).toBeTruthy();
  });

  it('should validate email format', () => {
    const emailControl = component.emailControl;

    emailControl?.setValue('invalid-email');
    expect(emailControl?.hasError('email')).toBeTruthy();

    emailControl?.setValue('valid@example.com');
    expect(emailControl?.hasError('email')).toBeFalsy();
  });

  describe('getErrorMessage', () => {
    it('should return empty string if control is not touched', () => {
      expect(component.getErrorMessage('email')).toBe('');
      expect(component.getErrorMessage('password')).toBe('');
    });

    it('should return "Email is required" when email is empty and touched', () => {
      const emailControl = component.emailControl;
      emailControl?.markAsTouched();
      expect(component.getErrorMessage('email')).toBe('Email is required');
    });

    it('should return "Please enter a valid email address" when email format is invalid and touched', () => {
      const emailControl = component.emailControl;
      emailControl?.setValue('invalid');
      emailControl?.markAsTouched();
      expect(component.getErrorMessage('email')).toBe('Please enter a valid email address');
    });

    it('should return "Password is required" when password is empty and touched', () => {
      const passwordControl = component.passwordControl;
      passwordControl?.markAsTouched();
      expect(component.getErrorMessage('password')).toBe('Password is required');
    });

    it('should return empty string when controls are valid and touched', () => {
      const emailControl = component.emailControl;
      emailControl?.setValue('test@example.com');
      emailControl?.markAsTouched();
      expect(component.getErrorMessage('email')).toBe('');

      const passwordControl = component.passwordControl;
      passwordControl?.setValue('password123');
      passwordControl?.markAsTouched();
      expect(component.getErrorMessage('password')).toBe('');
    });

    it('should return empty string for non-existent control', () => {
      expect(component.getErrorMessage('nonExistentControl')).toBe('');
    });
  });

  describe('onSubmit', () => {
    it('should not call authService.login if form is invalid', async () => {
      const markAllAsTouchedSpy = vi.spyOn(component.loginForm, 'markAllAsTouched');
      await component.onSubmit();
      expect(markAllAsTouchedSpy).toHaveBeenCalled();
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should not call authService.login if already loading', async () => {
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      });
      component.isLoading.set(true);
      await component.onSubmit();
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should call authService.login with trimmed credentials when form is valid', async () => {
      component.loginForm.setValue({
        email: '  test@example.com  ',
        password: 'password123',
        rememberMe: false
      });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.login.mockResolvedValue({ success: true });
      await component.onSubmit();
      expect(component.isLoading()).toBe(false);
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should navigate to home on successful login', async () => {
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.login.mockResolvedValue({ success: true });
      await component.onSubmit();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
      expect(component.errorMessage()).toBeNull();
    });

    it('should set errorMessage on failed login', async () => {
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.login.mockResolvedValue({
        success: false,
        message: 'Invalid credentials'
      });
      await component.onSubmit();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBe('Invalid credentials');
    });

    it('should set default errorMessage on failed login without message', async () => {
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      mockAuthService.login.mockResolvedValue({ success: false });
      await component.onSubmit();
      expect(component.errorMessage()).toBe('Invalid email or password');
    });

    it('should catch errors and set generic error message', async () => {
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      });
      Object.defineProperty(component.loginForm, 'invalid', { get: () => false });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuthService.login.mockRejectedValue(new Error('Network error'));
      await component.onSubmit();
      expect(component.errorMessage()).toBe('An unexpected error occurred. Please try again.');
      expect(component.isLoading()).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('Navigation', () => {
    it('should navigate to signup page', async () => {
      await component.navigateToSignup();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/signup']);
    });

    it('should handle navigateToSignup error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRouter.navigate.mockRejectedValue(new Error('Navigation error'));

      await component.navigateToSignup();

      expect(consoleSpy).toHaveBeenCalledWith('Navigation failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should navigate to forgot password page', async () => {
      await component.navigateToForgotPassword();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/forgot-password']);
    });

    it('should handle navigateToForgotPassword error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRouter.navigate.mockRejectedValue(new Error('Navigation error'));

      await component.navigateToForgotPassword();

      expect(consoleSpy).toHaveBeenCalledWith('Navigation failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Popup Methods', () => {
    it('should set showPopup to true on showPopupModal', () => {
      expect(component.showPopup()).toBe(false);
      component.showPopupModal();
      expect(component.showPopup()).toBe(true);
    });

    it('should set showPopup to false on closePopup', () => {
      component.showPopup.set(true);
      expect(component.showPopup()).toBe(true);
      component.closePopup();
      expect(component.showPopup()).toBe(false);
    });
  });
});
