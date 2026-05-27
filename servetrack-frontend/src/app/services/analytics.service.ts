import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
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
  eventParticipation: EventParticipation;
  skillsDistribution: SkillsDistribution;
  trainingCompletion: TrainingCompletion;
  lifeGroupDistribution: LifeGroupDistribution;
  retentionMetrics: RetentionMetrics;
  hourlyTrends: HourlyTrend[];
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

export interface EventParticipation {
  totalEvents: number;
  totalResponses: number;
  confirmedCount: number;
  activeEvents: number;
  closedEvents: number;
  responseRate: number;
  events: EventStat[];
}

export interface EventStat {
  id: number;
  title: string;
  date: string;
  responses: number;
  status: string;
}

export interface SkillsDistribution {
  totalSkills: number;
  volunteersWithSkills: number;
  skills: SkillStat[];
}

export interface SkillStat {
  name: string;
  count: number;
  percentage: number;
}

export interface TrainingCompletion {
  totalTrainings: number;
  volunteersWithTraining: number;
  completionRate: number;
  trainings: TrainingStat[];
}

export interface TrainingStat {
  name: string;
  count: number;
  percentage: number;
}

export interface LifeGroupDistribution {
  totalLifegroups: number;
  totalInLifegroups: number;
  leadersCount: number;
  lifegroups: LifeGroupStat[];
}

export interface LifeGroupStat {
  name: string;
  count: number;
}

export interface RetentionMetrics {
  totalVolunteers: number;
  activeLast3Months: number;
  activeLast6Months: number;
  churnedCount: number;
  retentionRate: number;
}

export interface HourlyTrend {
  day: string;
  hours: number;
  entries: number;
}

export interface IcsRsvpData {
  rsvp_id: number;
  title: string;
  date: string;
}

export interface IcsData {
  id: number;
  name: string;
  date: string;
  rsvp: IcsRsvpData;
}

export interface IcsTeamFeedingOperation {
  id: number;
  team: string;
  departure_note: string;
  location: string;
  time: string;
  no_of_pax: number;
  details: string;
  created_at: string;
  updated_at: string;
  ics: IcsData | null;
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

