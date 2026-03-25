import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ClockComponent } from '../clock/clock.component';
import { WelcomeComponent } from '../welcome/welcome.component';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [ClockComponent, WelcomeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-header.component.html',
  styleUrl: './admin-header.component.scss',
})
export class AdminHeaderComponent {}
