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
    if (url.includes('analytics')) return 'analytics';
    if (url.includes('user-management')) return 'users';
    if (url.includes('volunteers')) return 'volunteers';
    if (url.includes('attendance')) return 'attendance';
    if (url.includes('performance')) return 'performance';
    if (url.includes('sms')) return 'sms';
    if (url.includes('rsvps')) return 'rsvps';
    if (url.includes('ics')) return 'ics';
    if (url.includes('backup-recovery')) return 'backup';
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

  navigateTo(view: string): void {
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
      void this.router.navigate([route], { relativeTo: this.route });
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
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return;
    }

    if (query.includes('analytic') || query.includes('report')) {
      this.navigateTo('analytics');
      return;
    }

    if (query.includes('user')) {
      this.navigateTo('users');
      return;
    }

    if (
      query.includes('volunteer') ||
      query.includes('roster') ||
      query.includes('member')
    ) {
      this.navigateTo('volunteers');
      return;
    }

    if (query.includes('attendance') || query.includes('check-in')) {
      this.navigateTo('attendance');
      return;
    }

    if (query.includes('performance') || query.includes('rating')) {
      this.navigateTo('performance');
      return;
    }

    if (query.includes('sms') || query.includes('message')) {
      this.navigateTo('sms');
      return;
    }

    if (query.includes('rsvp') || query.includes('event') || query.includes('schedule')) {
      this.navigateTo('rsvps');
      return;
    }

    if (query.includes('ics') || query.includes('incident')) {
      this.navigateTo('ics');
      return;
    }

    if (query.includes('backup') || query.includes('recovery')) {
      this.navigateTo('backup');
      return;
    }

    this.navigateTo('dashboard');
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
