import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterOutlet, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { VolunteerService } from '../../services/volunteer.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationItem } from '../../models/notification-item';

@Component({
  selector: 'app-volunteer-dashboard-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NgTemplateOutlet],
  templateUrl: './volunteer-dashboard-shell.html',
  styleUrl: './volunteer-dashboard-shell.scss',
})
export class VolunteerDashboardShell implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private volunteerService = inject(VolunteerService);
  private destroyRef = inject(DestroyRef);

  readonly defaultPhoto = '/assets/volunteer1.png';

  // ── Navigation State ───────────────────────────────────────────────────
  userName = signal(this.authService.currentUser()?.name || 'Volunteer');
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  isMobile = signal(false);
  isLoading = signal(false);

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
  searchQuery = signal('');
  notifications = signal<NotificationItem[]>([]);
  notificationCount = computed(
    () => this.notifications().filter((n) => !n.read).length,
  );

  profilePreviewUrl = signal(this.defaultPhoto);

  ngOnInit(): void {
    this.updateIsMobile();
    this.startRealTimeClock();
    this.loadProfile();
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
        const data = response.data;
        this.userName.set(`${data.first_name} ${data.last_name}`.trim());
      }
    });
  }

  // ── Sidebar / navigation ───────────────────────────────────────────────
  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileSidebarOpen.update((v) => !v);
    } else {
      this.sidebarCollapsed.update((v) => !v);
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
    if (query.includes('request') || query.includes('change')) {
      this.navigateTo('requests');
      return;
    }
    if (query.includes('poll')) {
      this.navigateTo('polls');
      return;
    }
    this.navigateTo('overview');
  }

  toggleNotifications(): void {
    this.showNotifications.update((value) => !value);
  }

  markNotificationsRead(): void {
    this.notifications.update((items) => items.map((item) => ({ ...item, read: true })));
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

  async confirmLogout(): Promise<void> {
    this.isLoading.set(true);
    this.showLogoutModal.set(false);
    try {
      await this.authService.logout();
    } finally {
      await this.router.navigate(['/login']);
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    this.openLogoutModal();
  }
}
