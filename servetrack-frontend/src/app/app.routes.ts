import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { RsvpComponent } from './rsvp/rsvp';
import { VolunteerAuthPage } from './auth/volunteer-auth-page/volunteer-auth-page';
import { FacebookOAuthCallbackComponent } from './auth/facebook-oauth-callback/facebook-oauth-callback';
import { AdminAuthPage } from './auth/admin-auth-page/admin-auth-page';
import { ForgotPasswordPage } from './auth/forgot-password-page/forgot-password-page';
import { ResetPasswordPage } from './auth/reset-password-page/reset-password-page';
import { VolunteerDashboardShell } from './volunteer-dashboard/volunteer-dashboard-shell/volunteer-dashboard-shell';
import { OverviewComponent } from './volunteer-dashboard/overview/overview';
import { ProfileComponent } from './volunteer-dashboard/profile/profile';
import { AttendanceComponent } from './volunteer-dashboard/attendance/attendance';
import { PollsComponent } from './volunteer-dashboard/polls/polls';
import { AdminLayout } from './admin-dashboard/admin-layout/admin-layout';
import { DashboardComponent } from './admin-dashboard/dashboard/dashboard';
import { AnalyticsComponent } from './admin-dashboard/analytics/analytics';
import { AnalyticsFeedingOperationComponent } from './admin-dashboard/analytics-feeding-operation/analytics-feeding-operation';
import { OverviewDashboard } from './admin-dashboard/overview-dashboard/overview-dashboard';
import { VolunteerManagement } from './admin-dashboard/volunteer-management/volunteer-management';
import { AttendanceManagement } from './admin-dashboard/attendance-management/attendance-management';
import { PerformanceComponent } from './admin-dashboard/performance/performance';
import { SmsManagementComponent } from './admin-dashboard/sms-management/sms-management';
import { RsvpsComponent } from './admin-dashboard/rsvps/rsvps';
import { SysadSettingsComponent } from './admin-dashboard/sysad-settings/sysad-settings';
import { NotFound } from './not-found/not-found';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { backupAccessGuard } from './guards/backup-access.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'volunteer-auth', component: VolunteerAuthPage, canActivate: [guestGuard] },
  { path: 'login', redirectTo: 'volunteer-auth', pathMatch: 'full' },
  { path: 'signup-form', redirectTo: 'volunteer-auth?tab=signup', pathMatch: 'full' },
  { path: 'auth/facebook/callback', component: FacebookOAuthCallbackComponent, canActivate: [guestGuard] },
  { path: 'admin-auth', component: AdminAuthPage, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordPage, canActivate: [guestGuard], data: { role: 'admin' } },
  { path: 'volunteer/forgot-password', component: ForgotPasswordPage, canActivate: [guestGuard], data: { role: 'volunteer' } },
  { path: 'reset-password', component: ResetPasswordPage, canActivate: [guestGuard] },
  { path: 'admin-login', redirectTo: 'admin-auth', pathMatch: 'full' },
  { path: 'admin-signup', redirectTo: 'admin-auth?tab=signup', pathMatch: 'full' },
  { path: 'rsvp', component: RsvpComponent },
  { path: 'rsvp/:slug', component: RsvpComponent },
  {
    path: 'incident-command-system',
    loadComponent: () =>
      import('./incident-command-system/incident-command-system').then((m) => m.IncidentCommandSystemComponent),
    canActivate: [authGuard],
  },
  {
    path: 'volunteer-dashboard',
    component: VolunteerDashboardShell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: OverviewComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'attendance', component: AttendanceComponent },
      { path: 'polls', component: PollsComponent },
    ],
  },
  {
    path: 'admin-dashboard',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'analytics/feeding-operation', redirectTo: 'operations', pathMatch: 'full' },
      { path: 'analytics', component: AnalyticsComponent },
      { path: 'volunteers', component: VolunteerManagement },
      { path: 'attendance', component: AttendanceManagement },
      { path: 'performance', component: PerformanceComponent },
      { path: 'operations', component: AnalyticsFeedingOperationComponent },
      { path: 'sms', component: SmsManagementComponent },
      { path: 'rsvps', component: RsvpsComponent },
      {
        path: 'ics',
        loadComponent: () =>
          import('./incident-command-system/incident-command-system').then((m) => m.IncidentCommandSystemComponent),
        canActivate: [authGuard],
      },
      { path: 'sysad-settings', component: SysadSettingsComponent, canActivate: [backupAccessGuard] },
    ],
  },
  {
    path: 'terms-of-service',
    loadComponent: () =>
      import('./terms-of-service/terms-of-service').then((m) => m.TermsOfService),
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./privacy-policy/privacy-policy').then((m) => m.PrivacyPolicy),
  },
  { path: '**', component: NotFound },
];
