import { Routes } from '@angular/router';
import { LandingPage } from './landing-page/landing-page';
import { VotingPoll } from './voting-poll/voting-poll';
import { Login } from './auth/login/login';
import { Signup } from './auth/signup/signup';
import { SignupForm } from './auth/signup-form/signup-form';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'signup-form', component: SignupForm },
  { path: 'voting-poll', component: VotingPoll },
  {
    path: 'terms-of-service',
    loadComponent: () => import('./terms-of-service/terms-of-service').then(m => m.TermsOfService)
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./privacy-policy/privacy-policy').then(m => m.PrivacyPolicy)
  },
  { path: '**', redirectTo: '' }
];
