import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { GoogleCallbackComponent } from './google-callback';
import { AuthService } from '../../services/auth.service';

describe('GoogleCallbackComponent', () => {
  const mockRouter = { navigate: vi.fn() };
  const mockAuthService = { exchangeGoogleCode$: vi.fn() };

  function createComponent(queryParams: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [GoogleCallbackComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => queryParams[k] ?? null } } },
        },
      ],
    });
    return TestBed.createComponent(GoogleCallbackComponent);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets error when code or state is missing', async () => {
    const fixture = createComponent({});
    await fixture.componentInstance.ngOnInit();
    expect(fixture.componentInstance.errorMessage()).toBeTruthy();
  });

  it('navigates to complete-profile when needs_profile_completion is true', async () => {
    mockAuthService.exchangeGoogleCode$.mockReturnValue(
      of({ success: true, user: { needs_profile_completion: true } }),
    );
    const fixture = createComponent({ code: 'abc', state: 'xyz' });
    await fixture.componentInstance.ngOnInit();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/volunteer/complete-profile']);
  });

  it('navigates to dashboard when profile is complete', async () => {
    mockAuthService.exchangeGoogleCode$.mockReturnValue(
      of({ success: true, user: { needs_profile_completion: false } }),
    );
    const fixture = createComponent({ code: 'abc', state: 'xyz' });
    await fixture.componentInstance.ngOnInit();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/volunteer-dashboard']);
  });
});
