import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PollOption {
  id: number;
  timeSlot: string;
  votes: number;
  selected?: boolean;
  capacity: number;
}

@Component({
  selector: 'app-voting-poll',
  imports: [CommonModule],
  templateUrl: './voting-poll.html',
  styleUrl: './voting-poll-styles.scss',
})
export class VotingPoll {
  pollTitle = 'Mobile Kitchen Operations';
  pollDate = 'Sept 27';
  cutOffDay = 'THURSDAY';
  cutOffTime = '12NN';
  
  pollOptions: PollOption[] = [
    { id: 1, timeSlot: '4:30am - 2:00pm', votes: 10, capacity: 15, selected: false },
    { id: 2, timeSlot: '4:30am - 7:00pm', votes: 6, capacity: 10, selected: false },
    { id: 3, timeSlot: '1:00pm - 7:00pm', votes: 3, capacity: 3, selected: false }
  ];

  get totalVotes(): number {
    return this.pollOptions.reduce((sum, option) => sum + option.votes, 0);
  }

  getVotePercentage(votes: number): number {
    return this.totalVotes > 0 ? (votes / this.totalVotes) * 100 : 0;
  }

  getRemainingSlots(option: PollOption): number {
    return option.capacity - option.votes;
  }

  isFull(option: PollOption): boolean {
    return option.votes >= option.capacity;
  }

  selectOption(optionId: number): void {
    const option = this.pollOptions.find(o => o.id === optionId);
    if (option && !this.isFull(option)) {
      this.pollOptions.forEach(opt => {
        opt.selected = opt.id === optionId;
      });
    }
  }

  submitVote(): void {
    const selectedOption = this.pollOptions.find(option => option.selected);
    if (selectedOption && !this.isFull(selectedOption)) {
      selectedOption.votes++;
      selectedOption.selected = false;
      console.log('Vote submitted for:', selectedOption.timeSlot);
    }
  }

  get hasSelectedOption(): boolean {
    return this.pollOptions.some(option => option.selected);
  }
}

