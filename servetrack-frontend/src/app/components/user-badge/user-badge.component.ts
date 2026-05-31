import { Component, inject, input, signal, ChangeDetectionStrategy, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroUser,
  heroArrowRightOnRectangle,
  heroArrowsRightLeft,
} from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-user-badge',
  standalone: true,
  imports: [CommonModule, NgIcon],
  viewProviders: [provideIcons({ heroUser, heroArrowRightOnRectangle, heroArrowsRightLeft })],
  templateUrl: './user-badge.component.html',
  styleUrl: './user-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative',
  },
})
export class UserBadgeComponent {
  /** When true, displays user info only — no dropdown, no chevron, no interactions */
  readonly = input(false);

  private authService = inject(AuthService);
  private router = inject(Router);
  private triggerButton: HTMLElement | null = null;

  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  isDropdownOpen = signal(false);

  toggleDropdown(): void {
    const wasOpen = this.isDropdownOpen();
    this.isDropdownOpen.update((open) => !open);

    // Focus first menu item when opening
    if (!wasOpen) {
      setTimeout(() => {
        const firstMenuItem = document.querySelector('.user-dropdown button[role="menuitem"]') as HTMLElement;
        firstMenuItem?.focus();
      }, 0);
    }
  }

  closeDropdown(): void {
    this.isDropdownOpen.set(false);
    // Return focus to trigger button
    const trigger = document.querySelector('.user-badge-btn') as HTMLElement;
    trigger?.focus();
  }

  async logout(): Promise<void> {
    this.closeDropdown();
    await this.authService.logout();
  }

  redirectToLogin(): void {
    const currentUrl = this.router.url;
    this.router.navigate(['/volunteer-auth'], {
      queryParams: { redirect: currentUrl },
    });
  }

  switchAccount(): void {
    this.closeDropdown();
    const currentUrl = this.router.url;
    const redirectUrl = currentUrl.startsWith('/rsvp') ? currentUrl : '/rsvp';
    this.router.navigate(['/volunteer-auth'], {
      queryParams: { redirect: redirectUrl },
    });
  }

  getProfilePhotoUrl(): string {
    const user = this.currentUser();
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
  }

  isSvgImage(): boolean {
    const photoUrl = this.getProfilePhotoUrl();
    return photoUrl.toLowerCase().endsWith('.svg');
  }

  getUserName(): string {
    const user = this.currentUser();
    if (!user) {
      return 'User';
    }
    return user.name ?? user.email ?? 'User';
  }

  getUserRole(): string {
    const user = this.currentUser();
    if (!user) return 'User';

    const roleMap: Record<string, string> = {
      volunteer: 'Volunteer',
      admin: 'Admin',
      coordinator: 'Coordinator',
    };

    return roleMap[user.role?.toLowerCase() ?? ''] ?? 'User';
  }

  isAdminUser(): boolean {
    return this.currentUser()?.role?.toLowerCase() === 'admin';
  }

  getRoleColorClass(): string {
    const role = this.currentUser()?.role?.toLowerCase();
    switch (role) {
      case 'admin':
        return 'admin-role';
      case 'coordinator':
        return 'coordinator-role';
      default:
        return 'volunteer-role';
    }
  }

  getUserEmail(): string {
    const user = this.currentUser();
    return user?.email ?? '';
  }

  handleDropdownKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleDropdown();
    }
  }

  handleDropdownMenuKeydown(event: KeyboardEvent): void {
    const dropdownEl = event.currentTarget as HTMLElement;
    const menuItems = dropdownEl.querySelectorAll<HTMLElement>('button[role="menuitem"]');
    const firstItem = menuItems[0];
    const lastItem = menuItems[menuItems.length - 1];

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDropdown();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (document.activeElement === lastItem && firstItem) {
        firstItem.focus();
      } else {
        const nextIndex = Array.from(menuItems).findIndex((item) => item === document.activeElement) + 1;
        const nextItem = menuItems[nextIndex] || firstItem;
        nextItem?.focus();
      }
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (document.activeElement === firstItem && lastItem) {
        lastItem.focus();
      } else {
        const prevIndex = Array.from(menuItems).findIndex((item) => item === document.activeElement) - 1;
        const prevItem = menuItems[prevIndex] || lastItem;
        prevItem?.focus();
      }
    }

    if (event.key === 'Tab') {
      this.closeDropdown();
    }
  }
}