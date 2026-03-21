import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { VotingPoll } from './voting-poll';

describe('VotingPoll', () => {
  let component: VotingPoll;
  let fixture: ComponentFixture<VotingPoll>;

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [VotingPoll],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(VotingPoll, {
        remove: {
          templateUrl: './voting-poll.html',
          styleUrl: './voting-poll-styles.scss',
        },
        add: {
          template: '<div>VotingPoll Component Mock Template</div>',
          styles: [],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VotingPoll);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
