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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should correctly calculate total votes', () => {
    const expectedTotal = component.pollOptions.reduce((sum, opt) => sum + opt.votes, 0);
    expect(component.totalVotes).toBe(expectedTotal);
  });

  it('should calculate vote percentage correctly', () => {
    const totalVotes = component.totalVotes;
    const optionVotes = component.pollOptions[0].votes;
    const expectedPercentage = (optionVotes / totalVotes) * 100;
    expect(component.getVotePercentage(optionVotes)).toBe(expectedPercentage);
  });

  it('should return 0 percentage if total votes is 0', () => {
    // Set all votes to 0
    component.pollOptions.forEach((opt) => (opt.votes = 0));
    expect(component.getVotePercentage(10)).toBe(0);
  });

  it('should correctly calculate remaining slots', () => {
    const option = component.pollOptions[0];
    const expectedRemaining = option.capacity - option.votes;
    expect(component.getRemainingSlots(option)).toBe(expectedRemaining);
  });

  it('should correctly identify if an option is full', () => {
    const fullOption = { id: 99, timeSlot: 'test', votes: 10, capacity: 10 };
    expect(component.isFull(fullOption)).toBe(true);

    const notFullOption = { id: 98, timeSlot: 'test', votes: 5, capacity: 10 };
    expect(component.isFull(notFullOption)).toBe(false);

    const overFullOption = { id: 97, timeSlot: 'test', votes: 11, capacity: 10 };
    expect(component.isFull(overFullOption)).toBe(true);
  });

  it('should select an option if it is not full', () => {
    const option = component.pollOptions[0];
    component.selectOption(option.id);
    expect(option.selected).toBe(true);
    expect(component.hasSelectedOption).toBe(true);
  });

  it('should not select an option if it is full', () => {
    const option = component.pollOptions[0];
    option.votes = option.capacity;
    component.selectOption(option.id);
    expect(option.selected).toBe(false);
    expect(component.hasSelectedOption).toBe(false);
  });

  it('should deselect previous option when selecting a new one', () => {
    const firstOption = component.pollOptions[0];
    const secondOption = component.pollOptions[1];

    component.selectOption(firstOption.id);
    expect(firstOption.selected).toBe(true);

    component.selectOption(secondOption.id);
    expect(firstOption.selected).toBe(false);
    expect(secondOption.selected).toBe(true);
  });

  it('should submit vote correctly', () => {
    const option = component.pollOptions[0];
    const initialVotes = option.votes;
    option.selected = true;

    component.submitVote();

    expect(option.votes).toBe(initialVotes + 1);
    expect(option.selected).toBe(false);
  });

  it('should not submit vote if no option is selected', () => {
    const initialTotalVotes = component.totalVotes;
    component.submitVote();
    expect(component.totalVotes).toBe(initialTotalVotes);
  });

  it('should not submit vote if selected option is full', () => {
    const option = component.pollOptions[0];
    option.votes = option.capacity;
    option.selected = true;

    component.submitVote();

    expect(option.votes).toBe(option.capacity);
    expect(option.selected).toBe(true); // Logic in submitVote only sets selected to false if it increments votes
  });

  it('should correctly report if it has a selected option', () => {
    expect(component.hasSelectedOption).toBe(false);
    component.pollOptions[0].selected = true;
    expect(component.hasSelectedOption).toBe(true);
  });
});