  getReportData(
    dateRange: 'all' | 'month' | 'quarter' | 'year' = 'all',
    department?: string
  ): Observable<AnalyticsResponse> {
    let params = new HttpParams().set('dateRange', dateRange);
    if (department) {
      params = params.set('department', department);
    }
    
    return this.http
      .get<AnalyticsResponse>(`${this.baseUrl}/reports`, {
        params,
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('API call failed:', error);
          return throwError(() => error);
        })
      );
  }

  exportToPdf(
    dateRange: 'all' | 'month' | 'quarter' | 'year' = 'all',
    department?: string,
  ): Observable<Blob> {
    let params = new HttpParams().set('dateRange', dateRange);
    if (department) {
      params = params.set('department', department);
    }

    return this.http
      .get(`${this.baseUrl}/export/pdf`, {
        params,
        withCredentials: true,
        responseType: 'blob',
      })
      .pipe(
        catchError((error) => throwError(() => error))
      );
  }

  exportToExcel(
    dateRange: 'all' | 'month' | 'quarter' | 'year' = 'all',
    department?: string,
  ): Observable<Blob> {
    let params = new HttpParams().set('dateRange', dateRange);
    if (department) {
      params = params.set('department', department);
    }

    return this.http
      .get(`${this.baseUrl}/export/excel`, {
        params,
        withCredentials: true,
        responseType: 'blob',
      })
      .pipe(
        catchError((error) => throwError(() => error))
      );
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

exportPdf(dateRange: 'all' | 'month' | 'quarter' | 'year' = 'all', department?: string): void {
    this.exportToPdf(dateRange, department).subscribe({
      next: (blob) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        this.downloadFile(blob, `volunteer-analytics-${timestamp}.pdf`);
      },
      error: (err) => {
        console.error('PDF export failed:', err);
      },
    });
  }

  exportExcel(dateRange: 'all' | 'month' | 'quarter' | 'year' = 'all', department?: string): void {
    this.exportToExcel(dateRange, department).subscribe({
      next: (blob) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        this.downloadFile(blob, `volunteer-analytics-${timestamp}.xlsx`);
      },
      error: (err) => {
        console.error('Excel export failed:', err);
      },
    });
  }

  getFeedingOperations(): Observable<IcsTeamFeedingOperation[]> {
    return this.http
      .get<IcsTeamFeedingOperation[]>(`${environment.apiUrl}/ics-team`, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('Failed to fetch feeding operations:', error);
          return of([]);
        })
      );
  }

  getTeams(): Observable<string[]> {
    return this.http
      .get<string[]>(`${environment.apiUrl}/teams`, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('Failed to fetch teams:', error);
          return of([]);
        })
      );
  }

  createFeedingOperation(data: Partial<IcsTeamFeedingOperation>): Observable<IcsTeamFeedingOperation> {
    return this.http
      .post<IcsTeamFeedingOperation>(`${environment.apiUrl}/ics-team`, data, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('Failed to create operation:', error);
          throw error;
        })
      );
  }

  updateFeedingOperation(id: number, data: Partial<IcsTeamFeedingOperation>): Observable<IcsTeamFeedingOperation> {
    return this.http
      .put<IcsTeamFeedingOperation>(`${environment.apiUrl}/ics-team/${id}`, data, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('Failed to update operation:', error);
          throw error;
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
          type: 'registration' as const,
          description: 'New volunteer registered',
          volunteerName: 'Alice Brown',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 2,
          type: 'attendance' as const,
          description: 'Marked present at Community Event',
          volunteerName: 'Bob Smith',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 3,
          type: 'task' as const,
          description: 'Completed task: Equipment Inventory',
          volunteerName: 'Carol White',
          timestamp: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          id: 4,
          type: 'event' as const,
          description: 'Participated in Disaster Drill',
          volunteerName: 'David Lee',
          timestamp: new Date(Date.now() - 14400000).toISOString(),
        },
        {
          id: 5,
          type: 'registration' as const,
          description: 'New volunteer registered',
          volunteerName: 'Eve Martinez',
          timestamp: new Date(Date.now() - 18000000).toISOString(),
        },
      ],
      eventParticipation: {
        totalEvents: 45,
        totalResponses: 320,
        confirmedCount: 285,
        activeEvents: 12,
        closedEvents: 33,
        responseRate: 7,
        events: [
          { id: 1, title: 'Community Cleanup', date: '2026-04-15', responses: 45, status: 'closed' },
          { id: 2, title: 'Medical Mission', date: '2026-04-20', responses: 28, status: 'active' },
        ],
      },
      skillsDistribution: {
        totalSkills: 8,
        volunteersWithSkills: 95,
        skills: [
          { name: 'First Aid', count: 45, percentage: 47 },
          { name: 'CPR', count: 42, percentage: 44 },
          { name: 'Driving', count: 38, percentage: 40 },
          { name: 'Communication', count: 35, percentage: 37 },
          { name: 'Logistics', count: 28, percentage: 29 },
        ],
      },
      trainingCompletion: {
        totalTrainings: 5,
        volunteersWithTraining: 78,
        completionRate: 50,
        trainings: [
          { name: 'Orientation', count: 156, percentage: 100 },
          { name: 'Safety Protocols', count: 142, percentage: 91 },
          { name: 'Emergency Response', count: 98, percentage: 63 },
          { name: 'Leadership', count: 45, percentage: 29 },
        ],
      },
      lifeGroupDistribution: {
        totalLifegroups: 12,
        totalInLifegroups: 85,
        leadersCount: 12,
        lifegroups: [
          { name: 'North Cluster', count: 15 },
          { name: 'South Cluster', count: 12 },
          { name: 'East Cluster', count: 10 },
        ],
      },
      retentionMetrics: {
        totalVolunteers: 156,
        activeLast3Months: 98,
        activeLast6Months: 115,
        churnedCount: 58,
        retentionRate: 63,
      },
      hourlyTrends: [
        { day: 'Sun', hours: 120, entries: 15 },
        { day: 'Mon', hours: 85, entries: 12 },
        { day: 'Tue', hours: 92, entries: 14 },
        { day: 'Wed', hours: 78, entries: 11 },
        { day: 'Thu', hours: 95, entries: 13 },
        { day: 'Fri', hours: 110, entries: 16 },
        { day: 'Sat', hours: 145, entries: 18 },
      ],
    };
  }
}
