import { Routes } from '@angular/router';
import { LandingPage } from './landing-page/landing-page';
import { VotingPoll } from './voting-poll/voting-poll';
import { Login } from './auth/login/login';
import { Signup } from './auth/signup/signup';
import { TermsOfService } from './terms-of-service/terms-of-service';
import { PrivacyPolicy } from './privacy-policy/privacy-policy';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'voting-poll', component: VotingPoll },
  { path: 'terms-of-service', component: TermsOfService },
  { path: 'privacy-policy', component: PrivacyPolicy },
  { path: '**', redirectTo: '' }
];
