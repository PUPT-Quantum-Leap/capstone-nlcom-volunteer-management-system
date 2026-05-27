import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { User } from '../../models/user';
import { UserService } from '../../services/user.service';
import { InviteService } from '../../services/invite.service';
import { CustomSelect, SelectOption } from '../../components/custom-select/custom-select';

@Component({
  selector: 'app-user-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CustomSelect],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagementComponent {
  private readonly userService = inject(UserService);
  private readonly inviteService = inject(InviteService);
  private readonly destroyRef = inject(DestroyRef);

  // Dropdown Options
  statusOptions: SelectOption<string>[] = [
    { label: 'Active Users', value: 'active' },
    { label: 'Archived Users', value: 'archived' }
  ];

  roleOptions: SelectOption<string>[] = [
    { label: 'All Roles', value: '' },
    { label: 'Admin', value: 'admin' },
    { label: 'Coordinator', value: 'coordinator' },
    { label: 'Volunteer', value: 'volunteer' }
  ];

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  readonly Math = Math;
  readonly currentDate = new Date();
  readonly isLoading = signal(false);
  readonly users = signal<User[]>([]);
  readonly archivedUsers = signal<User[]>([]);
  readonly showArchivedUsers = signal(false);
  readonly userSearchQuery = signal('');
  readonly userRoleFilter = signal('');
  readonly currentPage = signal(1);
  readonly usersPerPage = signal(5);
  readonly showDeleteUserModal = signal(false);
  readonly deletingUserId = signal<number | null>(null);
  readonly viewingUser = signal<User | null>(null);
  readonly showViewUserModal = signal(false);
  readonly editingUser = signal<User | null>(null);
  readonly showEditUserModal = signal(false);
  readonly editFormData = signal<{ name: string; email: string; role: string }>({ name: '', email: '', role: '' });
  readonly inviteMode = signal<'email' | 'link' | 'direct'>('email');
  readonly inviteEmail = signal('');
  readonly inviteLink = signal('');
  readonly isCreatingInvite = signal(false);
  readonly isSaving = signal(false);
  readonly showInviteSuccess = signal(false);
  readonly showResetPassword = signal(false);
  readonly resetPasswordValue = signal('');
  readonly isResettingPassword = signal(false);
  readonly showResetPasswordField = signal(false);
  readonly showPasswordRequirements = signal(false);
  readonly resetPasswordError = signal<string | null>(null);
  readonly resetPasswordSuccess = signal(false);

  readonly passwordRequirementsMet = computed(() => {
    const password = this.resetPasswordValue();
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  });

  readonly filteredUsers = computed(() => {
    const search = this.userSearchQuery().toLowerCase().trim();
    const users = this.showArchivedUsers()
      ? this.archivedUsers()
      : this.users().filter((user) => !user.deleted_at);

    let filtered = users;

    const role = this.userRoleFilter();
    if (role) {
      filtered = filtered.filter((user) => user.role === role);
    }

    if (search) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search),
      );
    }

    return filtered;
  });

  readonly usersTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredUsers().length / this.usersPerPage())),
  );

  readonly paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.usersPerPage();
    return this.filteredUsers().slice(start, start + this.usersPerPage());
  });

  readonly activeUsersCount = computed(() =>
    this.users().filter((user) => !user.deleted_at).length,
  );

  readonly adminCount = computed(() =>
    this.users().filter((user) => user.role === 'admin' && !user.deleted_at).length,
  );

  readonly coordinatorCount = computed(() =>
    this.users().filter((user) => user.role === 'coordinator' && !user.deleted_at).length,
  );

  readonly volunteerCount = computed(() =>
    this.users().filter((user) => user.role === 'volunteer' && !user.deleted_at).length,
  );

  constructor() {
    this.loadUsers();
    this.loadArchivedUsers();
  }

  formatRole(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  openCreateUserModal(): void {
    this.editingUser.set(null);
    this.editFormData.set({ name: '', email: '', role: 'volunteer' });
    this.inviteMode.set('email');
    this.inviteEmail.set('');
    this.inviteLink.set('');
    this.showInviteSuccess.set(false);
    this.showEditUserModal.set(true);
  }

  // Tab switching
  switchToActiveUsers(): void {
    this.showArchivedUsers.set(false);
    this.currentPage.set(1);
  }

  switchToArchivedUsers(): void {
    this.showArchivedUsers.set(true);
    this.currentPage.set(1);
  }

  setUserSearchQuery(query: string): void {
    this.userSearchQuery.set(query);
    this.currentPage.set(1);
  }

  setUserRoleFilter(role: string): void {
    this.userRoleFilter.set(role);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.usersTotalPages()) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.usersTotalPages()) {
      this.currentPage.update((page) => page + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((page) => page - 1);
    }
  }

  getPageNumbers(): number[] {
    const total = this.usersTotalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    if (total <= 7) {
      for (let page = 1; page <= total; page += 1) {
        pages.push(page);
      }
    } else if (current <= 3) {
      pages.push(1, 2, 3, 4, -1, total);
    } else if (current >= total - 2) {
      pages.push(1, -1, total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, -1, current - 1, current, current + 1, -1, total);
    }

    return pages;
  }

  confirmDeleteUser(userId: number): void {
    this.deletingUserId.set(userId);
    this.showDeleteUserModal.set(true);
  }

  closeDeleteUserModal(): void {
    this.showDeleteUserModal.set(false);
    this.deletingUserId.set(null);
  }

  deleteUser(): void {
    const userId = this.deletingUserId();

    if (userId === null) {
      return;
    }

    this.isSaving.set(true);
    this.userService
      .softDeleteUser(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.users.update((items) => items.filter((user) => user.id !== userId));
          this.loadArchivedUsers();
          this.showSnackbar.emit({ message: 'User archived successfully', type: 'success' });
          this.isSaving.set(false);
          this.closeDeleteUserModal();
        },
        error: (error: Error) => {
          console.error('Error archiving user:', error);
          this.showSnackbar.emit({ message: 'Failed to archive user', type: 'error' });
          this.isSaving.set(false);
          this.closeDeleteUserModal();
        },
      });
  }

  restoreUser(id: number): void {
    this.isSaving.set(true);
    this.userService.restoreUser(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadUsers();
          this.loadArchivedUsers();
          this.showSnackbar.emit({ message: 'User restored successfully', type: 'success' });
          this.isSaving.set(false);
        },
        error: (error: Error) => {
          console.error('Error restoring user:', error);
          this.showSnackbar.emit({ message: 'Failed to restore user', type: 'error' });
          this.isSaving.set(false);
        },
      });
  }

  openEditUserModal(user: User): void {
    this.editingUser.set(user);
    this.editFormData.set({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    this.showEditUserModal.set(true);
  }

  closeEditUserModal(): void {
    this.showEditUserModal.set(false);
    this.editingUser.set(null);
    this.editFormData.set({ name: '', email: '', role: '' });
    this.inviteMode.set('email');
    this.inviteEmail.set('');
    this.inviteLink.set('');
    this.showInviteSuccess.set(false);
    this.showResetPassword.set(false);
    this.resetPasswordValue.set('');
    this.showResetPasswordField.set(false);
    this.showPasswordRequirements.set(false);
    this.resetPasswordError.set(null);
  }

  updateEditForm(field: 'name' | 'email' | 'role', value: string): void {
    this.editFormData.update((current) => ({ ...current, [field]: value }));
  }

  saveUser(): void {
    const user = this.editingUser();
    if (!user) return;

    const formData = this.editFormData();

    const updateData: Partial<User> = {
      name: formData.name,
      email: formData.email,
      role: formData.role as 'admin' | 'coordinator' | 'volunteer',
    };

    this.isSaving.set(true);
    this.userService.updateUser(user.id, updateData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadUsers();
          this.showSnackbar.emit({ message: 'User updated successfully', type: 'success' });
          this.isSaving.set(false);
          this.closeEditUserModal();
        },
        error: (error: Error) => {
          console.error('Error updating user:', error);
          this.showSnackbar.emit({ message: 'Failed to update user', type: 'error' });
          this.isSaving.set(false);
        },
      });
  }

  setInviteMode(mode: 'email' | 'link'): void {
    this.inviteMode.set(mode);
  }

  setInviteEmail(email: string): void {
    this.inviteEmail.set(email);
  }

  createInvite(): void {
    const formData = this.editFormData();
    const email = this.inviteMode() === 'email' ? this.inviteEmail() : null;

    this.isCreatingInvite.set(true);

    this.inviteService.createInvite(email, formData.role)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.inviteLink.set(response.data.invite_link);
          this.showInviteSuccess.set(true);
          this.isCreatingInvite.set(false);
          this.showEditUserModal.set(false);
          this.showSnackbar.emit({ message: 'Invite created successfully', type: 'success' });
        },
        error: (error: Error) => {
          console.error('Error creating invite:', error);
          this.showSnackbar.emit({ message: 'Failed to create invite', type: 'error' });
          this.isCreatingInvite.set(false);
        },
      });
  }

  toggleResetPassword(): void {
    this.showResetPassword.update((v) => !v);
    this.resetPasswordValue.set('');
    this.resetPasswordError.set(null);
    this.resetPasswordSuccess.set(false);
  }

  toggleResetPasswordFieldVisibility(): void {
    this.showResetPasswordField.update((v) => !v);
  }

  getPasswordRequirements(): { label: string; met: boolean }[] {
    const password = this.resetPasswordValue();

    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter', met: /[a-z]/.test(password) },
      { label: 'One number', met: /[0-9]/.test(password) },
      { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
    ];
  }

  resetUserPassword(): void {
    const user = this.editingUser();
    const password = this.resetPasswordValue();

    if (!user || !password) return;

    this.resetPasswordError.set(null);
    this.isResettingPassword.set(true);
    this.userService.resetPassword(user.id, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resetPasswordSuccess.set(true);
          this.showPasswordRequirements.set(false);
          this.resetPasswordError.set(null);
          this.isResettingPassword.set(false);
        },
        error: (error: any) => {
          this.isResettingPassword.set(false);
          if (error?.error?.errors?.password) {
            this.resetPasswordError.set(error.error.errors.password.join(' '));
          } else if (error?.status === 403) {
            this.resetPasswordError.set('You cannot reset your own password');
          } else if (error?.status === 404) {
            this.resetPasswordError.set('User not found');
          } else if (error?.error?.message) {
            this.resetPasswordError.set(error.error.message);
          } else {
            this.resetPasswordError.set('Failed to reset password. Please try again.');
            this.showSnackbar.emit({ message: 'Failed to reset password', type: 'error' });
          }
        },
      });
  }

  copyInviteLink(): void {
    navigator.clipboard.writeText(this.inviteLink()).then(() => {
      this.showSnackbar.emit({ message: 'Invite link copied to clipboard', type: 'success' });
    }).catch(() => {
      this.showSnackbar.emit({ message: 'Failed to copy link', type: 'error' });
    });
  }

  openViewUserModal(user: User): void {
    this.viewingUser.set(user);
    this.showViewUserModal.set(true);
  }

  closeViewUserModal(): void {
    this.showViewUserModal.set(false);
    this.viewingUser.set(null);
  }

  private loadUsers(): void {
    this.isLoading.set(true);

    this.userService
      .getUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.users.set(response.data ?? []);
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          console.error('Error loading users:', error);
          this.users.set([]);
          this.isLoading.set(false);
        },
      });
  }

  private loadArchivedUsers(): void {
    this.userService
      .getArchivedUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.archivedUsers.set(response.data ?? []);
        },
        error: (error: Error) => {
          console.error('Error loading archived users:', error);
          this.archivedUsers.set([]);
        },
      });
  }
}
