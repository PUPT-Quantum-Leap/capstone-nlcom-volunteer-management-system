<<<<<<< HEAD
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
=======
import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
>>>>>>> origin/main

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
<<<<<<< HEAD
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('servetrack-frontend');
}

=======
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('servetrack-frontend');
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.authService.checkAuthStatus$().subscribe();
  }
}
>>>>>>> origin/main
