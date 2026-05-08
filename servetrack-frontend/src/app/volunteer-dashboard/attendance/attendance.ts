import {
  ChangeDetectionStrategy,
  // Re-compile trigger
  Component,
  inject,
  OnInit,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { VolunteerService, AttendancePeriod } from '../../services/volunteer.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Attendance } from '../../models/attendance';

@Component({
  selector: 'app-attendance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe],
  templateUrl: './attendance.html',
  styleUrl: './attendance.scss',
})
export class AttendanceComponent implements OnInit {
  private volunteerService = inject(VolunteerService);
  private destroyRef = inject(DestroyRef);

  // ── Attendance State ────────────────────────────────────────────────────
  attendancePeriod = signal<AttendancePeriod>('monthly');
  attendanceItems = signal<Attendance[]>([]);
  attendanceSearchQuery = signal('');
  isLoading = signal(false);
  isDateDropdownOpen = signal(false);

  // ── Custom Range State ──────────────────────────────────────────────────
  customStartDate = signal<string | null>(null);
  customEndDate = signal<string | null>(null);
  
  // ── Calendar Display State ──────────────────────────────────────────────
  currentCalendarMonth = signal(new Date());
  calendarDays = computed(() => {
    const date = this.currentCalendarMonth();
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  });

  monthLabel = computed(() => {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
      .format(this.currentCalendarMonth());
  });

  toggleDateDropdown(): void {
    this.isDateDropdownOpen.update(v => !v);
  }

  getSelectedPeriodLabel(): string {
    const period = this.attendancePeriod();
    if (period === 'custom' && this.customStartDate() && this.customEndDate()) {
      const start = new Date(this.customStartDate()!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = new Date(this.customEndDate()!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${start} - ${end}`;
    }

    switch (period) {
      case 'daily': return 'Today';
      case 'weekly': return 'This Week';
      case 'monthly': return 'This Month';
      case 'all': return 'All Time';
      case 'custom': return 'Custom Range';
      default: return 'Select Period';
    }
  }

  // ── Computed Stats ──────────────────────────────────────────────────────
  filteredItems = computed(() => {
    const query = this.attendanceSearchQuery().toLowerCase();
    if (!query) return this.attendanceItems();
    return this.attendanceItems().filter(item =>
      item.description?.toLowerCase().includes(query) ||
      item.location?.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.loadAttendance();
  }

  loadAttendance(): void {
    this.isLoading.set(true);
    this.volunteerService
      .getAttendance(
        this.attendancePeriod(), 
        this.attendanceSearchQuery() || undefined,
        this.customStartDate() || undefined,
        this.customEndDate() || undefined
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((response) => {
        if (response.success) {
          this.attendanceItems.set(response.data ?? []);
        }
      });
  }

  setAttendancePeriod(period: AttendancePeriod): void {
    this.attendancePeriod.set(period);
    if (period !== 'custom') {
      this.customStartDate.set(null);
      this.customEndDate.set(null);
    }
    this.loadAttendance();
  }

  searchAttendance(query: string): void {
    this.attendanceSearchQuery.set(query);
    this.loadAttendance();
  }

  onPeriodChange(period: string): void {
    this.setAttendancePeriod(period as AttendancePeriod);
    this.isDateDropdownOpen.set(false);
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchAttendance(input.value);
  }

  // ── Calendar Logic ───────────────────────────────────────────────────────
  onDayClick(day: number): void {
    const year = this.currentCalendarMonth().getFullYear();
    const month = this.currentCalendarMonth().getMonth();
    const selectedDate = new Date(year, month, day);
    const dateStr = selectedDate.toISOString().split('T')[0];

    if (!this.customStartDate() || (this.customStartDate() && this.customEndDate())) {
      // Start new range
      this.customStartDate.set(dateStr);
      this.customEndDate.set(null);
      this.attendancePeriod.set('custom');
    } else {
      // Set end date
      const start = new Date(this.customStartDate()!);
      if (selectedDate < start) {
        // Swap if backward
        this.customEndDate.set(this.customStartDate());
        this.customStartDate.set(dateStr);
      } else {
        this.customEndDate.set(dateStr);
      }
      this.loadAttendance();
      // Optional: close dropdown after range selected
      // this.isDateDropdownOpen.set(false);
    }
  }

  isDaySelected(day: number): boolean {
    const year = this.currentCalendarMonth().getFullYear();
    const month = this.currentCalendarMonth().getMonth();
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    
    return dateStr === this.customStartDate() || dateStr === this.customEndDate();
  }

  isDayInRange(day: number): boolean {
    if (!this.customStartDate() || !this.customEndDate()) return false;
    
    const year = this.currentCalendarMonth().getFullYear();
    const month = this.currentCalendarMonth().getMonth();
    const date = new Date(year, month, day);
    const start = new Date(this.customStartDate()!);
    const end = new Date(this.customEndDate()!);
    
    return date > start && date < end;
  }

  isToday(day: number): boolean {
    const today = new Date();
    const current = this.currentCalendarMonth();
    return day === today.getDate() && 
           current.getMonth() === today.getMonth() && 
           current.getFullYear() === today.getFullYear();
  }

  changeMonth(delta: number): void {
    const nextMonth = new Date(this.currentCalendarMonth());
    nextMonth.setMonth(nextMonth.getMonth() + delta);
    this.currentCalendarMonth.set(nextMonth);
  }

  getAttendanceStatusClass(status: string): string {
    if (status === 'approved') return 'confirmed';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  }
}
