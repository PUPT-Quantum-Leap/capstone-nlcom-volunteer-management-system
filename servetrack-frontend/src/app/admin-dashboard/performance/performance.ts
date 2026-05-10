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
import { AdminDashboardService } from '../../services/admin-dashboard.service';
import { PerformanceMetric } from '../../models/performance-metric';

import { CustomSelect, SelectOption } from '../../components/custom-select/custom-select';

@Component({
  selector: 'app-performance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CustomSelect],
  templateUrl: './performance.html',
  styleUrl: './performance.scss',
})
export class PerformanceComponent {
  private readonly adminDashboardService = inject(AdminDashboardService);
  private readonly destroyRef = inject(DestroyRef);

  // Dropdown Options
  sortOptions: SelectOption[] = [
    { label: 'Sort by Attendance', value: 'attendance' },
    { label: 'Sort by Hours', value: 'hours' },
    { label: 'Sort by Name', value: 'name' },
    { label: 'Sort by Tasks', value: 'tasks' },
    { label: 'Sort by Rating', value: 'rating' }
  ];

  readonly Math = Math;
  readonly performanceMetrics = signal<PerformanceMetric[]>([]);
  readonly sortField = signal<'name' | 'attendance' | 'hours' | 'tasks' | 'rating'>('attendance');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly performancePage = signal(1);
  readonly performancePerPage = signal(10);

  readonly sortedPerformanceMetrics = computed(() => {
    const metrics = [...this.performanceMetrics()];
    const field = this.sortField();
    const direction = this.sortDirection();

    metrics.sort((left, right) => {
      let leftValue: number | string;
      let rightValue: number | string;

      switch (field) {
        case 'name':
          leftValue = left.volunteerName;
          rightValue = right.volunteerName;
          break;
        case 'attendance':
          leftValue = left.attendanceRate;
          rightValue = right.attendanceRate;
          break;
        case 'hours':
          leftValue = left.hoursServed;
          rightValue = right.hoursServed;
          break;
        case 'tasks':
          leftValue = left.tasksCompleted;
          rightValue = right.tasksCompleted;
          break;
        case 'rating':
          leftValue = left.rating;
          rightValue = right.rating;
          break;
      }

      if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        return direction === 'asc'
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue);
      }

      return direction === 'asc'
        ? (leftValue as number) - (rightValue as number)
        : (rightValue as number) - (leftValue as number);
    });

    return metrics;
  });

  readonly paginatedPerformanceMetrics = computed(() => {
    const start = (this.performancePage() - 1) * this.performancePerPage();
    return this.sortedPerformanceMetrics().slice(start, start + this.performancePerPage());
  });

  readonly performanceTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.sortedPerformanceMetrics().length / this.performancePerPage())),
  );

  readonly topPerformer = computed(() => {
    const metrics = this.performanceMetrics();
    if (metrics.length === 0) {
      return null;
    }

    return metrics.reduce((top, current) =>
      current.hoursServed > top.hoursServed ? current : top,
    );
  });

  constructor() {
    this.loadPerformanceData();
  }

  sortBy(field: 'name' | 'attendance' | 'hours' | 'tasks' | 'rating'): void {
    if (this.sortField() === field) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }

    this.performancePage.set(1);
  }

  previousPerformancePage(): void {
    if (this.performancePage() > 1) {
      this.performancePage.update((page) => page - 1);
    }
  }

  nextPerformancePage(): void {
    if (this.performancePage() < this.performanceTotalPages()) {
      this.performancePage.update((page) => page + 1);
    }
  }

  goToPerformancePage(page: number): void {
    if (page >= 1 && page <= this.performanceTotalPages()) {
      this.performancePage.set(page);
    }
  }

  getPerformancePageNumbers(): number[] {
    const total = this.performanceTotalPages();
    const current = this.performancePage();
    const pages: number[] = [];

    if (total <= 7) {
      for (let page = 1; page <= total; page += 1) {
        pages.push(page);
      }
    } else {
      pages.push(1);

      if (current > 3) {
        pages.push(-1);
      }

      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let page = start; page <= end; page += 1) {
        pages.push(page);
      }

      if (current < total - 2) {
        pages.push(-1);
      }

      pages.push(total);
    }

    return pages;
  }

  private loadPerformanceData(): void {
    this.adminDashboardService
      .getDashboardData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.performanceMetrics.set(response.success ? (response.data.performanceMetrics ?? []) : []);
      });
  }
}
