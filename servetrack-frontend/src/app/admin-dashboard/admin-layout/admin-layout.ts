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
import { AdminDashboardService } from '../../services/admin-dashboard.service';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ServeBotComponent } from '../serve-bot/serve-bot';
import { LoadingScreenComponent } from '../../components/loading-screen/loading-screen';
import { ChatbotService } from '../../services/chatbot.service';
import { ChatbotContainerComponent } from '../../components/chatbot/chatbot-container.component';

type AdminView =
  | 'dashboard'
  | 'analytics'
  | 'users'
  | 'volunteers'
  | 'attendance'
  | 'performance'
  | 'operations'
  | 'sms'
  | 'rsvps'
  | 'ics'
  | 'backup';

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgOptimizedImage, RouterOutlet, ServeBotComponent, LoadingScreenComponent, ChatbotContainerComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayout implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private adminService = inject(AdminDashboardService);
  readonly chatbotService = inject(ChatbotService);
  private destroyRef = inject(DestroyRef);
 
  readonly defaultPhoto = '/assets/person.svg';
 
  currentUser = computed(() => this.authService.currentUser());
 
  sidebarCollapsed = signal(this.getStoredSidebarState());
  mobileSidebarOpen = signal(false);
  isMobile = signal(false);
  showNotifications = signal(false);
  showLogoutModal = signal(false);
  isLoading = signal(false);

  showServeBot = signal(false);
  searchQuery = signal('');
  currentUrl = signal(this.router.url);
 
  // Profile Edit Signals
  showProfileModal = signal(false);
  isSavingProfile = signal(false);
  profileFormData = signal({
    first_name: '',
    last_name: '',
    email: '',
    contact_number: '',
    profile_photo: null as string | null,
    profile_photo_url: null as string | null,
  });
  profileErrors = signal<Record<string, string[]>>({});

  notificationCount = computed(() => {
    // TODO: Replace with actual notification count from service
    return 0;
  });

  currentView = computed<AdminView>(() => {
    // Derive current view from router URL
    const url = this.currentUrl();
    if (url.includes('/analytics')) return 'analytics';
    if (url.includes('/user-management')) return 'users';
    if (url.includes('/volunteers')) return 'volunteers';
    if (url.includes('/attendance')) return 'attendance';
    if (url.includes('/performance')) return 'performance';
    if (url.includes('/operations')) return 'operations';
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
      case 'operations':
        return 'Operations';
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

  navigateTo(view: AdminView, isSearch: boolean = false): void {
    const routeMap: Record<AdminView, string> = {
      dashboard: 'dashboard',
      analytics: 'analytics',
      users: 'user-management',
      volunteers: 'volunteers',
      attendance: 'attendance',
      performance: 'performance',
      operations: 'operations',
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

  isActive(view: AdminView): boolean {
    return this.currentView() === view;
  }

  toggleNotifications(): void {
    this.showNotifications.update(v => !v);
  }

  toggleServeBot(): void {
    this.showServeBot.update(v => !v);
  }

  openLogoutModal(): void {
    this.showLogoutModal.set(true);
  }

  closeLogoutModal(): void {
    this.showLogoutModal.set(false);
  }

  confirmLogout(): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.showLogoutModal.set(false);
    this.authService.logout().finally(() => {
      this.isLoading.set(false);
    });
  }

  logout(): void {
    this.openLogoutModal();
  }

  // Profile Modal Methods
  openProfileModal(): void {
    this.profileErrors.set({});
    this.adminService.getAdminProfile().subscribe({
      next: (response) => {
        if (response.success) {
          this.profileFormData.set({
            first_name: response.data.first_name,
            last_name: response.data.last_name,
            email: response.data.email,
            contact_number: response.data.contact_number || '',
            profile_photo: null,
            profile_photo_url: response.data.profile_photo_url,
          });
          this.showProfileModal.set(true);
        }
      },
      error: () => {
        // Fallback to current user if service fails
        const user = this.currentUser();
        if (user) {
          const names = (user.name || 'Admin User').split(' ');
          this.profileFormData.set({
            first_name: names[0],
            last_name: names.slice(1).join(' '),
            email: user.email || '',
            contact_number: '',
            profile_photo: null,
            profile_photo_url: user.profile_photo_url || null,
          });
          this.showProfileModal.set(true);
        }
      },
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.profileFormData.update(current => ({
        ...current,
        profile_photo: base64,
        profile_photo_url: base64
      }));
    };
    reader.readAsDataURL(file);
  }

  closeProfileModal(): void {
    this.showProfileModal.set(false);
    this.profileErrors.set({});
  }

  updateProfileField(field: string, value: string): void {
    this.profileFormData.update((current) => ({
      ...current,
      [field]: value,
    }));
  }

  saveProfile(): void {
    this.isSavingProfile.set(true);
    this.profileErrors.set({});

    this.adminService.updateAdminProfile(this.profileFormData()).subscribe({
      next: (response: any) => {
        this.isSavingProfile.set(false);
        if (response.success) {
          // Update local user state
          if (response.data) {
            this.authService.currentUser.set(response.data);
          }
          this.closeProfileModal();
        } else if (response.data) {
          // Validation errors
          this.profileErrors.set(response.data);
        }
      },
      error: () => {
        this.isSavingProfile.set(false);
      },
    });
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

    if (
      lowerQuery.includes('operations') ||
      lowerQuery.includes('operation') ||
      lowerQuery.includes('planning') ||
      lowerQuery.includes('plan')
    ) {
      this.navigateTo('operations', true);
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
