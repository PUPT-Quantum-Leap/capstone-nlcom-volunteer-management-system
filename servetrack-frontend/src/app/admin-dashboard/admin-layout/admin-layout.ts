import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgOptimizedImage, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayout implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  readonly defaultPhoto = '/assets/person.svg';

  currentUser = computed(() => this.authService.currentUser());

  sidebarCollapsed = signal(this.getStoredSidebarState());
  mobileSidebarOpen = signal(false);
  isMobile = signal(false);
  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showAiSidebar = signal(false);
  searchQuery = signal('');
  currentUrl = signal(this.router.url);

  notificationCount = computed(() => {
    // TODO: Replace with actual notification count from service
    return 0;
  });

  currentView = computed(() => {
    // Derive current view from router URL
    const url = this.currentUrl();
    if (url.includes('/analytics')) return 'analytics';
    if (url.includes('/user-management')) return 'users';
    if (url.includes('/volunteers')) return 'volunteers';
    if (url.includes('/attendance')) return 'attendance';
    if (url.includes('/performance')) return 'performance';
    if (url.includes('/sms')) return 'sms';
    if (url.includes('/rsvps')) return 'rsvps';
    if (url.includes('/ics')) return 'ics';
    if (url.includes('/backup-recovery')) return 'backup';
    if (url.includes('/dashboard')) return 'dashboard';
    return 'dashboard';
  });

  pageTitle = computed(() => {
    switch (this.currentView()) {
      case 'dashboard':
        return 'Dashboard';
      case 'analytics':
        return 'Analytics & Reports';
      case 'users':
        return 'User Management';
      case 'volunteers':
        return 'Volunteer Management';
      case 'attendance':
        return 'Attendance';
      case 'performance':
        return 'Performance';
      case 'sms':
        return 'SMS Notifications';
      case 'rsvps':
        return 'RSVP Management';
      case 'ics':
        return 'Incident Command System';
      case 'backup':
        return 'Backup & Recovery';
      default:
        return 'Admin Dashboard';
    }
  });

  ngOnInit(): void {
    this.updateIsMobile();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
      });
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileSidebarOpen.update((value) => !value);
      return;
    }

    const nextState = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(nextState);
    this.saveSidebarState(nextState);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((value) => !value);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  navigateTo(view: string, isSearch: boolean = false): void {
    const routeMap: Record<string, string> = {
      dashboard: 'dashboard',
      analytics: 'analytics',
      users: 'user-management',
      volunteers: 'volunteers',
      attendance: 'attendance',
      performance: 'performance',
      sms: 'sms',
      rsvps: 'rsvps',
      ics: 'ics',
      backup: 'backup-recovery',
    };

    const route = routeMap[view];
    if (route) {
      if (this.currentView() === view) {
        if (!isSearch) {
          this.searchQuery.set('');
        }
      } else {
        void this.router.navigate(['/admin-dashboard', route]);
        if (!isSearch) {
          this.searchQuery.set('');
        }
      }
      this.closeMobileSidebar();
    }
  }

  isActive(view: string): boolean {
    return this.currentView() === view;
  }

  toggleNotifications(): void {
    this.showNotifications.update(v => !v);
  }

  toggleAiSidebar(): void {
    this.showAiSidebar.update(v => !v);
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } finally {
      await this.router.navigate(['/login']);
    }
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  runSearch(): void {
    const query = this.searchQuery().trim();

    if (!query) {
      return;
    }

    const lowerQuery = query.toLowerCase();

    // 1. Check for Module Navigation Shortcuts
    if (lowerQuery.includes('analytic') || lowerQuery.includes('report')) {
      this.navigateTo('analytics', true);
      return;
    }

    if (lowerQuery.includes('user')) {
      this.navigateTo('users', true);
      return;
    }

    if (
      lowerQuery.includes('volunteer') ||
      lowerQuery.includes('roster') ||
      lowerQuery.includes('member')
    ) {
      this.navigateTo('volunteers', true);
      return;
    }

    if (lowerQuery.includes('attendance') || lowerQuery.includes('check-in')) {
      this.navigateTo('attendance', true);
      return;
    }

    if (lowerQuery.includes('performance') || lowerQuery.includes('rating')) {
      this.navigateTo('performance', true);
      return;
    }

    if (lowerQuery.includes('sms') || lowerQuery.includes('message')) {
      this.navigateTo('sms', true);
      return;
    }

    if (lowerQuery.includes('rsvp') || lowerQuery.includes('event') || lowerQuery.includes('schedule')) {
      this.navigateTo('rsvps', true);
      return;
    }

    if (lowerQuery.includes('ics') || lowerQuery.includes('incident')) {
      this.navigateTo('ics', true);
      return;
    }

    if (lowerQuery.includes('backup') || lowerQuery.includes('recovery')) {
      this.navigateTo('backup', true);
      return;
    }

    // Default behavior if no module match
    this.navigateTo('dashboard', true);
  }

  private getStoredSidebarState(): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('admin-sidebar-collapsed');
      return stored === 'true';
    }

    return false;
  }

  private saveSidebarState(collapsed: boolean): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('admin-sidebar-collapsed', collapsed.toString());
    }
  }

  private updateIsMobile(): void {
    const checkMobile = () => {
      this.isMobile.set(window.innerWidth <= 860);
    };

    checkMobile();
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(checkMobile, 100);
    };

    window.addEventListener('resize', handleResize);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', handleResize);
      if (timeout) {
        clearTimeout(timeout);
      }
    });
  }
}
