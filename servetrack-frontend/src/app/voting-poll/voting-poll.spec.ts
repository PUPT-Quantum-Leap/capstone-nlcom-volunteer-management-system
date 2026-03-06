import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VotingPoll } from './voting-poll';

describe('VotingPoll', () => {
  let component: VotingPoll;
  let fixture: ComponentFixture<VotingPoll>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VotingPoll],
    }).compileComponents();

    fixture = TestBed.createComponent(VotingPoll);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
