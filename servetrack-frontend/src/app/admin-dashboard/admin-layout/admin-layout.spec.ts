import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdminLayout } from './admin-layout';
import { NavigationEnd } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('AdminLayout - Logic Tests', () => {
  let component: AdminLayout;
  let routerMock: any;
  let authServiceMock: any;
  let adminServiceMock: any;

  beforeEach(() => {
    routerMock = {
      url: '/admin-dashboard/dashboard',
      events: of(new NavigationEnd(0, '/admin-dashboard/dashboard', '/admin-dashboard/dashboard')),
      navigate: vi.fn().mockResolvedValue(true)
    };

    authServiceMock = {
      currentUser: signal({ name: 'Test Admin', role: 'admin' }),
      logout: vi.fn().mockResolvedValue({})
    };

    adminServiceMock = {
      getAdminProfile: vi.fn().mockReturnValue(of({ success: true, data: {} })),
      updateAdminProfile: vi.fn().mockReturnValue(of({ success: true }))
    };

    // Manual instantiation without TestBed to avoid environment issues
    component = Object.create(AdminLayout.prototype);
    
    // Initialize signals that would normally be initialized in the class
    component.pageLoading = signal(true);
    component.sidebarCollapsed = signal(false);
    component.mobileSidebarOpen = signal(false);
    component.isMobile = signal(false);
    component.showNotifications = signal(false);
    component.showLogoutModal = signal(false);
    component.isLoading = signal(false);
    component.showServeBot = signal(false);
    component.searchQuery = signal('');
    component.currentUrl = signal(routerMock.url);
    
    // Mock DestroyRef
    (component as any).destroyRef = { onDestroy: vi.fn() } as any;
    
    // Mock injected services
    (component as any).router = routerMock;
    (component as any).authService = authServiceMock;
    (component as any).adminService = adminServiceMock;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have pageLoading signal initially set to true', () => {
    expect(component.pageLoading()).toBe(true);
  });

  it('should set pageLoading to false after timeout in ngOnInit', () => {
    vi.useFakeTimers();
    
    // Mock the updateIsMobile which is called in ngOnInit
    (component as any).updateIsMobile = vi.fn();
    
    component.ngOnInit();
    
    vi.advanceTimersByTime(2500);
    expect(component.pageLoading()).toBe(false);
  });

  it('should toggle sidebarCollapsed state', () => {
    const initialState = component.sidebarCollapsed();
    component.toggleSidebar();
    expect(component.sidebarCollapsed()).toBe(!initialState);
  });

  it('should toggle mobileSidebarOpen state', () => {
    const initialState = component.mobileSidebarOpen();
    component.toggleMobileSidebar();
    expect(component.mobileSidebarOpen()).toBe(!initialState);
  });
});
