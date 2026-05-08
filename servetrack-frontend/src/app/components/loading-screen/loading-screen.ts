import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-loading-screen',
  templateUrl: './loading-screen.html',
  styleUrl: './loading-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class LoadingScreenComponent implements OnInit {
  progress = signal(0);

  ngOnInit(): void {
    console.log('LoadingScreenComponent initialized');
    const totalDuration = 4000;
    const intervalTime = 16;
    const steps = totalDuration / intervalTime;
    const increment = 100 / steps;

    const interval = setInterval(() => {
      const currentProgress = this.progress();
      const nextValue = Math.min(currentProgress + increment, 100);
      
      this.progress.set(nextValue);
      console.log('Progress:', nextValue);

      if (nextValue >= 100) {
        clearInterval(interval);
      }
    }, intervalTime);
  }
}
