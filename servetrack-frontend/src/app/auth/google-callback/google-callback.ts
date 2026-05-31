import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-google-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './google-callback.html',
  styleUrl: './google-callback.scss',
})
export class GoogleCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');

    if (!code || !state) {
      this.errorMessage.set('Invalid Google callback. Please try logging in again.');
      return;
    }

    const response = await firstValueFrom(this.authService.exchangeGoogleCode$(code, state));

    if (!response.success || !response.user) {
      this.errorMessage.set(response.message ?? 'Google authentication failed.');
      return;
    }

    if (response.user.needs_profile_completion) {
      await this.router.navigate(['/volunteer/complete-profile']);
    } else {
      await this.router.navigate(['/volunteer-dashboard']);
    }
  }
}
