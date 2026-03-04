import { TestBed } from '@angular/core/testing';
import {
  AuthService,
  LoginCredentials,
  RegisterData,
  VolunteerSignupData,
  ValidationError,
} from './auth.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let mockRouter: any;

  beforeEach(() => {
    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, { provide: Router, useValue: mockRouter }],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Validation Methods', () => {
    describe('validateLogin', () => {
      it('should return no errors for valid credentials', () => {
        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        const errors = service.validateLogin(credentials);
        expect(errors).toHaveLength(0);
      });

      it('should return error for missing email', () => {
        const credentials: LoginCredentials = {
          email: '',
          password: 'password123',
        };

        const errors = service.validateLogin(credentials);
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe('email');
        expect(errors[0].message).toBe('Email is required');
      });

      it('should return error for invalid email format', () => {
        const credentials: LoginCredentials = {
          email: 'invalid-email',
          password: 'password123',
        };

        const errors = service.validateLogin(credentials);
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe('email');
        expect(errors[0].message).toBe('Please enter a valid email address');
      });

      it('should return error for short password', () => {
        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: '123',
        };

        const errors = service.validateLogin(credentials);
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe('password');
        expect(errors[0].message).toBe('Password must be at least 8 characters long');
      });

      it('should return multiple errors for multiple invalid fields', () => {
        const credentials: LoginCredentials = {
          email: '',
          password: '123',
        };

        const errors = service.validateLogin(credentials);
        expect(errors).toHaveLength(2);
        expect(errors.map((e) => e.field)).toEqual(['email', 'password']);
      });
    });

    describe('validateRegistration', () => {
      it('should return no errors for valid registration data', () => {
        const data: RegisterData = {
          email: 'test@example.com',
          password: 'Password123',
          password_confirmation: 'Password123',
        };

        const errors = service.validateRegistration(data);
        expect(errors).toHaveLength(0);
      });

      it('should return error for password mismatch', () => {
        const data: RegisterData = {
          email: 'test@example.com',
          password: 'Password123',
          password_confirmation: 'DifferentPassword',
        };

        const errors = service.validateRegistration(data);
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe('password_confirmation');
        expect(errors[0].message).toBe('Passwords do not match');
      });

      it('should return error for weak password format', () => {
        const data: RegisterData = {
          email: 'test@example.com',
          password: 'weakpassword',
          password_confirmation: 'weakpassword',
        };

        const errors = service.validateRegistration(data);
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe('password');
        expect(errors[0].message).toBe(
          'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        );
      });
    });

    describe('validateVolunteerSignup', () => {
      it('should return no errors for valid volunteer data', () => {
        const data: VolunteerSignupData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
          mobileNumber: '+1234567890',
          birthdate: '1990-01-01',
          completeAddress: '123 Test St, City, Country',
          educationalAttainment: "Bachelor's Degree",
          lastMedicalExam: '2023-01-01',
          volunteerPreference: 'Teaching',
          password: 'Password123',
          confirmPassword: 'Password123',
        };

        const errors = service.validateVolunteerSignup(data);
        expect(errors).toHaveLength(0);
      });

      it('should return errors for missing required fields', () => {
        const data: VolunteerSignupData = {
          firstName: '',
          lastName: '',
          email: 'test@example.com',
          mobileNumber: '+1234567890',
          birthdate: '1990-01-01',
          completeAddress: '123 Test St, City, Country',
          educationalAttainment: "Bachelor's Degree",
          lastMedicalExam: '2023-01-01',
          volunteerPreference: 'Teaching',
          password: 'Password123',
          confirmPassword: 'Password123',
        };

        const errors = service.validateVolunteerSignup(data);
        expect(errors.length).toBeGreaterThan(0);

        const firstNameError = errors.find((e) => e.field === 'firstName');
        expect(firstNameError).toBeDefined();
        expect(firstNameError?.message).toBe('First name is required');

        const lastNameError = errors.find((e) => e.field === 'lastName');
        expect(lastNameError).toBeDefined();
        expect(lastNameError?.message).toBe('Last name is required');
      });

      it('should return error for invalid phone number', () => {
        const data: VolunteerSignupData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
          mobileNumber: 'invalid-phone',
          birthdate: '1990-01-01',
          completeAddress: '123 Test St, City, Country',
          educationalAttainment: "Bachelor's Degree",
          lastMedicalExam: '2023-01-01',
          volunteerPreference: 'Teaching',
          password: 'Password123',
          confirmPassword: 'Password123',
        };

        const errors = service.validateVolunteerSignup(data);
        const phoneError = errors.find((e) => e.field === 'mobileNumber');
        expect(phoneError).toBeDefined();
        expect(phoneError?.message).toBe('Please enter a valid mobile number');
      });

      it('should return error for underage volunteer', () => {
        const recentDate = new Date();
        recentDate.setFullYear(recentDate.getFullYear() - 17); // 17 years old

        const data: VolunteerSignupData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
          mobileNumber: '+1234567890',
          birthdate: recentDate.toISOString().split('T')[0],
          completeAddress: '123 Test St, City, Country',
          educationalAttainment: "Bachelor's Degree",
          lastMedicalExam: '2023-01-01',
          volunteerPreference: 'Teaching',
          password: 'Password123',
          confirmPassword: 'Password123',
        };

        const errors = service.validateVolunteerSignup(data);
        const birthdateError = errors.find((e) => e.field === 'birthdate');
        expect(birthdateError).toBeDefined();
        expect(birthdateError?.message).toBe('You must be at least 18 years old to volunteer');
      });
    });
  });

  describe('Authentication Methods', () => {
    it('should login successfully with valid credentials', () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResponse = {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      service.login$(credentials).subscribe((response) => {
        expect(response.success).toBe(true);
        expect(response.user).toEqual(mockResponse.user);
        expect(service.isAuthenticated()).toBe(true);
        expect(service.currentUser()).toEqual(mockResponse.user);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ user: mockResponse.user });
    });

    it('should handle login error', () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      service.login$(credentials).subscribe((response) => {
        expect(response.success).toBe(false);
        expect(response.message).toBe('Login failed');
        expect(service.isAuthenticated()).toBe(false);
        expect(service.currentUser()).toBeNull();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/login`);
      req.flush('Invalid credentials', { status: 401, statusText: 'Unauthorized' });
    });

    it('should logout successfully', () => {
      // Set user as authenticated first
      service.isAuthenticated.set(true);
      service.currentUser.set({ id: '1', email: 'test@example.com' });

      service.logout$().subscribe(() => {
        expect(service.isAuthenticated()).toBe(false);
        expect(service.currentUser()).toBeNull();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/logout`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush(null);
    });

    it('should check auth status successfully', () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      };

      service.checkAuthStatus$().subscribe((response) => {
        expect(response.success).toBe(true);
        expect(response.user).toEqual(mockUser);
        expect(service.isAuthenticated()).toBe(true);
        expect(service.currentUser()).toEqual(mockUser);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/user`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ user: mockUser });
    });

    it('should handle auth status check failure', () => {
      service.checkAuthStatus$().subscribe((response) => {
        expect(response.success).toBe(false);
        expect(service.isAuthenticated()).toBe(false);
        expect(service.currentUser()).toBeNull();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/user`);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    });
  });
});
