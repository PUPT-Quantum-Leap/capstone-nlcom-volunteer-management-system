import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { VolunteerService } from '../../services/volunteer.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Attendance, AttendancePeriod } from '../../models/attendance';

@Component({
  selector: 'app-attendance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
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
      item.time_slot?.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query) ||
      this.getDisplayStatus(item.status).toLowerCase().includes(query)
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
          console.log('Attendance data received:', response.data);
          response.data?.forEach((item, i) => {
            console.log(`Item ${i}: hours=`, item.hours, 'type=', typeof item.hours);
          });
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
    if (status === 'approved' || status === 'present') return 'status-present';
    if (status === 'rejected' || status === 'absent') return 'status-absent';
    // Default pending/null to present
    return 'status-present';
  }

  getDisplayStatus(status: string | null | undefined): string {
    if (status === 'rejected' || status === 'absent') {
      return 'Absent';
    }
    // Default to Present for approved, pending, null, etc.
    return 'Present';
  }
}
