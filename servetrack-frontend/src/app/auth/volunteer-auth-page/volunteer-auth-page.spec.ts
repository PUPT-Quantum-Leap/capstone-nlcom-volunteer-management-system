import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VolunteerAuthPage } from './volunteer-auth-page';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('VolunteerAuthPage', () => {
  let component: VolunteerAuthPage;
  let fixture: ComponentFixture<VolunteerAuthPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VolunteerAuthPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VolunteerAuthPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with login tab active', () => {
    expect(component.activeTab()).toBe('login');
    expect(component.isLoginTab()).toBe(true);
    expect(component.isSignupTab()).toBe(false);
  });

  it('should switch tabs correctly', () => {
    component.switchTab('signup');
    expect(component.activeTab()).toBe('signup');
    expect(component.isLoginTab()).toBe(false);
    expect(component.isSignupTab()).toBe(true);
  });
});
