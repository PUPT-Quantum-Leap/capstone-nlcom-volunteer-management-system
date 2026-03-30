import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReportData {
  totalVolunteers: number;
  activeVolunteers: number;
  inactiveVolunteers: number;
  totalHoursServed: number;
  averageAttendanceRate: number;
  totalTasksCompleted: number;
  averageRating: number;
  departmentBreakdown: DepartmentStat[];
  monthlyTrend: MonthlyStat[];
  topPerformers: TopPerformer[];
  recentActivity: ActivityItem[];
}

export interface DepartmentStat {
  name: string;
  count: number;
  percentage: number;
}

export interface MonthlyStat {
  month: string;
  volunteers: number;
  hours: number;
  tasks: number;
}

export interface TopPerformer {
  id: number;
  name: string;
  department: string;
  hoursServed: number;
  attendanceRate: number;
  rating: number;
}

export interface ActivityItem {
  id: number;
  type: 'registration' | 'attendance' | 'task' | 'event';
  description: string;
  volunteerName: string;
  timestamp: string;
}

export interface AnalyticsResponse {
  success: boolean;
  data: ReportData;
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/analytics`;

  getReportData(): Observable<AnalyticsResponse> {
    return this.http
      .get<AnalyticsResponse>(`${this.baseUrl}/reports`, {
        withCredentials: true,
      })
      .pipe(
        catchError(() =>
          of({
            success: false,
            data: this.getMockReportData(),
          })
        )
      );
  }

  exportReport(format: 'pdf' | 'excel'): Observable<Blob> {
    return this.http
      .get(`${this.baseUrl}/export/${format}`, {
        withCredentials: true,
        responseType: 'blob',
      })
      .pipe(
        catchError(() => {
          const mockData = this.generateMockExportData();
          const blob = new Blob([mockData], {
            type:
              format === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          return of(blob);
        })
      );
  }

  private getMockReportData(): ReportData {
    return {
      totalVolunteers: 156,
      activeVolunteers: 128,
      inactiveVolunteers: 28,
      totalHoursServed: 2450,
      averageAttendanceRate: 87,
      totalTasksCompleted: 342,
      averageRating: 4.3,
      departmentBreakdown: [
        { name: 'Medical', count: 45, percentage: 29 },
        { name: 'Rescue', count: 38, percentage: 24 },
        { name: 'Logistics', count: 32, percentage: 21 },
        { name: 'Communications', count: 25, percentage: 16 },
        { name: 'Admin', count: 16, percentage: 10 },
      ],
      monthlyTrend: [
        { month: 'Jan', volunteers: 12, hours: 180, tasks: 24 },
        { month: 'Feb', volunteers: 15, hours: 220, tasks: 31 },
        { month: 'Mar', volunteers: 18, hours: 280, tasks: 42 },
        { month: 'Apr', volunteers: 22, hours: 340, tasks: 48 },
        { month: 'May', volunteers: 20, hours: 310, tasks: 45 },
        { month: 'Jun', volunteers: 25, hours: 380, tasks: 52 },
      ],
      topPerformers: [
        {
          id: 1,
          name: 'John Smith',
          department: 'Medical',
          hoursServed: 120,
          attendanceRate: 98,
          rating: 4.9,
        },
        {
          id: 2,
          name: 'Sarah Johnson',
          department: 'Rescue',
          hoursServed: 115,
          attendanceRate: 95,
          rating: 4.8,
        },
        {
          id: 3,
          name: 'Mike Davis',
          department: 'Logistics',
          hoursServed: 108,
          attendanceRate: 92,
          rating: 4.7,
        },
        {
          id: 4,
          name: 'Emily Chen',
          department: 'Medical',
          hoursServed: 105,
          attendanceRate: 90,
          rating: 4.6,
        },
        {
          id: 5,
          name: 'Robert Wilson',
          department: 'Communications',
          hoursServed: 98,
          attendanceRate: 88,
          rating: 4.5,
        },
      ],
      recentActivity: [
        {
          id: 1,
          type: 'registration',
          description: 'New volunteer registered',
          volunteerName: 'Alice Brown',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 2,
          type: 'attendance',
          description: 'Marked present at Community Event',
          volunteerName: 'Bob Smith',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 3,
          type: 'task',
          description: 'Completed task: Equipment Inventory',
          volunteerName: 'Carol White',
          timestamp: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          id: 4,
          type: 'event',
          description: 'Participated in Disaster Drill',
          volunteerName: 'David Lee',
          timestamp: new Date(Date.now() - 14400000).toISOString(),
        },
        {
          id: 5,
          type: 'registration',
          description: 'New volunteer registered',
          volunteerName: 'Eve Martinez',
          timestamp: new Date(Date.now() - 18000000).toISOString(),
        },
      ],
    };
  }

  private generateMockExportData(): string {
    return 'Mock export data for demonstration';
  }

  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
