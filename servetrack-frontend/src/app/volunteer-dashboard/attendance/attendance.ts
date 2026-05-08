import {
  ChangeDetectionStrategy,
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
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'isDateDropdownOpen.set(false)'
  }
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
  calendarCells = computed(() => {
    const date = this.currentCalendarMonth();
    const y = date.getFullYear();
    const m = date.getMonth();
    
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(i);
    }
    return cells;
  });

  firstDayOffset = computed(() => {
    const date = this.currentCalendarMonth();
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
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
      const start = this.parseLocalISO(this.customStartDate()!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = this.parseLocalISO(this.customEndDate()!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  onPeriodChange(period: AttendancePeriod): void {
    if (period === 'custom') {
      this.attendancePeriod.set('custom');
      // Keep dropdown open for range selection
      return;
    }
    this.setAttendancePeriod(period);
    this.isDateDropdownOpen.set(false);
  }

  onCustomRangeClick(): void {
    this.onPeriodChange('custom');
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
    const dateStr = this.toLocalYMD(selectedDate);

    if (!this.customStartDate() || this.customEndDate()) {
      // Start new range
      this.customStartDate.set(dateStr);
      this.customEndDate.set(null);
    } else {
      // Set end date
      const startStr = this.customStartDate()!;
      if (dateStr < startStr) {
        // Swap if backward
        this.customEndDate.set(startStr);
        this.customStartDate.set(dateStr);
      } else if (dateStr === startStr) {
        // Reset if same day
        return;
      } else {
        this.customEndDate.set(dateStr);
      }
      this.loadAttendance();
    }
  }

  isDaySelected(day: number): boolean {
    const year = this.currentCalendarMonth().getFullYear();
    const month = this.currentCalendarMonth().getMonth();
    const dateStr = this.toLocalYMD(new Date(year, month, day));
    
    return dateStr === this.customStartDate() || dateStr === this.customEndDate();
  }

  isDayInRange(day: number): boolean {
    if (!this.customStartDate() || !this.customEndDate()) return false;
    
    const year = this.currentCalendarMonth().getFullYear();
    const month = this.currentCalendarMonth().getMonth();
    const dateStr = this.toLocalYMD(new Date(year, month, day));
    
    return dateStr > this.customStartDate()! && dateStr < this.customEndDate()!;
  }

  private toLocalYMD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseLocalISO(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  isToday(day: number): boolean {
    const today = new Date();
    const current = this.currentCalendarMonth();
    return day === today.getDate() && 
           current.getMonth() === today.getMonth() && 
           current.getFullYear() === today.getFullYear();
  }

  changeMonth(delta: number): void {
    const current = this.currentCalendarMonth();
    // Anchor to day 1 to avoid overflow (e.g. Jan 31 -> Mar 3)
    this.currentCalendarMonth.set(new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.isDateDropdownOpen()) return;
    
    const target = event.target as HTMLElement;
    const dropdown = document.querySelector('.date-filter-dropdown');
    if (dropdown && !dropdown.contains(target)) {
      this.isDateDropdownOpen.set(false);
    }
  }

  getAttendanceStatusClass(status: string): string {
    if (status === 'approved') return 'confirmed';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  }
}
