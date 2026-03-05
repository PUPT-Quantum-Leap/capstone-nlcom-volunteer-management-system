import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('AuthService Security', () => {
  let service: AuthService;
  let routerSpy: any;

  beforeEach(() => {
    routerSpy = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  it('should NOT log PII during login', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const credentials = { email: 'test@example.com', password: 'password123' };

    await service.login(credentials);

    expect(consoleSpy).toHaveBeenCalledWith('Login successful');

    // Ensure email is not in any call to console.log
    consoleSpy.mock.calls.forEach(call => {
      const logString = JSON.stringify(call);
      expect(logString).not.toContain('test@example.com');
    });
  });

  it('should NOT log PII during signup', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const signupData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    };

    await service.signup(signupData);

    expect(consoleSpy).toHaveBeenCalledWith('Signup successful');

    // Ensure email and name are not in any call to console.log
    consoleSpy.mock.calls.forEach(call => {
      const logString = JSON.stringify(call);
      expect(logString).not.toContain('john@example.com');
      expect(logString).not.toContain('John Doe');
    });
  });
});
