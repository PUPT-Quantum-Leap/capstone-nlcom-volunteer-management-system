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
import { AnalyticsService, ReportData, DepartmentStat } from '../../services/analytics.service';

import { CustomSelect, SelectOption } from '../../components/custom-select/custom-select';

@Component({
  selector: 'app-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CustomSelect],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
})
export class AnalyticsComponent {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly destroyRef = inject(DestroyRef);

  // Dropdown Options
  dateRangeOptions: SelectOption<'all' | 'month' | 'quarter' | 'year'>[] = [
    { label: 'All Time', value: 'all' },
    { label: 'This Month', value: 'month' },
    { label: 'This Quarter', value: 'quarter' },
    { label: 'This Year', value: 'year' }
  ];

  departmentSelectOptions = computed<SelectOption<string>[]>(() => {
    const options: SelectOption<string>[] = [{ label: 'All Departments', value: '' }];
    this.departmentOptions().forEach(dept => {
      options.push({ label: dept.name, value: dept.name });
    });
    return options;
  });

  readonly analyticsLoading = signal(false);
  readonly reportData = signal<ReportData | null>(null);
  readonly departmentOptions = signal<DepartmentStat[]>([]);
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
    const filteredData = data.filter(skill => skill.count > 0);
    const start = (this.skillsPage() - 1) * this.skillsPerPage();
    return filteredData.slice(start, start + this.skillsPerPage());
  });

  readonly totalSkillsPages = computed(() => {
    const data = this.reportData()?.skillsDistribution.skills ?? [];
    const filteredData = data.filter(skill => skill.count > 0);
    const total = filteredData.length;
    return Math.max(1, Math.ceil(total / this.skillsPerPage()));
  });

  readonly hasMoreSkills = computed(() => {
    const data = this.reportData()?.skillsDistribution.skills ?? [];
    const filteredData = data.filter(skill => skill.count > 0);
    return filteredData.length > this.skillsPerPage();
  });

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

  private loadDepartmentOptions(): void {
    this.analyticsService
      .getReportData('all')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.departmentOptions.set(response.data.departmentBreakdown);
          }
        },
        error: (error: Error) => {
          console.error('Error loading department options:', error);
        },
      });
  }

  private loadAnalyticsData(): void {
    this.analyticsLoading.set(true);

    const dateRange = this.dateRangeFilter();
    const department = this.selectedDepartmentFilter() || undefined;

    this.analyticsService
      .getReportData(dateRange, department)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.reportData.set(response.data);
            if (!this.selectedDepartmentFilter()) {
              this.departmentOptions.set(response.data.departmentBreakdown);
            }
          }
          this.analyticsLoading.set(false);
        },
        error: (error: Error) => {
          console.error('Error loading analytics data:', error);
          this.analyticsLoading.set(false);
        },
      });
  }
}
