import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VotingPoll } from './voting-poll';

describe('VotingPoll', () => {
  let component: VotingPoll;
  let fixture: ComponentFixture<VotingPoll>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
<<<<<<< HEAD
      imports: [VotingPoll]
    })
    .compileComponents();
=======
      imports: [VotingPoll],
    }).compileComponents();
>>>>>>> origin/main

    fixture = TestBed.createComponent(VotingPoll);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
