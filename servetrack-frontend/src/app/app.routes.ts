import { Routes } from '@angular/router';
import { LandingPage } from './landing-page/landing-page';
import { RsvpComponent } from './rsvp/rsvp';
import { Login } from './auth/login/login';
import { FacebookOAuthCallbackComponent } from './auth/facebook-oauth-callback/facebook-oauth-callback';
import { Signup } from './auth/signup/signup';
import { SignupForm } from './auth/signup-form/signup-form';
import { AdminAuthPage } from './auth/admin-auth-page/admin-auth-page';
import { VolunteerDashboard } from './volunteer-dashboard/volunteer-dashboard';
import { DashboardOverview } from './volunteer-dashboard/pages/dashboard-overview/dashboard-overview';
import { Profile } from './volunteer-dashboard/pages/profile/profile';
import { Schedule } from './volunteer-dashboard/pages/schedule/schedule';
import { Polls } from './volunteer-dashboard/pages/polls/polls';
import { RequestChanges } from './volunteer-dashboard/pages/request-changes/request-changes';
import { AdminDashboard } from './admin-dashboard/admin-dashboard';
import { NotFound } from './not-found/not-found';
import { IncidentCommandSystemComponent } from './incident-command-system/incident-command-system';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: 'login', component: Login },
  { path: 'auth/facebook/callback', component: FacebookOAuthCallbackComponent },
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
    component: VolunteerDashboard,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: DashboardOverview },
      { path: 'profile', component: Profile },
      { path: 'schedule', component: Schedule },
      { path: 'polls', component: Polls },
      { path: 'request-changes', component: RequestChanges },
    ],
  },
  { path: 'admin-dashboard', component: AdminDashboard, canActivate: [authGuard] },
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
