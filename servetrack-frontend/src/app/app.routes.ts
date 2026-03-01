import { Routes } from '@angular/router';
import { LandingPage } from './landing-page/landing-page';
import { VotingPoll } from './voting-poll/voting-poll';
import { Login } from './auth/login/login';
import { Signup } from './auth/signup/signup';
import { SignupForm } from './auth/signup-form/signup-form';
import { VolunteerDashboard } from './volunteer-dashboard/volunteer-dashboard';
import { AdminDashboard } from './admin-dashboard/admin-dashboard';
import { NotFound } from './not-found/not-found';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'signup-form', component: SignupForm },
  { path: 'voting-poll', component: VotingPoll },
  { path: 'volunteer-dashboard', component: VolunteerDashboard, canActivate: [authGuard] },
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
