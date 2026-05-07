import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-badge.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative',
  },
})
export class UserBadgeComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  isDropdownOpen = signal(false);

  toggleDropdown(): void {
    this.isDropdownOpen.update((open) => !open);
  }

  closeDropdown(): void {
    this.isDropdownOpen.set(false);
  }

  async logout(): Promise<void> {
    this.closeDropdown();
    await this.authService.logout();
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
    const photoUrl = this.currentUser()?.profile_photo_url;
    if (!photoUrl) {
      return '/assets/person.svg';
    }
    return photoUrl;
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
      admin: 'Administrator',
      coordinator: 'Coordinator',
    };

    return roleMap[user.role?.toLowerCase() ?? ''] ?? 'User';
  }

  getUserEmail(): string {
    const user = this.currentUser();
    return user?.email ?? '';
  }
}
