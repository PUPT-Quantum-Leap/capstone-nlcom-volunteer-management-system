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
import { VolunteerService } from '../../services/volunteer.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Attendance, AttendancePeriod } from '../../models/attendance';

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
      .getAttendance(this.attendancePeriod(), this.attendanceSearchQuery() || undefined)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((response) => {
        if (response.success) {
          this.attendanceItems.set(response.data ?? []);
        }
        this.isLoading.set(false);
      });
  }

  setAttendancePeriod(period: AttendancePeriod): void {
    this.attendancePeriod.set(period);
    this.loadAttendance();
  }

  searchAttendance(query: string): void {
    this.attendanceSearchQuery.set(query);
    this.loadAttendance();
  }

  onPeriodChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.setAttendancePeriod(select.value as AttendancePeriod);
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchAttendance(input.value);
  }

  getAttendanceStatusClass(status: string): string {
    if (status === 'approved') return 'confirmed';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  }
}
