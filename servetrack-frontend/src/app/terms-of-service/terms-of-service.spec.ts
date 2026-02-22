import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { TermsOfService } from './terms-of-service';

describe('TermsOfService', () => {
  let component: TermsOfService;
  let fixture: ComponentFixture<TermsOfService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsOfService],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: {}, queryParams: {} },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TermsOfService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display terms of service title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.page-title')?.textContent).toContain('Terms of Service');
  });

  it('should have link to home page', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const homeLink = compiled.querySelector('a[routerLink="/"]');
    expect(homeLink).toBeTruthy();
  });

  it('should have link to signup page', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const signupLink = compiled.querySelector('a[routerLink="/signup"]');
    expect(signupLink).toBeTruthy();
  });

  it('should have link to privacy policy', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const privacyLink = compiled.querySelector('a[routerLink="/privacy-policy"]');
    expect(privacyLink).toBeTruthy();
  });
});
