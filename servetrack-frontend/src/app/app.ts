import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('servetrack-frontend');
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.authService.checkAuthStatus$().subscribe();
  }
}

