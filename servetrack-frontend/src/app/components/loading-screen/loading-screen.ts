import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-loading-screen',
  templateUrl: './loading-screen.html',
  styleUrl: './loading-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class LoadingScreenComponent {}
