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

interface Operation {
  id: number;
  team: string;
  location: string;
  time: string;
  participants: number;
  details: string;
}

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

  // Operations Report Data (Hardcoded)
  readonly operationsData = signal<Operation[]>([
    {
      id: 1,
      team: 'TEAM ALPHA',
      location: 'Golden Acres (Talon 1)',
      time: '8:00am - 9:30am',
      participants: 100,
      details: 'Team Alpha: drop off GA team before proceeding to VP. GA team to wait after feeding for pick up.',
    },
    {
      id: 2,
      team: 'TEAM ALPHA',
      location: 'Villa Pangarap (Talon 5)',
      time: '8:00am - 9:30am',
      participants: 150,
      details: 'Team Alpha: Park vehicle in VP. After feeding, pick up GA team and go directly to Annex.',
    },
    {
      id: 3,
      team: 'TEAM ALPHA',
      location: 'Annex (Talon 5)',
      time: '09:00am-12:00n',
      participants: 150,
      details: 'Team Alpha: Whole team will proceed to Annex after the 2 sites before heading back to base.',
    },
    {
      id: 4,
      team: 'TEAM BRAVO',
      location: 'Market 3',
      time: '8:30am - 10:00am',
      participants: 200,
      details: 'Team Bravo: Whole team to proceed to M3 until feeding. The same team will be going to the second site (NBBN) after M3 before heading back to base.',
    },
    {
      id: 5,
      team: 'TEAM BRAVO',
      location: 'NBBN',
      time: '11:00am - 12:30pm',
      participants: 170,
      details: 'Team Bravo: NBBN site operations',
    },
    {
      id: 6,
      team: 'TEAM CHARLIE',
      location: 'Masville',
      time: '09:00am-12:00nn',
      participants: 350,
      details: 'Team Charlie1: whole team to proceed to Masville',
    },
    {
      id: 7,
      team: 'TEAM CHARLIE',
      location: 'Banal',
      time: '09:00am-10:30am',
      participants: 250,
      details: 'Team Charlie2: whole team to proceed to Banal',
    },
    {
      id: 8,
      team: 'TEAM DELTA',
      location: 'Sitio Pagkakaisa Zone',
      time: '2:00pm-3:30pm',
      participants: 300,
      details: 'Team Delta1: whole team to transport food via pedicab to reach Sitio Pagkakaisa',
    },
    {
      id: 9,
      team: 'TEAM DELTA',
      location: 'Sucat Highway',
      time: '3:30pm-4:30pm',
      participants: 300,
      details: 'Team Delta2: whole team to proceed to Sucat Highway',
    },
    {
      id: 10,
      team: 'TEAM ECHO',
      location: 'Delpan',
      time: '3:30pm-4:30pm',
      participants: 220,
      details: 'Team Echo: whole team to proceed to Delpan',
    },
    {
      id: 11,
      team: 'TEAM FOXTROT',
      location: 'Paraiso (Alabang)',
      time: '2:00pm - 4:00pm',
      participants: 100,
      details: 'Team Foxtrot: drop off Paraiso team before proceeding to Sunrise. Paraiso to wait after feeding for pick up',
    },
    {
      id: 12,
      team: 'TEAM FOXTROT',
      location: 'Sunrise (Bayananan)',
      time: '2:00pm - 4:00pm',
      participants: 100,
      details: 'Team Foxtrot: Park vehicle in Sunrise. After feeding, pick up Paraiso team and head back to base.',
    },
  ]);

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

  exportOperationsTable(format: 'pdf' | 'excel'): void {
    this.analyticsLoading.set(true);

    try {
      if (format === 'pdf') {
        this.exportOperationsToPdf();
      } else {
        this.exportOperationsToExcel();
      }
      this.analyticsLoading.set(false);
    } catch (error) {
      console.error(`Error exporting operations ${format}:`, error);
      this.analyticsLoading.set(false);
    }
  }

  private exportOperationsToPdf(): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `operations-report-${timestamp}.pdf`;
    
    // Simple PDF generation using HTML table
    const html = this.generateOperationsTableHTML();
    const blob = new Blob([html], { type: 'text/html' });
    this.analyticsService.downloadFile(blob, filename);
  }

  private exportOperationsToExcel(): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `operations-report-${timestamp}.xlsx`;

    const csv = this.generateOperationsTableCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    this.analyticsService.downloadFile(blob, filename);
  }

  private generateOperationsTableHTML(): string {
    const rows = this.operationsData()
      .map(
        (op) => `
      <tr>
        <td>${op.team}</td>
        <td>${op.location}</td>
        <td>${op.time}</td>
        <td>${op.participants}</td>
        <td>${op.details}</td>
      </tr>
    `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Operations Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h2 { margin-bottom: 10px; }
          p { margin: 5px 0 20px 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #333; padding: 10px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h2>NLCOM x Metro World Child Feeding Operation</h2>
        <p>November 22, 2025</p>
        <table>
          <thead>
            <tr>
              <th>Team & Time Departure</th>
              <th>Location</th>
              <th>Time</th>
              <th>No. of Pax</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
      </html>
    `;
  }

  private generateOperationsTableCSV(): string {
    const headers = ['Team & Time Departure', 'Location', 'Time', 'No. of Pax', 'Details'];
    const rows = this.operationsData().map((op) => [
      op.team,
      op.location,
      op.time,
      op.participants.toString(),
      op.details,
    ]);

    const csvContent = [
      'NLCOM x Metro World Child Feeding Operation',
      'November 22, 2025',
      '',
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');

    return csvContent;
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
