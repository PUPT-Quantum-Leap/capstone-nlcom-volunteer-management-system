import { Routes } from '@angular/router';
import { LandingPage } from './landing-page/landing-page';
import { RsvpComponent } from './rsvp/rsvp';
import { Login } from './auth/login/login';
import { FacebookOAuthCallbackComponent } from './auth/facebook-oauth-callback/facebook-oauth-callback';
import { SupabaseAuthCallbackComponent } from './auth/supabase-auth-callback/supabase-auth-callback';
import { Signup } from './auth/signup/signup';
import { SignupForm } from './auth/signup-form/signup-form';
import { AdminAuthPage } from './auth/admin-auth-page/admin-auth-page';
import { VolunteerDashboardShell } from './volunteer-dashboard/volunteer-dashboard-shell/volunteer-dashboard-shell';
import { OverviewComponent } from './volunteer-dashboard/overview/overview';
import { ProfileComponent } from './volunteer-dashboard/profile/profile';
import { AttendanceComponent } from './volunteer-dashboard/attendance/attendance';
import { PollsComponent } from './volunteer-dashboard/polls/polls';
import { RequestsComponent } from './volunteer-dashboard/requests/requests';
import { AdminLayout } from './admin-dashboard/admin-layout/admin-layout';
import { DashboardComponent } from './admin-dashboard/dashboard/dashboard';
import { AnalyticsComponent } from './admin-dashboard/analytics/analytics';
import { UserManagementComponent } from './admin-dashboard/user-management/user-management';
import { OverviewDashboard } from './admin-dashboard/overview-dashboard/overview-dashboard';
import { VolunteerManagement } from './admin-dashboard/volunteer-management/volunteer-management';
import { AttendanceManagement } from './admin-dashboard/attendance-management/attendance-management';
import { PerformanceComponent } from './admin-dashboard/performance/performance';
import { SmsManagementComponent } from './admin-dashboard/sms-management/sms-management';
import { RsvpsComponent } from './admin-dashboard/rsvps/rsvps';
import { IcsComponent } from './admin-dashboard/ics/ics';
import { BackupRecoveryComponent } from './admin-dashboard/backup-recovery/backup-recovery';
import { NotFound } from './not-found/not-found';
import { IncidentCommandSystemComponent } from './incident-command-system/incident-command-system';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: 'login', component: Login },
  { path: 'auth/facebook/callback', component: FacebookOAuthCallbackComponent },
  { path: 'auth/callback', component: SupabaseAuthCallbackComponent },
  { path: 'signup', component: Signup },
  { path: 'signup-form', component: SignupForm },
  { path: 'admin-auth', component: AdminAuthPage },
  { path: 'admin-login', redirectTo: 'admin-auth', pathMatch: 'full' },
  { path: 'admin-signup', redirectTo: 'admin-auth?tab=signup', pathMatch: 'full' },
  { path: 'rsvp', component: RsvpComponent },
  { path: 'rsvp/:slug', component: RsvpComponent },
  { path: 'incident-command-system', component: IncidentCommandSystemComponent },
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
      { path: 'requests', component: RequestsComponent },
    ],
  },
  {
    path: 'admin-dashboard',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'analytics', component: AnalyticsComponent },
      { path: 'user-management', component: UserManagementComponent },
      { path: 'volunteers', component: VolunteerManagement },
      { path: 'attendance', component: AttendanceManagement },
      { path: 'performance', component: PerformanceComponent },
      { path: 'sms', component: SmsManagementComponent },
      { path: 'rsvps', component: RsvpsComponent },
      { path: 'ics', component: IcsComponent },
      { path: 'backup-recovery', component: BackupRecoveryComponent },
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
