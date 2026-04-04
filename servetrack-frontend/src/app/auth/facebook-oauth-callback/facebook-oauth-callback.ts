import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-facebook-oauth-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './facebook-oauth-callback.html',
  styleUrl: './facebook-oauth-callback.scss',
})
export class FacebookOAuthCallbackComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    void this.handleCallback();
  }

  private async handleCallback(): Promise<void> {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');

    if (!code || !state) {
      this.errorMessage.set('Invalid Facebook callback. Please try logging in again.');
      this.isLoading.set(false);
      return;
    }

    const response = await firstValueFrom(this.authService.exchangeFacebookCode$(code, state));

    if (!response.success || !response.user) {
      this.errorMessage.set(response.message ?? 'Facebook authentication failed.');
      this.isLoading.set(false);
      return;
    }

    const userType = response.user.user_type ?? response.user.role ?? 'volunteer';
    const target = userType === 'admin' ? '/admin-dashboard' : '/volunteer-dashboard';
    await this.router.navigateByUrl(target);
  }
}
