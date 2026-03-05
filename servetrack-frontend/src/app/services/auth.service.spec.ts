import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

describe('AuthService', () => {
  let service: AuthService;
  let routerSpy: any;

  beforeEach(() => {
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy }
      ]
    });
    service = TestBed.inject(AuthService);

    // Clear sessionStorage before each test
    sessionStorage.clear();

    // Use fake timers for simulate API delays
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const credentials = { email: 'test@example.com', password: 'password' };

      const loginPromise = service.login(credentials);

      expect(service.isLoading()).toBe(true);

      // Advance timers to skip the 2000ms delay
      await vi.runAllTimersAsync();

      const response = await loginPromise;

      expect(response.success).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.currentUser()?.email).toBe(credentials.email);
      expect(sessionStorage.getItem('auth_token')).toBe('mock-jwt-token');
      expect(service.isLoading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should fail with invalid email format', async () => {
      const credentials = { email: 'invalid-email', password: 'password' };

      const response = await service.login(credentials);

      expect(response.success).toBe(false);
      expect(response.message).toBe('Invalid email format');
      expect(service.isAuthenticated()).toBe(false);
      expect(service.error()).toBe('Invalid email format');
    });
  });

  describe('signup', () => {
    it('should signup successfully with valid data', async () => {
      const signupData = {
        name: 'John Doe',
        email: 'test@example.com',
        password: 'password',
        confirmPassword: 'password'
      };

      const signupPromise = service.signup(signupData);

      expect(service.isLoading()).toBe(true);

      await vi.runAllTimersAsync();

      const response = await signupPromise;

      expect(response.success).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.currentUser()?.name).toBe('John Doe');
      expect(sessionStorage.getItem('auth_token')).toBe('mock-jwt-token');
    });

    it('should fail if name is too short', async () => {
      const signupData = {
        name: 'J',
        email: 'test@example.com',
        password: 'password',
        confirmPassword: 'password'
      };

      const response = await service.signup(signupData);

      expect(response.success).toBe(false);
      expect(response.message).toBe('Name must be at least 2 characters');
      expect(service.error()).toBe('Name must be at least 2 characters');
    });
  });

  describe('logout', () => {
    it('should clear state and navigate to login', async () => {
      // Setup initial state
      service.isAuthenticated.set(true);
      sessionStorage.setItem('auth_token', 'some-token');

      await service.logout();

      expect(service.isAuthenticated()).toBe(false);
      expect(service.currentUser()).toBeNull();
      expect(sessionStorage.getItem('auth_token')).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('checkAuthStatus', () => {
    it('should return true if token exists', async () => {
      sessionStorage.setItem('auth_token', 'some-token');

      const result = await service.checkAuthStatus();

      expect(result).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false if token does not exist', async () => {
      const result = await service.checkAuthStatus();

      expect(result).toBe(false);
      expect(service.isAuthenticated()).toBe(false);
    });
  });
});
