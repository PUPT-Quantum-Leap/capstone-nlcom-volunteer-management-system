import {
  Component,
  OnInit,
  signal,
  computed,
  DestroyRef,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'app-clock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clock.component.html',
  styleUrl: './clock.component.scss',
})
export class ClockComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  // Clock signals
  currentTime = signal('');
  currentDate = signal('');
  currentDay = signal('');

  ngOnInit(): void {
    this.initializeClock();
  }

  private initializeClock(): void {
    this.updateClock();
    const intervalId = setInterval(() => this.updateClock(), 1000);
    
    // Cleanup on component destruction
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  private updateClock(): void {
    const now = new Date();
    
    // Format time as HH:MM:SS AM/PM
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
    
    this.currentTime.set(`${displayHours}:${minutes}:${seconds} ${period}`);
    
    // Format date as Month Day, Year
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    
    this.currentDate.set(`${month} ${day}, ${year}`);
    
    // Format day of week
    const daysOfWeek = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday'
    ];
    this.currentDay.set(daysOfWeek[now.getDay()]);
  }
}
