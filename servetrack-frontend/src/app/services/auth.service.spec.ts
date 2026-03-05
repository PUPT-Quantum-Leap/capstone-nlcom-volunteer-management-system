import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let routerMock: any;

  beforeEach(() => {
    routerMock = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: routerMock },
      ],
    });

    service = TestBed.inject(AuthService);

    // Clear sessionStorage and spy on it
    sessionStorage.clear();
    vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'getItem');
    vi.spyOn(Storage.prototype, 'removeItem');

    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not store token in sessionStorage on login', async () => {
    const credentials = { email: 'test@example.com', password: 'password123' };

    await service.login(credentials);

    expect(sessionStorage.setItem).not.toHaveBeenCalledWith('auth_token', expect.any(String));
  });

  it('should not store token in sessionStorage on signup', async () => {
    const signupData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    };

    await service.signup(signupData);

    expect(sessionStorage.setItem).not.toHaveBeenCalledWith('auth_token', expect.any(String));
  });

  it('should not use sessionStorage in checkAuthStatus', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: '1', name: 'Test User', email: 'test@example.com' } }),
    });

    await service.checkAuthStatus();

    expect(sessionStorage.getItem).not.toHaveBeenCalledWith('auth_token');
  });

  it('should call fetch with credentials: include in checkAuthStatus', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: '1', name: 'Test User', email: 'test@example.com' } }),
    });

    await service.checkAuthStatus();

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/user', expect.objectContaining({
      credentials: 'include'
    }));
  });
});
