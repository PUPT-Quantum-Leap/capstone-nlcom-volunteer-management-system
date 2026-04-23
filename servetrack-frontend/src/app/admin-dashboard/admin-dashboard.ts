 import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { 
  FormBuilder, 
  ReactiveFormsModule, 
  Validators, 
  FormArray, 
  AbstractControl, 
  ValidationErrors, 
  ValidatorFn 
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { NotificationItem } from '../models/notification-item';
import { PerformanceMetric } from '../models/performance-metric';
import { AdminDashboardService, DashboardVolunteerRow, VolunteerUser } from '../services/admin-dashboard.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Rsvp, RsvpShift } from '../models/rsvp';
import { RsvpService } from '../services/rsvp.service';
import { User } from '../models/user';
import { UserService } from '../services/user.service';
import { AnalyticsService, ReportData } from '../services/analytics.service';

interface EventModuleCard {
  label: string;
  value: number;
  helper: string;
}

interface BackupRecord {
  id: number;
  name: string;
  file_path: string;
  size_bytes: number;
  type: 'automatic' | 'manual';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface AttendanceRecord {
  id: number;
  volunteerName: string;
  email: string;
  department: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  duration: string | null;
  status: 'present' | 'absent';
}

type DashboardView =
  | 'overview'
  | 'volunteers'
  | 'attendance'
  | 'performance'
  | 'rsvps'
  | 'ics'
  | 'users'
  | 'analytics'
  | 'events'
  | 'sms'
  | 'backup';

@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private adminDashboardService = inject(AdminDashboardService);
  private destroyRef = inject(DestroyRef);
  private rsvpService = inject(RsvpService);
  private userService = inject(UserService);
  private analyticsService = inject(AnalyticsService);

  readonly defaultPhoto = '/assets/nlcom.png';
  readonly Math = Math;

  currentView = signal<'overview' | 'volunteers' | 'attendance' | 'performance' | 'rsvps' | 'ics' | 'users' | 'analytics' | 'events' | 'sms' | 'backup'>('overview');
  currentUser = computed(() => this.authService.currentUser());
  pageTitle = computed(() => {
    switch (this.currentView()) {
      case 'overview':
        return 'Dashboard';
      case 'volunteers':
        return 'Volunteer Management';
      case 'attendance':
        return 'Attendance';
      case 'performance':
        return 'Performance';
      case 'rsvps':
        return 'RSVP Management';
      case 'ics':
        return 'Incident Command System';
      case 'users':
        return 'User Management';
      case 'analytics':
        return 'Analytics & Reports';
      case 'sms':
        return 'SMS Notifications';
      case 'backup':
        return 'Backup & Recovery';
      default:
        return 'Admin Dashboard';
    }
  });
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  isLoading = signal(false);

  showNotifications = signal(false);
  showLogoutModal = signal(false);
  showRsvpModal = signal(false);
  showDeleteRsvpModal = signal(false);
  showShareRsvpModal = signal(false);
  sharingRsvp = signal<Rsvp | null>(null);
  showVolunteerModal = signal(false);
  showDeleteVolunteerModal = signal(false);
  showUserModal = signal(false);
  showDeleteUserModal = signal(false);
  showResetPasswordModal = signal(false);
  showUserDetailsModal = signal(false);
  showAiSidebar = signal(false);

  searchQuery = signal('');
  userSearchQuery = signal('');
  userRoleFilter = signal('');

  editingRsvp = signal<Rsvp | null>(null);
  deletingRsvpId = signal<number | null>(null);
  editingVolunteer = signal<DashboardVolunteerRow | null>(null);
  deletingVolunteerId = signal<number | null>(null);
  editingUser = signal<User | null>(null);
  deletingUserId = signal<number | null>(null);
  resettingPasswordUserId = signal<number | null>(null);
  viewingUser = signal<User | null>(null);

  // RSVP signals (already declared above)


  currentPage = signal(1);
  usersPerPage = signal(5);
  usersTotalPages = computed(() => Math.ceil(this.filteredUsers().length / this.usersPerPage()));
  
  volunteersPage = signal(1);
  volunteersPerPage = signal(5);
  volunteerSearchQuery = signal('');
  showArchivedVolunteers = signal(false);
  archivedVolunteerRows = signal<DashboardVolunteerRow[]>([]);

  filteredVolunteers = computed(() => {
    const search = this.volunteerSearchQuery().toLowerCase().trim();
    const volunteers = this.showArchivedVolunteers()
      ? this.archivedVolunteerRows()
      : this.volunteerRows();

    if (!search) {
      return volunteers;
    }

    return volunteers.filter(v =>
      v.name.toLowerCase().includes(search) ||
      v.email.toLowerCase().includes(search) ||
      (v.facebookName && v.facebookName.toLowerCase().includes(search)) ||
      v.department.toLowerCase().includes(search)
    );
  });

  volunteersTotalPages = computed(() => Math.ceil(this.filteredVolunteers().length / this.volunteersPerPage()));

  // Attendance management signals
  attendanceView = signal<'daily' | 'history' | 'reports'>('daily');
  attendancePage = signal(1);
  attendancePerPage = signal(5);
  attendanceSearchQuery = signal('');
  attendanceDateFilter = signal(new Date().toISOString().split('T')[0]);

  // Assign Volunteer & Photo Upload OCR signals
  showAssignVolunteerModal = signal(false);
  showPhotoUploadModal = signal(false);
  availableVolunteersForAssignment = signal<VolunteerUser[]>([]);
  selectedVolunteersForAssignment = signal<number[]>([]);
  photoUploadProcessing = signal(false);
  photoUploadPreview = signal<string | null>(null);
  detectedVolunteersFromPhoto = signal<Array<{ name: string; confidence: number }>>([]);
  isAssigningVolunteers = signal(false);

  // Mock attendance data (will be replaced with API call)
  attendanceRecords = signal<AttendanceRecord[]>([
    { id: 1, volunteerName: 'Agnes Felix', email: 'agnes.felix.21@servetrack.local', department: 'Mobile Kitchen Operations', checkInTime: '08:30 AM', checkOutTime: '12:00 PM', duration: '3h 30m', status: 'present' },
    { id: 2, volunteerName: 'Robbie Panaligan', email: 'robbie.panaligan.22@servetrack.local', department: 'Relief Operations', checkInTime: '09:00 AM', checkOutTime: '11:30 AM', duration: '2h 30m', status: 'present' },
    { id: 3, volunteerName: 'Natasya Angelina Lim', email: 'natasya.angelina.lim.23@servetrack.local', department: 'Mobile Kitchen Operations', checkInTime: '08:45 AM', checkOutTime: '01:00 PM', duration: '4h 15m', status: 'present' },
    { id: 4, volunteerName: 'Lea Therese Chua', email: 'lea.therese.chua.24@servetrack.local', department: 'Individual & Corporate Partnerships', checkInTime: '09:15 AM', checkOutTime: null, duration: null, status: 'present' },
    { id: 5, volunteerName: 'George Arvin Ventura', email: 'george.arvin.ventura.25@servetrack.local', department: 'Mobile Kitchen Operations', checkInTime: null, checkOutTime: null, duration: null, status: 'absent' },
  ]);

  filteredAttendance = computed(() => {
    const search = this.attendanceSearchQuery().toLowerCase().trim();
    const records = this.attendanceRecords();

    if (!search) {
      return records;
    }

    return records.filter(r =>
      r.volunteerName.toLowerCase().includes(search) ||
      r.email.toLowerCase().includes(search) ||
      r.department.toLowerCase().includes(search)
    );
  });

  paginatedAttendance = computed(() => {
    const filtered = this.filteredAttendance();
    const page = this.attendancePage();
    const perPage = this.attendancePerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filtered.slice(start, end);
  });

  attendanceTotalPages = computed(() => Math.ceil(this.filteredAttendance().length / this.attendancePerPage()));

  // Analytics signals
  reportData = signal<ReportData | null>(null);
  analyticsLoading = signal(false);
  selectedReportType = signal<'volunteers' | 'attendance' | 'performance' | 'department' | 'trends'>('volunteers');
  dateRangeFilter = signal<'all' | 'month' | 'quarter' | 'year'>('all');
  selectedDepartmentFilter = signal<string | null>(null);
  skillsPage = signal(1);
  skillsPerPage = signal(3);
  departmentsPage = signal(1);
  departmentsPerPage = signal(3);

  paginatedSkills = computed(() => {
    const data = this.reportData()?.skillsDistribution?.skills ?? [];
    const page = this.skillsPage();
    const perPage = this.skillsPerPage();
    const start = (page - 1) * perPage;
    return data.slice(start, start + perPage);
  });

  totalSkillsPages = computed(() => {
    const data = this.reportData()?.skillsDistribution?.skills ?? [];
    return Math.ceil(data.length / this.skillsPerPage());
  });

  hasMoreSkills = computed(() => {
    return (this.reportData()?.skillsDistribution?.skills ?? []).length > this.skillsPerPage();
  });

  paginatedDepartments = computed(() => {
    const data = this.reportData()?.departmentBreakdown ?? [];
    const page = this.departmentsPage();
    const perPage = this.departmentsPerPage();
    const start = (page - 1) * perPage;
    return data.slice(start, start + perPage);
  });

  totalDepartmentsPages = computed(() => {
    const data = this.reportData()?.departmentBreakdown ?? [];
    return Math.ceil(data.length / this.departmentsPerPage());
  });

  hasMoreDepartments = computed(() => {
    return (this.reportData()?.departmentBreakdown ?? []).length > this.departmentsPerPage();
  });


  // RSVP creation loading state
  isCreatingRsvp = signal(false);
  isDeletingRsvp = signal(false);

  // Snackbar notifications
  snackbarMessage = signal<string>('');
  snackbarVisible = signal(false);
  snackbarType = signal<'success' | 'error' | 'info'>('success');
  snackbarSlideOut = signal(false);

  notifications = signal<NotificationItem[]>([]);

  smsMessage = signal('');
  smsAudience = signal<'all' | 'active' | 'new'>('active');
  smsSending = signal(false);
  selectedSmsTemplate = signal('');

  backupRecords = signal<BackupRecord[]>([]);
  backupHistoryPage = signal(1);
  backupHistoryPageSize = signal(5);
  backupActionLoading = signal(false);
  scheduledBackupEnabled = signal(false);
  scheduledBackupFrequency = signal<'daily' | 'weekly' | 'monthly'>('weekly');
  
  // Confirmation dialog state
  showConfirmationDialog = signal(false);
  confirmationDialogTitle = signal('');
  confirmationDialogMessage = signal('');
  confirmationDialogAction = signal<() => void>(() => {});

  readonly smsTemplates: ReadonlyArray<{ name: string; message: string }> = [
    {
      name: 'Attendance Reminder',
      message:
        'Hello team! Friendly reminder to confirm attendance for your next assigned mission.',
    },
    {
      name: 'Urgent Deployment',
      message:
        'Urgent volunteer callout: please check your ServeTrack dashboard for immediate deployment details.',
    },
    {
      name: 'Thank You Note',
      message:
        'Thank you for serving with us. Your time and effort made a real impact in our latest outreach.',
    },
    {
      name: 'RSVP Cutoff Reminder',
      message:
        'Reminder: The RSVP deadline for {event} is approaching on {cutoffDate}. Please confirm your attendance.',
    },
  ];

  // Automatic SMS for cutoff reminders
  autoSmsEnabled = signal(false);
  autoSmsHoursBefore = signal(24); // Hours before cutoff to send reminder
  autoSmsCutoffRecipients = computed(() => {
    const now = new Date();
    const upcomingCutoffs = this.rsvps().filter(rsvp => {
      if (!rsvp.cutOffDay) return false;
      const cutoff = new Date(rsvp.cutOffDay + 'T' + (rsvp.cutOffTime || '23:59'));
      const hoursUntil = (cutoff.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntil > 0 && hoursUntil <= this.autoSmsHoursBefore() && rsvp.status === 'active';
    });
    return upcomingCutoffs;
  });

  notificationCount = computed(
    () => this.notifications().filter((notification) => !notification.read).length,
  );

  totalVolunteers = signal(0);
  activeVolunteers = signal(0);
  upcomingEvents = signal(0);
  completedMissions = signal(0);

  // ── Real-time Clock ──────────────────────────────────────────────────────
  currentTime = signal(new Date());
  currentDateFormatted = computed(() => {
    const date = this.currentTime();
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  });
  currentTimeFormatted = computed(() => {
    const date = this.currentTime();
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  });
  private timeUpdateInterval: any;

  volunteerRows = signal<DashboardVolunteerRow[]>([]);
  performanceMetrics = signal<PerformanceMetric[]>([]);
  rsvps = signal<Rsvp[]>([]);
  rsvpFilterStatus = signal<'all' | 'active' | 'closed' | 'draft'>('all');
  users = signal<User[]>([]);
  volunteers = signal<VolunteerUser[]>([]);

  sortField = signal<'name' | 'attendance' | 'hours' | 'tasks' | 'rating'>('attendance');
  sortDirection = signal<'asc' | 'desc'>('desc');
  performancePage = signal(1);
  performancePerPage = signal(10);

  sortedPerformanceMetrics = computed(() => {
    const metrics = [...this.performanceMetrics()];
    const field = this.sortField();
    const direction = this.sortDirection();

    metrics.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (field) {
        case 'name':
          aVal = a.volunteerName;
          bVal = b.volunteerName;
          break;
        case 'attendance':
          aVal = a.attendanceRate;
          bVal = b.attendanceRate;
          break;
        case 'hours':
          aVal = a.hoursServed;
          bVal = b.hoursServed;
          break;
        case 'tasks':
          aVal = a.tasksCompleted;
          bVal = b.tasksCompleted;
          break;
        case 'rating':
          aVal = a.rating;
          bVal = b.rating;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return direction === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return metrics;
  });

  paginatedPerformanceMetrics = computed(() => {
    const metrics = this.sortedPerformanceMetrics();
    const start = (this.performancePage() - 1) * this.performancePerPage();
    const end = start + this.performancePerPage();
    return metrics.slice(start, end);
  });

  performanceTotalPages = computed(() => {
    return Math.ceil(this.sortedPerformanceMetrics().length / this.performancePerPage());
  });

  averageAttendanceRate = computed(() => {
    const metrics = this.performanceMetrics();
    if (metrics.length === 0) {
      return 0;
    }
    const total = metrics.reduce((sum, m) => sum + m.attendanceRate, 0);
    return Math.round(total / metrics.length);
  });

  totalHoursServed = computed(() => {
    return this.performanceMetrics().reduce((sum, m) => sum + m.hoursServed, 0);
  });

  totalTasksCompleted = computed(() => {
    return this.performanceMetrics().reduce((sum, m) => sum + m.tasksCompleted, 0);
  });

  averageRating = computed(() => {
    const metrics = this.performanceMetrics();
    if (metrics.length === 0) {
      return 0;
    }
    const total = metrics.reduce((sum, m) => sum + m.rating, 0);
    return (total / metrics.length).toFixed(1);
  });

  topPerformer = computed(() => {
    const metrics = this.performanceMetrics();
    if (metrics.length === 0) {
      return null;
    }
    return metrics.reduce((top, current) =>
      current.hoursServed > top.hoursServed ? current : top
    );
  });

  filteredRsvps = computed(() => {
    const status = this.rsvpFilterStatus();
    if (status === 'all') {
      return this.rsvps();
    }
    return this.rsvps().filter((rsvp) => rsvp.status === status);
  });

  upcomingEventRows = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.rsvps()
      .map((rsvp) => {
        const parsedDate = this.safeDate(rsvp.date);
        return {
          id: rsvp.id,
          title: rsvp.title,
          dateLabel: rsvp.date,
          dateValue: parsedDate ? parsedDate.getTime() : Number.MAX_SAFE_INTEGER,
          status: rsvp.status,
          responses: rsvp.totalResponses,
        };
      })
      .filter((event) => event.dateValue >= today.getTime())
      .sort((a, b) => a.dateValue - b.dateValue)
      .slice(0, 5);
  });

  eventsModuleCards = computed<EventModuleCard[]>(() => {
    const rsvps = this.rsvps();
    const active = rsvps.filter((item) => item.status === 'active').length;
    const closed = rsvps.filter((item) => item.status === 'closed').length;
    const upcoming = this.upcomingEventRows().length;

    return [
      { label: 'Active RSVPs', value: active, helper: 'open for responses' },
      { label: 'Upcoming Events', value: upcoming, helper: 'scheduled entries' },
      { label: 'Closed Events', value: closed, helper: 'ready for review' },
    ];
  });

  smsCharacterCount = computed(() => this.smsMessage().trim().length);

  smsRecipientsCount = computed(() => {
    const volunteers = this.volunteerRows().length;
    const users = this.users().filter((user) => !user.deleted_at);

    if (this.smsAudience() === 'all') {
      return Math.max(volunteers, users.length);
    }

    if (this.smsAudience() === 'new') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      return users.filter((user) => {
        const created = this.safeDate(user.created_at);
        return Boolean(created && created >= oneMonthAgo);
      }).length;
    }

    return this.activeVolunteers();
  });

  backupTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.backupRecords().length / this.backupHistoryPageSize())),
  );

  paginatedBackupRecords = computed(() => {
    const page = this.backupHistoryPage();
    const size = this.backupHistoryPageSize();
    const start = (page - 1) * size;
    const end = start + size;

    return this.backupRecords()
      .slice()
      .sort((a, b) => {
        const bDate = this.safeDate(b.created_at)?.getTime() ?? 0;
        const aDate = this.safeDate(a.created_at)?.getTime() ?? 0;
        return bDate - aDate;
      })
      .slice(start, end);
  });

  latestBackup = computed(() => {
    return this.backupRecords()
      .slice()
      .sort((a, b) => {
        const bDate = this.safeDate(b.created_at)?.getTime() ?? 0;
        const aDate = this.safeDate(a.created_at)?.getTime() ?? 0;
        return bDate - aDate;
      })[0] ?? null;
  });

  filteredUsers = computed(() => {
    // Use users() which contains all user types (admin, coordinator, volunteer)
    let filtered = this.users().filter(u => !u.deleted_at);

    const role = this.userRoleFilter();
    const search = this.userSearchQuery().toLowerCase().trim();

    if (role) {
      filtered = filtered.filter(u => u.role === role);
    }
    if (search) {
      filtered = filtered.filter(u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
    }
    return filtered;
  });

  paginatedUsers = computed(() => {
    const filtered = this.filteredUsers();
    const page = this.currentPage();
    const perPage = this.usersPerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filtered.slice(start, end);
  });

  paginatedVolunteers = computed(() => {
    const filtered = this.filteredVolunteers();
    const page = this.volunteersPage();
    const perPage = this.volunteersPerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filtered.slice(start, end);
  });

  // Custom validator to ensure cutoff date is not after event date
  // and not before current date
  private cutoffDateValidator(): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const eventDate = formGroup.get('date')?.value;
      const cutoffDate = formGroup.get('cutOffDay')?.value;

      if (!eventDate || !cutoffDate) {
        return null;
      }

      const event = new Date(eventDate);
      const cutoff = new Date(cutoffDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day

      if (cutoff > event) {
        return { cutoffAfterEvent: true };
      }

      if (cutoff < today) {
        return { cutoffBeforeToday: true };
      }

      return null;
    };
  }

  rsvpForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    eventLocation: ['', [Validators.required, Validators.maxLength(255)]],
    date: ['', Validators.required],
    cutOffDay: ['', Validators.required],
    cutOffTime: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
    shifts: this.fb.array([]),
  }, { validators: this.cutoffDateValidator() });

  volunteerForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    facebookName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
    birthdate: ['', Validators.required],
    lastMedicalExam: ['', Validators.required],
    completeAddress: ['', Validators.required],
    educationalAttainment: ['', Validators.required],
    trainingExperience: [''],
    skillsHobbies: [''],
    classesTraining: [''],
    volunteerPreference: ['', Validators.required],
    otherPreference: [''],
    availability: ['', Validators.required],
    otherAvailability: [''],
    partOfLifegroup: ['', Validators.required],
    lifegroupLeaderName: [''],
    leadingLifegroup: ['', Validators.required],
    emergencyContactName: ['', Validators.required],
    emergencyContactNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
    emergencyContactRelationship: ['', Validators.required],
  });

  userForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['', Validators.required],
    password: [''],
    confirmPassword: [''],
  });

  resetPasswordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadRsvps();
    this.loadUsers();
    this.loadBackups();
    this.loadScheduledBackupSettings();

    // Initialize clock
    this.currentTime.set(new Date());

    // Update every second
    this.timeUpdateInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    // Clean up on destroy
    this.destroyRef.onDestroy(() => {
      if (this.timeUpdateInterval) {
        clearInterval(this.timeUpdateInterval);
      }
    });
  }

  private loadDashboardData(): void {
    this.isLoading.set(true);

    this.adminDashboardService.getDashboardData().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      if (response.success && response.data) {
        this.totalVolunteers.set(response.data.stats.totalVolunteers);
        this.activeVolunteers.set(response.data.stats.activeVolunteers);
        this.upcomingEvents.set(response.data.stats.upcomingEvents);
        this.completedMissions.set(response.data.stats.completedMissions);
        this.notifications.set(response.data.notifications ?? []);
        this.volunteerRows.set(response.data.volunteers ?? []);
        this.performanceMetrics.set(response.data.performanceMetrics ?? []);
      } else {
        this.notifications.set([]);
        this.volunteerRows.set([]);
        this.performanceMetrics.set([]);
      }

      this.isLoading.set(false);
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  setView(view: DashboardView): void {
    this.currentView.set(view);
    this.currentPage.set(1);
    
    if (view === 'analytics') {
      this.loadAnalyticsData();
    }
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  runSearch(): void {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return;
    }

    if (query.includes('volunteer')) {
      this.setView('volunteers');
      return;
    }

    if (query.includes('attendance')) {
      this.setView('attendance');
      return;
    }

    if (query.includes('performance')) {
      this.setView('performance');
      return;
    }

    if (query.includes('rsvp')) {
      this.setView('rsvps');
      return;
    }

    if (query.includes('incident') || query.includes('ics') || query.includes('command')) {
      this.setView('ics');
      return;
    }

    if (query.includes('user')) {
      this.setView('users');
      return;
    }

    if (query.includes('analytic')) {
      this.setView('analytics');
      return;
    }

    if (query.includes('event')) {
      this.setView('events');
      return;
    }

    if (query.includes('sms') || query.includes('message')) {
      this.setView('sms');
      return;
    }

    if (query.includes('backup') || query.includes('restore')) {
      this.setView('backup');
      return;
    }

    this.setView('overview');
  }

  goToVolunteersModule(): void {
    this.setView('volunteers');
  }

  goToRsvpsModule(): void {
    this.setView('rsvps');
  }

  setSmsAudience(value: 'all' | 'active' | 'new'): void {
    this.smsAudience.set(value);
  }

  updateSmsMessage(value: string): void {
    this.smsMessage.set(value);
  }

  applySmsTemplate(templateMessage: string): void {
    this.selectedSmsTemplate.set(templateMessage);
    this.smsMessage.set(templateMessage);
  }

  setAutoSmsEnabled(enabled: boolean): void {
    this.autoSmsEnabled.set(enabled);
    if (enabled) {
      this.showSnackbar('Automatic SMS reminders enabled for upcoming cutoffs', 'success');
    } else {
      this.showSnackbar('Automatic SMS reminders disabled', 'info');
    }
  }

  setAutoSmsHoursBefore(hours: number): void {
    this.autoSmsHoursBefore.set(hours);
  }

  sendAutomaticCutoffReminders(): void {
    const upcoming = this.autoSmsCutoffRecipients();
    if (upcoming.length === 0) {
      this.showSnackbar('No upcoming cutoffs within the configured timeframe', 'info');
      return;
    }

    upcoming.forEach(rsvp => {
      const message = this.smsTemplates
        .find(t => t.name === 'RSVP Cutoff Reminder')?.message
        .replace('{event}', rsvp.title)
        .replace('{cutoffDate}', rsvp.cutOffDay) || '';

      // TODO: Call API to send SMS to RSVP participants
      console.log(`Sending cutoff reminder for ${rsvp.title}: ${message}`);
    });

    this.showSnackbar(`Sent cutoff reminders for ${upcoming.length} events`, 'success');
  }

  sendSmsBroadcast(): void {
    const message = this.smsMessage().trim();

    if (!message) {
      this.showSnackbar('Enter a message before sending.', 'error');
      return;
    }

    if (this.smsRecipientsCount() <= 0) {
      this.showSnackbar('No recipients available for the selected audience.', 'error');
      return;
    }

    this.smsSending.set(true);
    window.setTimeout(() => {
      this.smsSending.set(false);
      this.showSnackbar(`SMS broadcast queued for ${this.smsRecipientsCount()} recipients.`, 'success');
      this.smsMessage.set('');
      this.selectedSmsTemplate.set('');
    }, 900);
  }

  loadBackups(): void {
    this.adminDashboardService.getBackups(this.backupHistoryPage(), this.backupHistoryPageSize()).subscribe((response) => {
      if (response.success) {
        this.backupRecords.set(response.data);
      } else {
        this.backupRecords.set([]);
      }
    });
  }

  loadScheduledBackupSettings(): void {
    this.adminDashboardService.getScheduledBackupSettings().subscribe((response) => {
      if (response.success && response.data) {
        this.scheduledBackupEnabled.set(response.data.enabled);
        this.scheduledBackupFrequency.set(response.data.frequency);
      }
    });
  }

  createBackup(): void {
    this.backupActionLoading.set(true);
    
    this.adminDashboardService.createBackup('manual').subscribe({
      next: (response) => {
        if (response.success) {
          this.backupRecords.update((items) => [response.data, ...items]);
          this.backupHistoryPage.set(1);
          this.showSnackbar('Backup created successfully.', 'success');
        } else {
          this.showSnackbar(
            response.message || 'Failed to create backup',
            'error'
          );
        }
        this.backupActionLoading.set(false);
      },
      error: (error) => {
        console.error('Error creating backup:', error);
        this.showSnackbar('Failed to create backup', 'error');
        this.backupActionLoading.set(false);
      }
    });
  }

  refreshBackups(): void {
    this.backupActionLoading.set(true);
    
    this.adminDashboardService.getBackups(
      this.backupHistoryPage(),
      this.backupHistoryPageSize()
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.backupRecords.set(response.data);
          this.showSnackbar('Backup history refreshed.', 'info');
        } else {
          this.showSnackbar('Failed to refresh backup history', 'error');
        }
        this.backupActionLoading.set(false);
      },
      error: (error) => {
        console.error('Error refreshing backups:', error);
        this.showSnackbar('Failed to refresh backup history', 'error');
        this.backupActionLoading.set(false);
      }
    });
  }

  downloadBackup(backup: BackupRecord): void {
    this.adminDashboardService.downloadBackup(backup.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${backup.name}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showSnackbar(`Download started for ${backup.name}.`, 'info');
      },
      error: (error) => {
        console.error('Error downloading backup:', error);
        this.showSnackbar('Failed to download backup', 'error');
      }
    });
  }

  // Confirmation dialog helper methods
  openConfirmationDialog(title: string, message: string, action: () => void): void {
    this.confirmationDialogTitle.set(title);
    this.confirmationDialogMessage.set(message);
    this.confirmationDialogAction.set(() => {
      this.closeConfirmationDialog();
      action();
    });
    this.showConfirmationDialog.set(true);
  }

  closeConfirmationDialog(): void {
    this.showConfirmationDialog.set(false);
    this.confirmationDialogTitle.set('');
    this.confirmationDialogMessage.set('');
    this.confirmationDialogAction.set(() => {});
  }

  restoreBackup(backup: BackupRecord): void {
    this.openConfirmationDialog(
      'Restore Backup',
      `Are you sure you want to restore from backup "${backup.name}"? ` +
      'This will replace all current data and cannot be undone.',
      () => {
        this.backupActionLoading.set(true);
        
        this.adminDashboardService.restoreBackup(backup.id).subscribe({
          next: (response) => {
            if (response.success) {
              this.showSnackbar(
                `Database restored successfully from ${backup.name}. ` +
                'Please refresh the page.',
                'success'
              );
            } else {
              this.showSnackbar(
                response.message ||
                'Failed to restore backup',
                'error'
              );
            }
            this.backupActionLoading.set(false);
          },
          error: (error) => {
            console.error('Error restoring backup:', error);
            this.showSnackbar(
              'Failed to restore backup',
              'error'
            );
            this.backupActionLoading.set(false);
          }
        });
      }
    );
  }

  deleteBackup(backupId: number): void {
    this.openConfirmationDialog(
      'Delete Backup',
      'Are you sure you want to delete this backup? This action cannot be undone.',
      () => {
        this.adminDashboardService.deleteBackup(backupId).subscribe({
          next: (response) => {
            if (response.success) {
              this.backupRecords.update((items) => items.filter((item) => item.id !== backupId));

              const totalPages = this.backupTotalPages();
              if (this.backupHistoryPage() > totalPages) {
                this.backupHistoryPage.set(totalPages);
              }

              this.showSnackbar('Backup deleted successfully.', 'success');
            } else {
              this.showSnackbar(response.message || 'Failed to delete backup', 'error');
            }
          },
          error: (error) => {
            console.error('Error deleting backup:', error);
            this.showSnackbar('Failed to delete backup', 'error');
          }
        });
      }
    );
  }

  setScheduledBackupFrequency(value: 'daily' | 'weekly' | 'monthly'): void {
    const currentEnabled = this.scheduledBackupEnabled();
    
    this.adminDashboardService.updateScheduledBackupSettings(currentEnabled, value).subscribe({
      next: (response) => {
        if (response.success) {
          this.scheduledBackupFrequency.set(value);
          this.showSnackbar('Backup frequency updated successfully.', 'success');
        } else {
          this.showSnackbar(response.message || 'Failed to update backup frequency', 'error');
        }
      },
      error: (error) => {
        console.error('Error updating backup frequency:', error);
        this.showSnackbar('Failed to update backup frequency', 'error');
      }
    });
  }

  toggleScheduledBackups(): void {
    const newEnabled = !this.scheduledBackupEnabled();
    const currentFrequency = this.scheduledBackupFrequency();
    
    this.adminDashboardService.updateScheduledBackupSettings(newEnabled, currentFrequency).subscribe({
      next: (response) => {
        if (response.success) {
          this.scheduledBackupEnabled.set(newEnabled);
          const stateLabel = newEnabled ? 'enabled' : 'disabled';
          this.showSnackbar(`Scheduled backups ${stateLabel}.`, 'success');
        } else {
          this.showSnackbar(response.message || 'Failed to toggle scheduled backups', 'error');
        }
      },
      error: (error) => {
        console.error('Error toggling scheduled backups:', error);
        this.showSnackbar('Failed to toggle scheduled backups', 'error');
      }
    });
  }

  nextBackupHistoryPage(): void {
    if (this.backupHistoryPage() < this.backupTotalPages()) {
      this.backupHistoryPage.update((page) => page + 1);
    }
  }

  previousBackupHistoryPage(): void {
    if (this.backupHistoryPage() > 1) {
      this.backupHistoryPage.update((page) => page - 1);
    }
  }

  toggleNotifications(): void {
    this.showNotifications.update((value) => !value);
  }

  markNotificationsRead(): void {
    this.notifications.update((items) => items.map((item) => ({ ...item, read: true })));
  }

  closeNotifications(): void {
    this.showNotifications.set(false);
  }

  openLogoutModal(): void {
    this.showLogoutModal.set(true);
  }

  closeLogoutModal(): void {
    this.showLogoutModal.set(false);
  }



  loadUsers(): void {
    this.userService.getUsers().subscribe((response) => {
      if (response.success) {
        this.users.set(response.data);
      }
    });
  }

  // Helper methods for backup display
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  getBackupStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  }

  setUserSearchQuery(query: string): void {
    this.userSearchQuery.set(query);
    this.currentPage.set(1); // Reset to first page when searching
  }

  setUserRoleFilter(role: string): void {
    this.userRoleFilter.set(role);
    this.currentPage.set(1); // Reset to first page when filtering
  }

  goToPage(page: number): void {
    const totalPages = this.usersTotalPages();
    if (page >= 1 && page <= totalPages) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    const totalPages = this.usersTotalPages();
    if (this.currentPage() < totalPages) {
      this.currentPage.update(page => page + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
    }
  }

  getPageNumbers(): number[] {
    const total = this.usersTotalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, -1, total);
      } else if (current >= total - 2) {
        pages.push(1, -1, total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, -1, current - 1, current, current + 1, -1, total);
      }
    }
    
    return pages;
  }

  goToVolunteersPage(page: number): void {
    const totalPages = this.volunteersTotalPages();
    if (page >= 1 && page <= totalPages) {
      this.volunteersPage.set(page);
    }
  }

  nextVolunteersPage(): void {
    const totalPages = this.volunteersTotalPages();
    if (this.volunteersPage() < totalPages) {
      this.volunteersPage.update(page => page + 1);
    }
  }

  previousVolunteersPage(): void {
    if (this.volunteersPage() > 1) {
      this.volunteersPage.update(page => page - 1);
    }
  }

  getVolunteersPageNumbers(): number[] {
    const total = this.volunteersTotalPages();
    const current = this.volunteersPage();
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, -1, total);
      } else if (current >= total - 2) {
        pages.push(1, -1, total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, -1, current - 1, current, current + 1, -1, total);
      }
    }

    return pages;
  }

  // Attendance management methods
  setAttendanceView(view: 'daily' | 'history' | 'reports'): void {
    this.attendanceView.set(view);
    this.attendancePage.set(1);
  }

  setAttendanceSearchQuery(query: string): void {
    this.attendanceSearchQuery.set(query);
    this.attendancePage.set(1);
  }

  setAttendanceDateFilter(date: string): void {
    this.attendanceDateFilter.set(date);
    this.attendancePage.set(1);
  }

  previousAttendancePage(): void {
    if (this.attendancePage() > 1) {
      this.attendancePage.update(p => p - 1);
    }
  }

  nextAttendancePage(): void {
    if (this.attendancePage() < this.attendanceTotalPages()) {
      this.attendancePage.update(p => p + 1);
    }
  }

  goToAttendancePage(page: number): void {
    this.attendancePage.set(page);
  }

  getAttendancePageNumbers(): number[] {
    const total = this.attendanceTotalPages();
    const current = this.attendancePage();
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, -1, total);
      } else if (current >= total - 2) {
        pages.push(1, -1, total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, -1, current - 1, current, current + 1, -1, total);
      }
    }

    return pages;
  }

  // Attendance details modal signals
  showAttendanceDetailsModal = signal(false);
  selectedAttendanceRecord = signal<AttendanceRecord | null>(null);

  viewAttendanceDetails(record: AttendanceRecord): void {
    this.selectedAttendanceRecord.set(record);
    this.showAttendanceDetailsModal.set(true);
  }

  closeAttendanceDetailsModal(): void {
    this.showAttendanceDetailsModal.set(false);
    this.selectedAttendanceRecord.set(null);
  }

  exportAttendanceToPDF(): void {
    this.showSnackbar('Exporting attendance to PDF...', 'info');
    // TODO: Implement PDF export
  }

  exportAttendanceToExcel(): void {
    this.showSnackbar('Exporting attendance to Excel...', 'info');
    // TODO: Implement Excel export
  }

  updateAttendanceStatus(recordId: number, status: 'present' | 'absent'): void {
    this.attendanceRecords.update(records =>
      records.map(r => r.id === recordId ? { ...r, status } : r)
    );
    this.showSnackbar(`Attendance status updated to ${status}`, 'success');
  }

  // Assign Volunteer & Photo Upload OCR Methods
  openAssignVolunteerModal(): void {
    // Load available volunteers (those not already assigned for the selected date)
    const assignedIds = this.attendanceRecords().map(r => r.id);
    const available = this.volunteers().filter(v => !assignedIds.includes(v.volunteer_id));
    this.availableVolunteersForAssignment.set(available);
    this.selectedVolunteersForAssignment.set([]);
    this.showAssignVolunteerModal.set(true);
  }

  closeAssignVolunteerModal(): void {
    this.showAssignVolunteerModal.set(false);
    this.selectedVolunteersForAssignment.set([]);
    this.availableVolunteersForAssignment.set([]);
  }

  toggleVolunteerSelection(volunteerId: number): void {
    const current = this.selectedVolunteersForAssignment();
    if (current.includes(volunteerId)) {
      this.selectedVolunteersForAssignment.set(current.filter(id => id !== volunteerId));
    } else {
      this.selectedVolunteersForAssignment.set([...current, volunteerId]);
    }
  }

  selectAllVolunteers(): void {
    const allIds = this.availableVolunteersForAssignment().map(v => v.volunteer_id);
    this.selectedVolunteersForAssignment.set(allIds);
  }

  clearVolunteerSelection(): void {
    this.selectedVolunteersForAssignment.set([]);
  }

  async assignSelectedVolunteers(): Promise<void> {
    if (this.selectedVolunteersForAssignment().length === 0) {
      this.showSnackbar('Please select at least one volunteer', 'error');
      return;
    }

    this.isAssigningVolunteers.set(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const selectedVolunteers = this.volunteers().filter(v =>
      this.selectedVolunteersForAssignment().includes(v.volunteer_id)
    );

    // Add to attendance records
    const newRecords: AttendanceRecord[] = selectedVolunteers.map(v => ({
      id: v.volunteer_id,
      volunteerName: v.full_name,
      email: v.email,
      department: 'Unassigned',
      checkInTime: null,
      checkOutTime: null,
      duration: null,
      status: 'absent'
    }));

    this.attendanceRecords.update(records => [...records, ...newRecords]);

    this.isAssigningVolunteers.set(false);
    this.closeAssignVolunteerModal();
    this.showSnackbar(`${newRecords.length} volunteer(s) assigned successfully`, 'success');
  }

  openPhotoUploadModal(): void {
    this.showPhotoUploadModal.set(true);
    this.photoUploadPreview.set(null);
    this.detectedVolunteersFromPhoto.set([]);
  }

  closePhotoUploadModal(): void {
    this.showPhotoUploadModal.set(false);
    this.photoUploadPreview.set(null);
    this.detectedVolunteersFromPhoto.set([]);
    this.photoUploadProcessing.set(false);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.showSnackbar('Please select a valid image file', 'error');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showSnackbar('Image file size should be less than 10MB', 'error');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      this.photoUploadPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async processPhotoOCR(): Promise<void> {
    if (!this.photoUploadPreview()) {
      this.showSnackbar('Please upload a photo first', 'error');
      return;
    }

    this.photoUploadProcessing.set(true);

    // Simulate OCR processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock detected volunteers (in real implementation, this would come from OCR API)
    const mockDetected = [
      { name: 'Agnes Felix', confidence: 95 },
      { name: 'Robbie Panaligan', confidence: 88 },
      { name: 'Natasya Angelina Lim', confidence: 92 },
      { name: 'Lea Therese Chua', confidence: 85 },
    ];

    this.detectedVolunteersFromPhoto.set(mockDetected);
    this.photoUploadProcessing.set(false);
    this.showSnackbar(`Detected ${mockDetected.length} volunteers from photo`, 'success');
  }

  markDetectedVolunteersAsPresent(): void {
    const detected = this.detectedVolunteersFromPhoto();
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    this.attendanceRecords.update(records =>
      records.map(record => {
        const detectedVolunteer = detected.find(d =>
          record.volunteerName.toLowerCase().includes(d.name.toLowerCase()) ||
          d.name.toLowerCase().includes(record.volunteerName.toLowerCase())
        );

        if (detectedVolunteer && record.status !== 'present') {
          return {
            ...record,
            checkInTime: currentTime,
            status: 'present'
          };
        }
        return record;
      })
    );

    this.closePhotoUploadModal();
    this.showSnackbar('Attendance updated based on photo detection', 'success');
  }

  openCreateUserModal(): void {
    this.editingUser.set(null);
    this.userForm.reset({
      name: '',
      email: '',
      role: '',
      password: '',
      confirmPassword: ''
    });
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm.get('confirmPassword')?.setValidators(Validators.required);
    this.userForm.get('password')?.updateValueAndValidity();
    this.userForm.get('confirmPassword')?.updateValueAndValidity();
    this.showUserModal.set(true);
  }

  openEditUserModal(user: User): void {
    this.editingUser.set(user);
    this.userForm.reset();
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('confirmPassword')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.userForm.get('confirmPassword')?.updateValueAndValidity();
    this.userForm.patchValue({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    this.showUserModal.set(true);
  }

  closeUserModal(): void {
    this.showUserModal.set(false);
    this.editingUser.set(null);
  }

  openUserDetailsModal(user: User): void {
    this.viewingUser.set(user);
    this.showUserDetailsModal.set(true);
  }

  closeUserDetailsModal(): void {
    this.showUserDetailsModal.set(false);
    this.viewingUser.set(null);
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const val = this.userForm.value;
    const editingUser = this.editingUser();

    if (!editingUser) {
      if (val.password !== val.confirmPassword) {
        this.userForm.get('confirmPassword')?.setErrors({ mismatch: true });
        return;
      }
      this.userService.createUser({
        name: val.name!,
        email: val.email!,
        role: val.role as any,
        password: val.password!
      }).subscribe({
        next: () => {
          this.loadUsers();
          this.closeUserModal();
          this.showSnackbar('User created successfully', 'success');
        },
        error: (error) => {
          console.error('Error creating user:', error);
          this.showSnackbar('Failed to create user', 'error');
        }
      });
    } else {
      this.userService.updateUser(editingUser.id, {
        name: val.name!,
        email: val.email!,
        role: val.role as any,
      }).subscribe({
        next: () => {
          this.loadUsers();
          this.closeUserModal();
          this.showSnackbar('User updated successfully', 'success');
        },
        error: (error) => {
          console.error('Error updating user:', error);
          this.showSnackbar('Failed to update user', 'error');
        }
      });
    }
  }

  confirmDeleteUser(userId: number): void {
    this.deletingUserId.set(userId);
    this.showDeleteUserModal.set(true);
  }

  closeDeleteUserModal(): void {
    this.showDeleteUserModal.set(false);
    this.deletingUserId.set(null);
  }

  deleteUser(): void {
    const id = this.deletingUserId();
    if (id !== null) {
      this.userService.softDeleteUser(id).subscribe({
        next: () => {
          this.loadUsers();
          this.closeDeleteUserModal();
          this.showSnackbar('User archived successfully', 'success');
        },
        error: (error) => {
          console.error('Error archiving user:', error);
          this.showSnackbar('Failed to archive user', 'error');
        }
      });
    }
  }

  restoreUser(userId: number): void {
    this.userService.restoreUser(userId).subscribe({
      next: () => {
        this.loadUsers();
        this.showSnackbar('User restored successfully', 'success');
      },
      error: (error) => {
        console.error('Error restoring user:', error);
        this.showSnackbar('Failed to restore user', 'error');
      }
    });
  }

  openResetPasswordModal(userId: number): void {
    this.resettingPasswordUserId.set(userId);
    this.resetPasswordForm.reset();
    this.showResetPasswordModal.set(true);
  }

  closeResetPasswordModal(): void {
    this.showResetPasswordModal.set(false);
    this.resettingPasswordUserId.set(null);
  }

  resetPassword(): void {
    const id = this.resettingPasswordUserId();
    if (id !== null) {
      // TODO: Update service to send password reset email instead of direct reset
      this.userService.resetPassword(id, '').subscribe({
        next: () => {
          this.closeResetPasswordModal();
          this.showSnackbar('Password reset email sent successfully', 'success');
        },
        error: (error) => {
          console.error('Error sending password reset:', error);
          this.showSnackbar('Failed to send password reset email', 'error');
        }
      });
    }
  }

  async confirmLogout(): Promise<void> {
    this.isLoading.set(true);
    this.showLogoutModal.set(false);
    await this.router.navigate(['/login']);
    this.isLoading.set(false);
  }

  async logout(): Promise<void> {
    this.openLogoutModal();
  }

  sortBy(field: 'name' | 'attendance' | 'hours' | 'tasks' | 'rating'): void {
    if (this.sortField() === field) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
    this.performancePage.set(1);
  }

  previousPerformancePage(): void {
    if (this.performancePage() > 1) {
      this.performancePage.update((p) => p - 1);
    }
  }

  nextPerformancePage(): void {
    if (this.performancePage() < this.performanceTotalPages()) {
      this.performancePage.update((p) => p + 1);
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
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (current > 3) {
        pages.push(-1);
      }
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (current < total - 2) {
        pages.push(-1);
      }
      pages.push(total);
    }
    return pages;
  }

  getRatingStars(rating: number): string {
    return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
  }

  getPerformanceLevel(attendanceRate: number): string {
    if (attendanceRate >= 90) {
      return 'Excellent';
    }
    if (attendanceRate >= 80) {
      return 'Good';
    }
    if (attendanceRate >= 70) {
      return 'Fair';
    }
    return 'Needs Improvement';
  }

  getPerformanceLevelClass(attendanceRate: number): string {
    if (attendanceRate >= 90) {
      return 'level-excellent';
    }
    if (attendanceRate >= 80) {
      return 'level-good';
    }
    if (attendanceRate >= 70) {
      return 'level-fair';
    }
    return 'level-needs-improvement';
  }

  private loadRsvps(): void {
    this.rsvpService.getRsvps().subscribe((response) => {
      this.rsvps.set(response.data);
    });
  }

  get rsvpShifts(): FormArray {
    return this.rsvpForm.get('shifts') as FormArray;
  }

  openShareRsvpModal(rsvp: Rsvp): void {
    this.sharingRsvp.set(rsvp);
    this.showShareRsvpModal.set(true);
  }

  closeShareRsvpModal(): void {
    this.sharingRsvp.set(null);
    this.showShareRsvpModal.set(false);
  }

  getShareLink(): string {
    const rsvp = this.sharingRsvp();
    if (!rsvp) return '';
    if (rsvp.shareUrl) return rsvp.shareUrl;
    return `${window.location.origin}/rsvp?id=${rsvp.id}`;
  }

  copyShareLink(): void {
    const link = this.getShareLink();
    if (!link) return;
    navigator.clipboard.writeText(link).then(
      () => {
        this.showSnackbar('Link copied to clipboard', 'success');
        this.closeShareRsvpModal();
      },
      () => {
        this.showSnackbar('Failed to copy link', 'error');
      }
    );
  }

   private rsvpShiftTimeRangeValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const start = group.get('startTime')?.value as string | undefined;
      const end = group.get('endTime')?.value as string | undefined;
      if (!start || !end) {
        return null;
      }
      return start < end ? null : { invalidTimeRange: true };
    };
  }

  openCreateRsvpModal(): void {
    this.editingRsvp.set(null);
    this.rsvpForm.reset();
    this.rsvpShifts.clear();
    this.addRsvpShift();
    this.addRsvpShift();
    this.showRsvpModal.set(true);
  }

  openEditRsvpModal(rsvp: Rsvp): void {
    this.editingRsvp.set(rsvp);
    this.rsvpShifts.clear();
    

    const parseBackendTime = (timeString: string): string => {
      if (!timeString) return '';
      if (/^\d{2}:\d{2}$/.test(timeString)) {
        return timeString;
      }
      if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
        return timeString.substring(0, 5);
      }
      const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!timeMatch) {
        return '';
      }
      const [, hours, minutes, ampm] = timeMatch;
      let hour = parseInt(hours, 10);
      if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      return `${hour.toString().padStart(2, '0')}:${minutes}`;
    };

    rsvp.shifts.forEach((shift) => {
      let startTime = '';
      let endTime = '';

      // Try to parse timeSlot (e.g. "04:30 - 14:00")
      if (shift.timeSlot) {
        const parts = shift.timeSlot.split('-').map(p => p.trim());
        if (parts.length === 2) {
          startTime = parseBackendTime(parts[0]);
          endTime = parseBackendTime(parts[1]);
        } else {
          // Fallback if format is unexpected
          startTime = parseBackendTime(shift.timeSlot);
        }
      }

      this.rsvpShifts.push(
        this.fb.group({
          startTime: [startTime, Validators.required],
          endTime: [endTime, Validators.required],
          capacity: [shift.capacity, [Validators.required, Validators.min(1)]],
        }, { validators: this.rsvpShiftTimeRangeValidator() })
      );
    });

    // Convert backend date strings to date input format (YYYY-MM-DD)
    const parseBackendDate = (dateString: string): string => {
      if (!dateString) return '';
      // If it's already in YYYY-MM-DD format, return as-is
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
      }
      
      const shortDateMatch = dateString.match(/^(\w{3})\s+(\d{1,2})$/);
      if (shortDateMatch) {
        const [, month, day] = shortDateMatch;
        const year = new Date().getFullYear();
        const months: Record<string, number> = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        const monthNum = months[month];
        const dayNum = parseInt(day);
        const y = year.toString().padStart(4, '0');
        const m = (monthNum + 1).toString().padStart(2, '0');
        const d = dayNum.toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      
      const fullDateMatch = dateString.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
      if (fullDateMatch) {
        const [, month, day, year] = fullDateMatch;
        const months: Record<string, number> = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        const monthNum = months[month];
        const dayNum = parseInt(day);
        const yearNum = parseInt(year);
        const y = yearNum.toString().padStart(4, '0');
        const m = (monthNum + 1).toString().padStart(2, '0');
        const d = dayNum.toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
     
      // Fallback to original parsing
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; 
    };

    this.rsvpForm.patchValue({
      title: rsvp.title,
      eventLocation: rsvp.eventLocation ?? '',
      date: parseBackendDate(rsvp.date),
      cutOffDay: parseBackendDate(rsvp.cutOffDay),
      cutOffTime: parseBackendTime(rsvp.cutOffTime),
      description: rsvp.description,
    });

    this.showRsvpModal.set(true);
  }

  closeRsvpModal(): void {
    this.showRsvpModal.set(false);
    this.editingRsvp.set(null);
    this.rsvpForm.reset();
  }

  addRsvpShift(): void {
    this.rsvpShifts.push(
      this.fb.group({
        startTime: ['', Validators.required],
        endTime: ['', Validators.required],
        capacity: [10, [Validators.required, Validators.min(1)]],
      }, { validators: this.rsvpShiftTimeRangeValidator() })
    );
  }

  removeRsvpShift(index: number): void {
    if (this.rsvpShifts.length > 1) {
      this.rsvpShifts.removeAt(index);
    }
  }

  saveRsvp(): void {
    if (this.rsvpForm.invalid) {
      this.rsvpForm.markAllAsTouched();
      return;
    }

    // Set loading state
    this.isCreatingRsvp.set(true);

    const formValue = this.rsvpForm.value;

    // Format dates for backend - date inputs return ISO strings
    const formatDateForBackend = (dateString: string): string => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    };

    // Format time for backend - time input returns HH:MM format
    const formatTimeForBackend = (timeString: string): string => {
      if (!timeString) return '';
      // Return HH:MM:SS format for MySQL TIME column
      return timeString + ':00';
    };

    // Build a snake_case payload that matches the Laravel backend expectations.
    // The frontend form / DTO uses camelCase; the API requires snake_case field names.
    const payload = {
      title: formValue.title!,
      event_location: formValue.eventLocation!,
      date: formatDateForBackend(formValue.date!),
      cutoff_day: formatDateForBackend(formValue.cutOffDay!),
      cutoff_time: formatTimeForBackend(formValue.cutOffTime!),
      description: formValue.description!,
      shifts: (formValue.shifts as { startTime: string; endTime: string; capacity: number }[]).map((opt) => {
        const timeSlotStr = `${opt.startTime} - ${opt.endTime}`;
        return {
          // `text` is required by the backend (stored in the `option` lookup table).
          // Use the combined time slot as the option text since that is the human-readable label.
          text: timeSlotStr,
          time_slot: timeSlotStr,
          capacity: opt.capacity,
        };
      }),
    };

    const editingRsvp = this.editingRsvp();
    if (editingRsvp) {
      this.rsvpService.updateRsvp(editingRsvp.id, payload).subscribe({
        next: () => {
          this.loadRsvps();
          this.closeRsvpModal();
          this.showSnackbar('RSVP updated successfully', 'success');
          this.isCreatingRsvp.set(false);
        },
        error: () => {
          this.showSnackbar('RSVP update failed', 'error');
          this.isCreatingRsvp.set(false);
        }
      });
    } else {
      this.rsvpService.createRsvp(payload).subscribe({
        next: () => {
          this.loadRsvps();
          this.closeRsvpModal();
          this.showSnackbar('RSVP created successfully', 'success');
          this.isCreatingRsvp.set(false);
        },
        error: () => {
          this.showSnackbar('RSVP creation failed', 'error');
          this.isCreatingRsvp.set(false);
        }
      });
    }
  }

  confirmDeleteRsvp(rsvpId: number): void {
    this.deletingRsvpId.set(rsvpId);
    this.showDeleteRsvpModal.set(true);
  }

  closeDeleteRsvpModal(): void {
    this.showDeleteRsvpModal.set(false);
    this.deletingRsvpId.set(null);
  }

  deleteRsvp(): void {
    const rsvpId = this.deletingRsvpId();
    if (rsvpId !== null) {
      // Set loading state
      this.isDeletingRsvp.set(true);

      this.rsvpService.deleteRsvp(rsvpId).subscribe({
        next: () => {
          this.loadRsvps();
          this.closeDeleteRsvpModal();
          this.showSnackbar('RSVP deleted successfully', 'success');
          this.isDeletingRsvp.set(false);
        },
        error: () => {
          this.showSnackbar('RSVP deletion failed', 'error');
          this.isDeletingRsvp.set(false);
        }
      });
    }
  }

  updateRsvpStatus(rsvpId: number, status: 'active' | 'closed' | 'draft'): void {
    this.rsvpService.updateRsvpStatus(rsvpId, status).subscribe(() => {
      this.loadRsvps();
    });
  }

  notifyRsvp(rsvp: Rsvp): void {
    forkJoin([
      this.rsvpService.notifyFacebook(rsvp.id),
      this.rsvpService.notifySms(rsvp.id),
    ]).subscribe({
      next: ([facebookResult, smsResult]) => {
        this.showSnackbar(
          `Notifications sent. Facebook: ${facebookResult.sent}/${facebookResult.total}, SMS: ${smsResult.sent}/${smsResult.total}`,
          'success',
        );
      },
      error: () => {
        this.showSnackbar('Failed to send RSVP notifications', 'error');
      },
    });
  }

  setRsvpFilterStatus(status: 'all' | 'active' | 'closed' | 'draft'): void {
    this.rsvpFilterStatus.set(status);
  }

  openCreateVolunteerModal(): void {
    this.editingVolunteer.set(null);
    this.volunteerForm.reset();
    this.showVolunteerModal.set(true);
  }

  openEditVolunteerModal(volunteer: DashboardVolunteerRow): void {
    this.editingVolunteer.set(volunteer);
    this.volunteerForm.patchValue({
      firstName: volunteer.name.split(' ')[0],
      lastName: volunteer.name.split(' ').slice(1).join(' '),
      email: volunteer.email,
      mobileNumber: volunteer.phone,
      birthdate: '',
      completeAddress: '',
      educationalAttainment: '',
      facebookName: '',
    });
    this.showVolunteerModal.set(true);
  }

  closeVolunteerModal(): void {
    this.showVolunteerModal.set(false);
    this.editingVolunteer.set(null);
    this.volunteerForm.reset();
  }

  saveVolunteer(): void {
    if (this.volunteerForm.invalid) {
      this.volunteerForm.markAllAsTouched();
      return;
    }

    const formValue = this.volunteerForm.value;
    console.log('Save volunteer:', formValue);
    this.closeVolunteerModal();
    this.loadDashboardData();
  }

  confirmDeleteVolunteer(volunteerId: number): void {
    this.deletingVolunteerId.set(volunteerId);
    this.showDeleteVolunteerModal.set(true);
  }

  closeDeleteVolunteerModal(): void {
    this.showDeleteVolunteerModal.set(false);
    this.deletingVolunteerId.set(null);
  }

  deleteVolunteer(): void {
    const volunteerId = this.deletingVolunteerId();
    if (volunteerId !== null) {
      this.adminDashboardService.softDeleteVolunteer(volunteerId).subscribe({
        next: (response) => {
          if (response.success) {
            console.log('Volunteer archived successfully');
            
            // Immediately remove from active volunteers list
            const currentRows = this.volunteerRows();
            const updatedRows = currentRows.filter(v => v.id !== volunteerId);
            this.volunteerRows.set(updatedRows);
            
            // Reset to page 1 if current page becomes empty
            if (updatedRows.length > 0 && this.volunteersPage() > Math.ceil(updatedRows.length / this.volunteersPerPage())) {
              this.volunteersPage.set(1);
            }

            // Show success snackbar
            this.showSnackbar('Volunteer archived successfully', 'success');
          }
          this.closeDeleteVolunteerModal();
        },
        error: (error) => {
          console.error('Error archiving volunteer:', error);
          this.showSnackbar('Failed to archive volunteer', 'error');
          this.closeDeleteVolunteerModal();
        }
      });
    }
  }

  restoreVolunteer(volunteerId: number): void {
    this.adminDashboardService.restoreVolunteer(volunteerId).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('Volunteer restored successfully');
          
          // Immediately remove from archived volunteers list
          const currentArchived = this.archivedVolunteerRows();
          const updatedArchived = currentArchived.filter(v => v.id !== volunteerId);
          this.archivedVolunteerRows.set(updatedArchived);
          
          // Reset to page 1 if current page becomes empty
          if (updatedArchived.length > 0 && this.volunteersPage() > Math.ceil(updatedArchived.length / this.volunteersPerPage())) {
            this.volunteersPage.set(1);
          }
          
          // Show success snackbar
          this.showSnackbar('Volunteer restored successfully', 'success');
          
          // Reload active volunteers to include restored one
          this.loadDashboardData();
        }
      },
      error: (error) => {
        console.error('Error restoring volunteer:', error);
        this.showSnackbar('Failed to restore volunteer', 'error');
      }
    });
  }

  toggleArchivedVolunteers(): void {
    this.showArchivedVolunteers.update(show => !show);
  }

  toggleAiSidebar(): void {
    this.showAiSidebar.update(show => !show);
  }

  closeAiSidebar(): void {
    this.showAiSidebar.set(false);
  }

  showSnackbar(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.snackbarMessage.set(message);
    this.snackbarType.set(type);
    this.snackbarSlideOut.set(false);
    this.snackbarVisible.set(true);

    // Auto-hide after 3 seconds with slide-out animation
    setTimeout(() => {
      this.snackbarSlideOut.set(true);
      
      setTimeout(() => {
        this.snackbarVisible.set(false);
        this.snackbarSlideOut.set(false);
      }, 300);
    }, 3000);
  }

  loadArchivedVolunteers(): void {
    this.adminDashboardService.getArchivedVolunteers().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Map archived volunteers to DashboardVolunteerRow format
          const archivedRows: DashboardVolunteerRow[] = response.data.map(v => ({
            id: v.volunteer_id,
            name: v.full_name,
            email: v.email,
            phone: v.mobile_number || 'N/A',
            facebookName: v.facebook_name,
            department: 'Volunteer', // Default department
            status: 'inactive' as 'active' | 'inactive',
            joined_date: v.created_at
          }));
          this.archivedVolunteerRows.set(archivedRows);
        } else {
          this.archivedVolunteerRows.set([]);
        }
      },
      error: (error) => {
        console.error('Error loading archived volunteers:', error);
        this.archivedVolunteerRows.set([]);
      }
    });
  }

  switchToActiveVolunteers(): void {
    this.showArchivedVolunteers.set(false);
    this.volunteersPage.set(1);
  }

  switchToArchivedVolunteers(): void {
    this.showArchivedVolunteers.set(true);
    this.volunteersPage.set(1);
    this.loadArchivedVolunteers();
  }

  setVolunteerSearchQuery(query: string): void {
    this.volunteerSearchQuery.set(query);
    this.volunteersPage.set(1);
  }

  getResponsePercentage(rsvp: Rsvp, shift: RsvpShift): number {
    return rsvp.totalResponses > 0 ? (shift.responses / rsvp.totalResponses) * 100 : 0;
  }

  getRemainingSlots(shift: RsvpShift): number {
    return shift.capacity - shift.responses;
  }

  isFull(shift: RsvpShift): boolean {
    return shift.responses >= shift.capacity;
  }

  // Helper function to format time from 24-hour to 12-hour format with AM/PM
  formatTimeTo12Hour(time24: string): string {
    if (!time24) return '';
    
    let hours: number, minutes: string;
    
    // Handle various time formats
    if (time24.includes(':')) {
      const parts = time24.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parts[1];
    } else if (time24.includes('AM') || time24.includes('PM')) {
      return time24.trim();
    } else {
      return time24;
    }
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
    
    return `${displayHours}:${minutes} ${period}`;
  }

  // Helper function to format time slot for display
  formatTimeSlot(timeSlot: string): string {
    if (!timeSlot) return '';
    
    // Handle format like "13:00 - 14:00" or "9:00 AM - 12:00 PM"
    if (timeSlot.includes(' - ')) {
      const parts = timeSlot.split(' - ');
      const startTime = this.formatTimeTo12Hour(parts[0].trim());
      const endTime = this.formatTimeTo12Hour(parts[1].trim());
      return `${startTime} - ${endTime}`;
    }
    
    return this.formatTimeTo12Hour(timeSlot);
  }

  // Analytics methods
  loadAnalyticsData(): void {
    this.analyticsLoading.set(true);
    this.analyticsService.getReportData(this.dateRangeFilter(), this.selectedDepartmentFilter() || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.reportData.set(response.data);
        }
        this.analyticsLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading analytics data:', error);
        this.analyticsLoading.set(false);
      }
    });
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

  setDepartmentFilter(departmentName: string | null): void {
    this.selectedDepartmentFilter.set(departmentName);
    this.skillsPage.set(1);
    this.departmentsPage.set(1);
    this.loadAnalyticsData();
  }

  onDepartmentFilterChange(value: string): void {
    this.setDepartmentFilter(value || null);
  }

  nextSkillsPage(): void {
    if (this.skillsPage() < this.totalSkillsPages()) {
      this.skillsPage.update(p => p + 1);
    }
  }

  previousSkillsPage(): void {
    if (this.skillsPage() > 1) {
      this.skillsPage.update(p => p - 1);
    }
  }

  nextDepartmentsPage(): void {
    if (this.departmentsPage() < this.totalDepartmentsPages()) {
      this.departmentsPage.update(p => p + 1);
    }
  }

  previousDepartmentsPage(): void {
    if (this.departmentsPage() > 1) {
      this.departmentsPage.update(p => p - 1);
    }
  }

  exportReport(format: 'pdf' | 'excel'): void {
    this.analyticsLoading.set(true);
    const dateRange = this.dateRangeFilter();
    const exportObservable = format === 'pdf'
      ? this.analyticsService.exportToPdf(dateRange)
      : this.analyticsService.exportToExcel(dateRange);

    exportObservable.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `servetrack-analytics-report-${timestamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        this.analyticsService.downloadFile(blob, filename);
        this.showSnackbar(`${format.toUpperCase()} report downloaded successfully`, 'success');
        this.analyticsLoading.set(false);
      },
      error: (error) => {
        console.error('Error exporting report:', error);
        this.showSnackbar('Failed to export report', 'error');
        this.analyticsLoading.set(false);
      }
    });
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'registration':
        return '👤';
      case 'attendance':
        return '✓';
      case 'task':
        return '📋';
      case 'event':
        return '📅';
      default:
        return '📌';
    }
  }

  getActivityTypeClass(type: string): string {
    switch (type) {
      case 'registration':
        return 'activity-registration';
      case 'attendance':
        return 'activity-attendance';
      case 'task':
        return 'activity-task';
      case 'event':
        return 'activity-event';
      default:
        return '';
    }
  }

  private safeDate(dateValue: string): Date | null {
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
