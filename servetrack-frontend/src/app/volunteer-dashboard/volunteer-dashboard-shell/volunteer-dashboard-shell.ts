import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';
import { NgTemplateOutlet, NgOptimizedImage } from '@angular/common';
import { Router, RouterOutlet, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { VolunteerService } from '../../services/volunteer.service';
import { RsvpService } from '../../services/rsvp.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationItem } from '../../models/notification-item';

import { LoadingScreenComponent } from '../../components/loading-screen/loading-screen';

@Component({
  selector: 'app-volunteer-dashboard-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NgTemplateOutlet, NgOptimizedImage, LoadingScreenComponent],
  templateUrl: './volunteer-dashboard-shell.html',
  styleUrl: './volunteer-dashboard-shell.scss',
})
export class VolunteerDashboardShell implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly authService = inject(AuthService);
  private volunteerService = inject(VolunteerService);
  private rsvpService = inject(RsvpService);
  private destroyRef = inject(DestroyRef);

  readonly defaultPhoto = '/assets/apple.svg';

  // ── Navigation State ───────────────────────────────────────────────────
  userName = computed(() => {
    const user = this.authService.currentUser();
    if (user?.role === 'volunteer' && user?.volunteer_profile) {
      const vol = user.volunteer_profile as any;
      return `${vol.first_name || ''} ${vol.last_name || ''}`.trim() || user.name || 'Volunteer';
    }
    return user?.name || 'Volunteer';
  });
  sidebarCollapsed = signal(this.getStoredSidebarState());
  mobileSidebarOpen = signal(false);
  isMobile = signal(false);
  isLoading = signal(false);
  pageLoading = signal(true);

  // ── Real-time Clock ──────────────────────────────────────────────────────
  currentTime = signal(new Date());
  currentDateFormatted = computed(() => {
    const date = this.currentTime();
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  });

  currentTimeFormatted = computed(() => {
    const date = this.currentTime();
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  });

  private timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showUserMenu = signal(false);
  searchQuery = signal('');
  notifications = signal<NotificationItem[]>([]);
  notificationCount = computed(
    () => this.notifications().filter((n) => !n.read).length,
  );

  profilePreviewUrl = computed(() => {
    const user = this.authService.currentUser();
    const photoUrl = user?.profile_photo_url;
    if (photoUrl) {
      return photoUrl;
    }
    if (user?.role === 'volunteer' && user?.volunteer_profile) {
      const volProfile = user.volunteer_profile as any;
      const volPhoto = volProfile.profile_photo_url || volProfile.photo_url;
      if (volPhoto) {
        return volPhoto;
      }
      const gender = volProfile.gender;
      if (gender === 'girl' || gender === 'female') {
        return '/assets/girl.svg';
      } else if (gender === 'boy' || gender === 'male') {
        return '/assets/boy.svg';
      } else {
        return '/assets/apple.svg';
      }
    }
    return '/assets/apple.svg';
  });

  ngOnInit(): void {
    this.updateIsMobile();
    this.startRealTimeClock();
    this.loadProfile();
    this.warmUpCaches();

    // Initial 4-second loading screen
    setTimeout(() => {
      this.pageLoading.set(false);
    }, 4000);
  }

  /**
   * Pre-fetch data in the background so child modules can hydrate instantly
   * from in-memory caches without waiting for HTTP roundtrips.
   */
  private warmUpCaches(): void {
    this.volunteerService.getAttendanceStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.volunteerService.getAttendance('monthly').pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.rsvpService.getRsvps().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  private startRealTimeClock(): void {
    this.currentTime.set(new Date());
    this.timeUpdateInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      if (this.timeUpdateInterval) {
        clearInterval(this.timeUpdateInterval);
      }
    });
  }

  private updateIsMobile(): void {
    const checkMobile = () => {
      this.isMobile.set(window.innerWidth <= 860);
    };
    checkMobile();
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(checkMobile, 100);
    };

    window.addEventListener('resize', handleResize);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', handleResize);
      if (timeout) clearTimeout(timeout);
    });
  }

  private loadProfile(): void {
    this.volunteerService.getProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      if (response.success && response.data) {
        const current = this.authService.currentUser();
        if (current) {
          this.authService.currentUser.set({
            ...current,
            name: `${response.data.first_name} ${response.data.last_name}`,
            email: response.data.email,
            volunteer_profile: response.data as any
          });
        }
      }
    });
  }

  // ── Sidebar / navigation ───────────────────────────────────────────────
  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileSidebarOpen.update((v) => !v);
    } else {
      const newState = !this.sidebarCollapsed();
      this.sidebarCollapsed.set(newState);
      this.saveSidebarState(newState);
    }
  }

  private getStoredSidebarState(): boolean {
    if (typeof window !== 'undefined' &&
        window.localStorage) {
      const stored = localStorage.getItem(
        'volunteer-sidebar-collapsed'
      );
      return stored === 'true';
    }
    return false;
  }

  private saveSidebarState(collapsed: boolean): void {
    if (typeof window !== 'undefined' &&
        window.localStorage) {
      localStorage.setItem(
        'volunteer-sidebar-collapsed',
        collapsed.toString()
      );
    }
  }

  navigateTo(route: string): void {
    this.router.navigate([route], { relativeTo: this.route });
    if (this.isMobile()) {
      this.mobileSidebarOpen.set(false);
    }
  }

  isActive(route: string): boolean {
    return this.router.url.includes(route);
  }

  onOverlayClick(): void {
    this.mobileSidebarOpen.set(false);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((value) => !value);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  runSearch(): void {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return;

    if (query.includes('profile') || query.includes('name') || query.includes('signup')) {
      this.navigateTo('profile');
      return;
    }
    if (query.includes('schedule') || query.includes('attendance') || query.includes('task')) {
      this.navigateTo('attendance');
      return;
    }
    if (query.includes('poll')) {
      this.navigateTo('polls');
      return;
    }
    this.navigateTo('overview');
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
  }

  markNotificationsRead(): void {
    this.notifications.update((items) => items.map((item) => ({ ...item, read: true })));
  }

  dismissNotification(id: number): void {
    this.notifications.update((items) => items.filter((item) => item.id !== id));
  }

  clearAllNotifications(): void {
    this.notifications.set([]);
    this.showNotifications.set(false);
  }

  closeNotifications(): void {
    this.showNotifications.set(false);
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
}
