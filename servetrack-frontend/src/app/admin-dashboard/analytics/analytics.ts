import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AnalyticsService, ReportData } from '../../services/analytics.service';

@Component({
  selector: 'app-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
})
export class AnalyticsComponent {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly analyticsLoading = signal(false);
  readonly reportData = signal<ReportData | null>(null);
  readonly selectedReportType = signal<
    'volunteers' | 'attendance' | 'performance' | 'department' | 'trends'
  >('volunteers');
  readonly dateRangeFilter = signal<'all' | 'month' | 'quarter' | 'year'>('all');
  readonly selectedDepartmentFilter = signal<string | null>(null);
  readonly skillsPage = signal(1);
  readonly skillsPerPage = signal(3);
  readonly departmentsPage = signal(1);
  readonly departmentsPerPage = signal(3);

  readonly paginatedSkills = computed(() => {
    const data = this.reportData()?.skillsDistribution.skills ?? [];
    const start = (this.skillsPage() - 1) * this.skillsPerPage();
    return data.slice(start, start + this.skillsPerPage());
  });

  readonly totalSkillsPages = computed(() => {
    const total = this.reportData()?.skillsDistribution.skills.length ?? 0;
    return Math.max(1, Math.ceil(total / this.skillsPerPage()));
  });

  readonly hasMoreSkills = computed(
    () => (this.reportData()?.skillsDistribution.skills.length ?? 0) > this.skillsPerPage(),
  );

  readonly paginatedDepartments = computed(() => {
    const data = this.reportData()?.departmentBreakdown ?? [];
    const start = (this.departmentsPage() - 1) * this.departmentsPerPage();
    return data.slice(start, start + this.departmentsPerPage());
  });

  readonly totalDepartmentsPages = computed(() => {
    const total = this.reportData()?.departmentBreakdown.length ?? 0;
    return Math.max(1, Math.ceil(total / this.departmentsPerPage()));
  });

  readonly hasMoreDepartments = computed(
    () => (this.reportData()?.departmentBreakdown.length ?? 0) > this.departmentsPerPage(),
  );

  readonly maxSkillCount = computed(() => {
    const skills = this.reportData()?.skillsDistribution.skills ?? [];
    return Math.max(...skills.map(s => s.count), 1);
  });

  constructor() {
    this.loadAnalyticsData();
  }

  calculateSkillPercentage(count: number): number {
    return Math.round((count / this.maxSkillCount()) * 100);
  }

  setReportType(type: 'volunteers' | 'attendance' | 'performance' | 'department' | 'trends'): void {
    this.selectedReportType.set(type);
  }

  setDateRange(range: 'all' | 'month' | 'quarter' | 'year'): void {
    this.dateRangeFilter.set(range);
    this.skillsPage.set(1);
    this.departmentsPage.set(1);
    this.loadAnalyticsData();
  }

  setDepartmentFilter(department: string | null): void {
    this.selectedDepartmentFilter.set(department);
    this.skillsPage.set(1);
    this.departmentsPage.set(1);
    this.loadAnalyticsData();
  }

  onDepartmentFilterChange(value: string): void {
    this.setDepartmentFilter(value || null);
  }

  nextSkillsPage(): void {
    if (this.skillsPage() < this.totalSkillsPages()) {
      this.skillsPage.update((page) => page + 1);
    }
  }

  previousSkillsPage(): void {
    if (this.skillsPage() > 1) {
      this.skillsPage.update((page) => page - 1);
    }
  }

  nextDepartmentsPage(): void {
    if (this.departmentsPage() < this.totalDepartmentsPages()) {
      this.departmentsPage.update((page) => page + 1);
    }
  }

  previousDepartmentsPage(): void {
    if (this.departmentsPage() > 1) {
      this.departmentsPage.update((page) => page - 1);
    }
  }

  exportReport(format: 'pdf' | 'excel'): void {
    this.analyticsLoading.set(true);

    const exportRequest =
      format === 'pdf'
        ? this.analyticsService.exportToPdf(
            this.dateRangeFilter(),
            this.selectedDepartmentFilter() || undefined,
          )
        : this.analyticsService.exportToExcel(
            this.dateRangeFilter(),
            this.selectedDepartmentFilter() || undefined,
          );

    exportRequest.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const timestamp = new Date().toISOString().split('T')[0];
        const extension = format === 'pdf' ? 'pdf' : 'xlsx';
        this.analyticsService.downloadFile(
          blob,
          `servetrack-analytics-report-${timestamp}.${extension}`,
        );
        this.analyticsLoading.set(false);
      },
      error: (error: Error) => {
        console.error(`Error exporting ${format} report:`, error);
        this.analyticsLoading.set(false);
      },
    });
  }

  private loadAnalyticsData(): void {
    this.analyticsLoading.set(true);

    this.analyticsService
      .getReportData(this.dateRangeFilter(), this.selectedDepartmentFilter() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.reportData.set(response.data);
          this.analyticsLoading.set(false);
        },
        error: (error: Error) => {
          console.error('Error loading analytics data:', error);
          this.analyticsLoading.set(false);
        },
      });
  }
}
