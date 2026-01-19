import { Routes } from '@angular/router';
import { LandingPage } from './landing-page/landing-page';
import { VotingPoll } from './voting-poll/voting-poll';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: 'voting-poll', component: VotingPoll },
  { path: '**', redirectTo: '' }
];
