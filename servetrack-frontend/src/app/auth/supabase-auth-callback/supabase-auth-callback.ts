import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { EmailOtpType, Session } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/supabase.service';
import { InviteService } from '../../services/invite.service';
import { AuthService } from '../../services/auth.service';

/**
 * Supabase Auth Callback Component
 *
 * Handles Supabase OAuth and magic link authentication callbacks.
 * Extracts tokens from URL hash fragments, sets the session,
 * and redirects users to their role-specific registration forms.
 *
 * Flow:
 * 1. User receives invite email from Supabase
 * 2. User clicks link and authenticates with Supabase
 * 3. Supabase redirects to this callback with #access_token in URL
 * 4. This component extracts tokens and sets the session
 * 5. Reads stored invite token from localStorage
 * 6. Redirects to appropriate signup form with invite token
 */
@Component({
  selector: 'app-supabase-auth-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="callback-container">
      <div class="loading-spinner"></div>
      <p>{{ statusMessage }}</p>
      @if (errorMessage) {
        <div class="error-message">
          <p>{{ errorMessage }}</p>
          <button (click)="goToLogin()">Go to Login</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid #ffffff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    p {
      color: #ffffff;
      font-size: 18px;
      margin: 0;
    }

    .error-message {
      text-align: center;
      margin-top: 20px;
    }

    .error-message p {
      color: #ff6b6b;
      margin-bottom: 15px;
    }

    .error-message button {
      padding: 10px 20px;
      background: #ffffff;
      color: #667eea;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.2s;
    }

    .error-message button:hover {
      transform: translateY(-2px);
    }
  `],
})
export class SupabaseAuthCallbackComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly supabaseService = inject(SupabaseService);
  private readonly inviteService = inject(InviteService);
  private readonly authService = inject(AuthService);

  statusMessage = 'Completing authentication...';
  errorMessage: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      // Get hash fragment from URL (Supabase puts tokens in hash)
      const hashParams = this.parseHashFragment();
      const queryParams = this.route.snapshot.queryParams;

      console.log('Supabase callback received', {
        hasAccessToken: !!hashParams['access_token'],
        hasRefreshToken: !!hashParams['refresh_token'],
        hasCode: !!queryParams['code'],
        hasTokenHash: !!queryParams['token_hash'],
        authType: queryParams['type'],
        queryParams: Object.keys(queryParams),
        tokenFromQuery: queryParams['token'],
        roleFromQuery: queryParams['role'],
      });

      // Store the token from query params if present (this is our invite token)
      if (queryParams['token']) {
        this.supabaseService.storeInviteForCallback(
          queryParams['token'],
          queryParams['role'] || 'volunteer',
          ''
        );
      }

      // Handle error from Supabase
      if (hashParams['error'] || queryParams['error']) {
        const errorDescription = hashParams['error_description'] ||
          queryParams['error_description'] ||
          'Authentication failed';
        this.handleError(errorDescription);
        return;
      }

      // If we have an access token, set the session
      if (hashParams['access_token']) {
        await this.handleAuthCallback(hashParams, queryParams['token']);
        return;
      }

      if (queryParams['code']) {
        await this.handleCodeCallback(queryParams['code'], queryParams['token']);
        return;
      }

      if (queryParams['token_hash'] && queryParams['type']) {
        await this.handleTokenHashCallback(
          queryParams['token_hash'],
          queryParams['type'],
          queryParams['token']
        );
        return;
      }

      // If no tokens but we have a stored invite, redirect based on that
      const storedInvite = this.getStoredInvite();
      if (storedInvite) {
        this.redirectToSignup(storedInvite.token, storedInvite.role);
        return;
      }

      // No tokens and no stored invite - go to login
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error in Supabase auth callback', error);
      this.handleError('An unexpected error occurred. Please try again.');
    }
  }

  /**
   * Parse URL hash fragment parameters
   * Supabase returns tokens in the format: #access_token=xxx&refresh_token=yyy
   */
  private parseHashFragment(): Record<string, string> {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) {
      return {};
    }

    const params: Record<string, string> = {};
    const hashString = hash.substring(1); // Remove the #
    const pairs = hashString.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    }

    return params;
  }

  /**
   * Handle auth callback with tokens from Supabase
   * @param hashParams Auth tokens from URL hash
   * @param queryToken Optional token from query params (invite token)
   */
  private async handleAuthCallback(hashParams: Record<string, string>, queryToken?: string): Promise<void> {
    try {
      const access_token = hashParams['access_token'];
      const refresh_token = hashParams['refresh_token'];

      if (!access_token) {
        this.handleError('No access token received');
        return;
      }

      // Set the Supabase session
      const { data: { session }, error } = await this.supabaseService.client.auth.setSession({
        access_token,
        refresh_token: refresh_token || '',
      });

      if (error) {
        console.error('Failed to set Supabase session', error);
        this.handleError('Failed to complete authentication. Please try again.');
        return;
      }

      if (!session) {
        this.handleError('No session established');
        return;
      }

      await this.handleResolvedSession(session, queryToken);
    } catch (error) {
      console.error('Error handling auth callback', error);
      this.handleError('Authentication failed. Please try again.');
    }
  }

  private async handleCodeCallback(code: string, queryToken?: string): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Failed to exchange Supabase auth code', error);
        this.handleError('Failed to complete authentication. Please try again.');
        return;
      }

      if (!data.session) {
        this.handleError('No session established');
        return;
      }

      await this.handleResolvedSession(data.session, queryToken);
    } catch (error) {
      console.error('Error handling Supabase auth code callback', error);
      this.handleError('Authentication failed. Please try again.');
    }
  }

  private async handleTokenHashCallback(
    tokenHash: string,
    authType: string,
    queryToken?: string
  ): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client.auth.verifyOtp({
        token_hash: tokenHash,
        type: authType as EmailOtpType,
      });

      if (error) {
        console.error('Failed to verify Supabase invite token hash', error);
        this.handleError('Failed to verify invite link. Please request a new invite.');
        return;
      }

      if (!data.session) {
        this.handleError('No session established');
        return;
      }

      await this.handleResolvedSession(data.session, queryToken);
    } catch (error) {
      console.error('Error handling Supabase token hash callback', error);
      this.handleError('Authentication failed. Please try again.');
    }
  }

  private async handleResolvedSession(session: Session, queryToken?: string): Promise<void> {
    console.log('Supabase session established', {
      user: session.user?.email,
    });

    let storedInvite = this.getStoredInvite();

    const userMetadata = session.user?.user_metadata as Record<string, string> | undefined;
    const metadataToken = userMetadata?.['invite_token'];
    const metadataRole = userMetadata?.['role'];

    if (!storedInvite && queryToken) {
      storedInvite = {
        token: queryToken,
        role: metadataRole || 'volunteer',
        email: session.user?.email || '',
      };
    }

    if (!storedInvite && metadataToken) {
      storedInvite = {
        token: metadataToken,
        role: metadataRole || 'volunteer',
        email: session.user?.email || '',
      };
      console.log('Using invite token from Supabase metadata', {
        token: metadataToken,
        role: metadataRole,
      });
    }

    if (storedInvite) {
      this.inviteService.validateInvite(storedInvite.token).subscribe({
        next: (response) => {
          if (response.success) {
            const role = response.data?.role || storedInvite.role;
            this.redirectToSignup(storedInvite.token, role);
          } else {
            this.handleError('Invalid or expired invite. Please request a new invite.');
          }
        },
        error: () => {
          this.handleError('Failed to validate invite. Please try again.');
        },
      });

      return;
    }

    if (metadataRole) {
      this.redirectToSignupByRole(metadataRole);
      return;
    }

    this.router.navigate(['/login']);
  }

  /**
   * Get stored invite information from localStorage
   */
  private getStoredInvite(): { token: string; role: string; email: string } | null {
    try {
      const stored = localStorage.getItem('pending_invite');
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as Record<string, string>;

      // Check if invite has expired (7 days)
      if (parsed['timestamp']) {
        const storedTime = new Date(parsed['timestamp']).getTime();
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (now - storedTime > sevenDays) {
          localStorage.removeItem('pending_invite');
          return null;
        }
      }

      return {
        token: parsed['token'],
        role: parsed['role'],
        email: parsed['email'],
      };
    } catch (error) {
      console.error('Error reading stored invite', error);
      localStorage.removeItem('pending_invite');
      return null;
    }
  }

  /**
   * Redirect to the appropriate signup form based on role and token
   */
  private redirectToSignup(token: string, role: string): void {
    // Clear the stored invite after retrieval
    localStorage.removeItem('pending_invite');

    const routes: Record<string, string> = {
      volunteer: '/signup-form',
      admin: '/admin-auth',
      coordinator: '/signup',
    };

    const baseRoute = routes[role] || '/signup';
    const queryParams: Record<string, string> = { token };

    // For admin route, also set tab=signup
    if (role === 'admin') {
      queryParams['tab'] = 'signup';
    }

    console.log('Redirecting to signup', { role, route: baseRoute });

    this.router.navigate([baseRoute], { queryParams });
  }

  /**
   * Redirect based on role only (when no invite token available)
   */
  private redirectToSignupByRole(role: string): void {
    const routes: Record<string, string> = {
      volunteer: '/signup-form',
      admin: '/admin-auth',
      coordinator: '/signup',
    };

    const route = routes[role] || '/signup';
    const queryParams: Record<string, string> = role === 'admin' ? { tab: 'signup' } : {};

    this.router.navigate([route], { queryParams });
  }

  /**
   * Handle errors and show error message
   */
  private handleError(message: string): void {
    this.statusMessage = '';
    this.errorMessage = message;
    console.error('Supabase auth callback error', { message });
  }

  /**
   * Navigate to login page
   */
  goToLogin(): void {
    localStorage.removeItem('pending_invite');
    this.router.navigate(['/login']);
  }
}
