import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet, Event as RouterEvent } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminDashboardService, UpcomingEventItem } from '../../services/admin-dashboard.service';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoadingScreenComponent } from '../../components/loading-screen/loading-screen';
import { ChatbotService } from '../../services/chatbot.service';
import { ChatbotSidebarComponent } from '../../components/chatbot-sidebar/chatbot-sidebar.component';
import { GlobalSearchService } from '../../services/global-search.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BackupAccessService } from '../../services/backup-access.service';

type AdminView =
  | 'dashboard'
  | 'analytics'
  | 'volunteers'
  | 'attendance'
  | 'performance'
  | 'operations'
  | 'sms'
  | 'rsvps'
  | 'ics'
  | 'sysad-settings';

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgOptimizedImage, RouterOutlet, LoadingScreenComponent, ChatbotSidebarComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class AdminLayout implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private adminService = inject(AdminDashboardService);
  readonly chatbotService = inject(ChatbotService);
  private destroyRef = inject(DestroyRef);
  private globalSearchService = inject(GlobalSearchService);
  private http = inject(HttpClient);
  private backupAccessService = inject(BackupAccessService);
 
  readonly defaultPhoto = '/assets/apple.svg';
 
  currentUser = computed(() => this.authService.currentUser());
 
  sidebarCollapsed = signal(this.getStoredSidebarState());
  mobileSidebarOpen = signal(false);
  isMobile = signal(false);
  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showUserMenu = signal(false);
  isLoading = signal(false);
  showBackupLoading = signal(false);
  backupProgress = signal(0);
  searchLoading = signal(false);
  snackbarState = signal<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  snackbarLeaving = signal(false);
  private snackbarSubscription: Subscription | null = null;
  private snackbarTimeout: ReturnType<typeof setTimeout> | null = null;
  private backupLoadingTimeout: ReturnType<typeof setTimeout> | null = null;

  searchQuery = this.globalSearchService.searchQuery;
  currentUrl = signal(this.router.url); 
  // Profile Edit Signals
  showProfileModal = signal(false);
  showAvatarSelectorModal = signal(false);
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

  notificationsList = signal<any[]>([]);
  upcomingEventsList = signal<UpcomingEventItem[]>([]);

  notificationCount = computed(() => {
    return this.notificationsList().filter(n => !n.read).length;
  });

  currentView = computed<AdminView>(() => {
    // Derive current view from router URL
    const url = this.currentUrl();
    if (url.includes('/analytics')) return 'analytics';
    if (url.includes('/volunteers')) return 'volunteers';
    if (url.includes('/attendance')) return 'attendance';
    if (url.includes('/performance')) return 'performance';
    if (url.includes('/operations')) return 'operations';
    if (url.includes('/sms')) return 'sms';
    if (url.includes('/rsvps')) return 'rsvps';
    if (url.includes('/ics')) return 'ics';
    if (url.includes('/sysad-settings')) return 'sysad-settings';
    if (url.includes('/dashboard')) return 'dashboard';
    return 'dashboard';
  });

  pageTitle = computed(() => {
    switch (this.currentView()) {
      case 'dashboard':
        return 'Dashboard';
      case 'analytics':
        return 'Analytics & Reports';
      case 'volunteers':
        return 'Volunteer Management';
      case 'attendance':
        return 'Attendance';
      case 'performance':
        return 'Performance';
      case 'operations':
        return 'Operations';
      case 'sms':
        return 'Email Notifications';
      case 'rsvps':
        return 'RSVP Management';
      case 'ics':
        return 'Incident Command System';
      case 'sysad-settings':
        return 'SysAd Settings';
      default:
        return 'Admin Dashboard';
    }
  });

  ngOnInit(): void {
    this.updateIsMobile();
    this.loadHeaderNotifications();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        this.globalSearchService.clearSearchQuery();
        this.loadHeaderNotifications();
      });
  }

  loadHeaderNotifications(): void {
    this.adminService.getDashboardData().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          let notifications = response.data.notifications || [];
          let events = response.data.upcomingEventsList || [];

          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              // Check if user dismissed notifications — skip them if descriptions match
              const clearedJson = localStorage.getItem('admin-cleared-notification-ids');
              if (clearedJson) {
                const clearedIds = JSON.parse(clearedJson) as Record<string, string>;
                notifications = notifications.filter((n: any) => {
                  // Only suppress if the content description hasn't changed
                  return clearedIds[n.id] !== n.description;
                });
              }

              // Filter out cleared upcoming events
              const clearedEventsJson = localStorage.getItem('admin-cleared-event-ids');
              if (clearedEventsJson) {
                const clearedEventIds = JSON.parse(clearedEventsJson) as number[];
                events = events.filter((e: any) => !clearedEventIds.includes(e.id));
              }

              // Mark already-viewed notifications as read
              const storedJson = localStorage.getItem('admin-viewed-notifications');
              if (storedJson) {
                const stored = JSON.parse(storedJson) as Record<string, string>;
                notifications = notifications.map((n: any) => {
                  if (stored[n.id] === n.description) {
                    return { ...n, read: true };
                  }
                  return n;
                });
              }
            } catch (e) {
              console.error('Failed to parse viewed notifications', e);
            }
          }

          this.notificationsList.set(notifications);
          this.upcomingEventsList.set(events);
        }
      },
      error: (err) => {
        console.error('Failed to load header notifications:', err);
      }
    });
  }

  dismissNotification(id: number): void {
    const current = this.notificationsList();
    const dismissed = current.find(n => n.id === id);
    this.notificationsList.update(list => list.filter(n => n.id !== id));

    if (dismissed && typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = JSON.parse(localStorage.getItem('admin-cleared-notification-ids') ?? '{}') as Record<string, string>;
        stored[dismissed.id] = dismissed.description;
        localStorage.setItem('admin-cleared-notification-ids', JSON.stringify(stored));
      } catch (e) {
        console.error('Failed to persist dismissed notification', e);
      }
    }
  }

  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-wrapper')) {
      this.showNotifications.set(false);
    }
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
      volunteers: 'volunteers',
      attendance: 'attendance',
      performance: 'performance',
      operations: 'operations',
      sms: 'sms',
      rsvps: 'rsvps',
      ics: 'ics',
      'sysad-settings': 'sysad-settings',
    };

    const route = routeMap[view];
    if (route) {
      if (this.currentView() === view) {
        if (!isSearch) {
          this.globalSearchService.clearSearchQuery();
        }
      } else {
        void this.router.navigate(['/admin-dashboard', route]);
        if (!isSearch) {
          this.globalSearchService.clearSearchQuery();
        }
      }
      this.closeMobileSidebar();
    }
  }

  isActive(view: AdminView): boolean {
    return this.currentView() === view;
  }

  clearAllNotifications(): void {
    const currentNotifs = this.notificationsList();
    const currentEvents = this.upcomingEventsList();

    // Clear both sections
    this.notificationsList.set([]);
    this.upcomingEventsList.set([]);
    this.showNotifications.set(false);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Persist cleared notification IDs+descriptions
        const clearedNotifs: Record<string, string> = JSON.parse(
          localStorage.getItem('admin-cleared-notification-ids') ?? '{}'
        ) as Record<string, string>;
        currentNotifs.forEach(n => {
          clearedNotifs[n.id] = n.description;
        });
        localStorage.setItem('admin-cleared-notification-ids', JSON.stringify(clearedNotifs));

        // Persist cleared event IDs
        const clearedEventIds: number[] = JSON.parse(
          localStorage.getItem('admin-cleared-event-ids') ?? '[]'
        ) as number[];
        currentEvents.forEach(e => {
          if (!clearedEventIds.includes(e.id)) {
            clearedEventIds.push(e.id);
          }
        });
        localStorage.setItem('admin-cleared-event-ids', JSON.stringify(clearedEventIds));
      } catch (e) {
        console.error('Failed to persist cleared notifications', e);
      }
    }
  }

  toggleNotifications(): void {
    const nextState = !this.showNotifications();
    this.showNotifications.set(nextState);
    if (nextState) this.showUserMenu.set(false);
  }

  toggleUserMenu(): void {
    const nextState = !this.showUserMenu();
    this.showUserMenu.set(nextState);
    if (nextState) this.showNotifications.set(false);
    
    if (nextState) {
      // Mark all current notifications as read when opening dropdown
      this.notificationsList.update(list => list.map(n => ({ ...n, read: true })));
      
      // Persist the current descriptions to LocalStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const viewed: Record<string, string> = {};
          this.notificationsList().forEach(n => {
            viewed[n.id] = n.description;
          });
          localStorage.setItem('admin-viewed-notifications', JSON.stringify(viewed));
        } catch (e) {
          console.error('Failed to save viewed notifications', e);
        }
      }
    }
  }

  toggleChatbot(): void {
    this.chatbotService.toggleChatbot();
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

  openAvatarSelector(): void {
    this.showAvatarSelectorModal.set(true);
  }

  closeAvatarSelector(): void {
    this.showAvatarSelectorModal.set(false);
  }

  selectPersona(persona: string | null): void {
    let photoUrl: string;
    if (persona === 'boy') {
      photoUrl = '/assets/boy.svg';
    } else if (persona === 'girl') {
      photoUrl = '/assets/girl.svg';
    } else {
      photoUrl = '/assets/apple.svg';
    }

    this.profileFormData.update((current) => ({
      ...current,
      profile_photo: photoUrl,
      profile_photo_url: photoUrl,
    }));
    this.showAvatarSelectorModal.set(false);
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
    this.globalSearchService.setSearchQuery(query);
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

    // Check if the search query is the admin's password — grants access to backup & recovery
    this.searchLoading.set(true);
    this.http.post<{ success: boolean }>(`${environment.apiUrl}/admin/verify-password`, { password: query }, {
      withCredentials: true,
    }).subscribe({
      next: (response) => {
        this.searchLoading.set(false);
        if (response.success) {
          this.globalSearchService.clearSearchQuery();
          this.showBackupLoading.set(true);
          this.backupProgress.set(0);
          requestAnimationFrame(() => {
            this.backupProgress.set(100);
          });
          this.backupLoadingTimeout = setTimeout(() => {
            this.showBackupLoading.set(false);
            this.backupProgress.set(0);
            this.backupAccessService.grantAccess();
            void this.router.navigate(['/admin-dashboard', 'sysad-settings']);
            this.closeMobileSidebar();
          }, 2000);
        }
      },
      error: () => {
        this.searchLoading.set(false);
        // Silent failure — do not reveal the mechanism
      },
    });

    // Default behavior if no module match: do nothing to keep search active on the current page
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

  onChildActivate(component: unknown): void {
    this.snackbarSubscription?.unsubscribe();
    const comp = component as { showSnackbar?: { subscribe: (fn: (msg: { message: string; type: 'success' | 'error' | 'info' }) => void) => import('rxjs').Subscription } };
    if (comp?.showSnackbar) {
      this.snackbarSubscription = comp.showSnackbar.subscribe((msg) => {
        this.showSnackbar(msg);
      });
    }
  }

  private showSnackbar(msg: { message: string; type: 'success' | 'error' | 'info' }): void {
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }
    this.snackbarLeaving.set(false);
    this.snackbarState.set(msg);
    this.snackbarTimeout = setTimeout(() => {
      this.dismissSnackbar();
    }, 4000);
  }

  dismissSnackbar(): void {
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
      this.snackbarTimeout = null;
    }
    this.snackbarLeaving.set(true);
    setTimeout(() => {
      this.snackbarState.set(null);
      this.snackbarLeaving.set(false);
    }, 300);
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
      if (this.backupLoadingTimeout) {
        clearTimeout(this.backupLoadingTimeout);
      }
    });
  }
}
