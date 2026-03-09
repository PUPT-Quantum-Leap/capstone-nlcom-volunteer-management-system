import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Poll, CreatePollDto } from '../models/poll';

@Injectable({
  providedIn: 'root',
})
export class PollService {
  private http = inject(HttpClient);
  private apiUrl = '/api/polls';

  private mockPolls = signal<Poll[]>([
    {
      id: 1,
      title: 'Mobile Kitchen Operations',
      date: 'Sept 27',
      cutOffDay: 'THURSDAY',
      cutOffTime: '12NN',
      description: 'Select your preferred time slot for the mobile kitchen operations.',
      status: 'active',
      totalVotes: 19,
      createdAt: '2026-09-20',
      options: [
        { id: 1, timeSlot: '4:30am - 2:00pm', votes: 10, capacity: 15 },
        { id: 2, timeSlot: '4:30am - 7:00pm', votes: 6, capacity: 10 },
        { id: 3, timeSlot: '1:00pm - 7:00pm', votes: 3, capacity: 3 },
      ],
    },
    {
      id: 2,
      title: 'Community Outreach Program',
      date: 'Oct 15',
      cutOffDay: 'MONDAY',
      cutOffTime: '6PM',
      description: 'Vote for your preferred shift for the community outreach program.',
      status: 'active',
      totalVotes: 24,
      createdAt: '2026-10-01',
      options: [
        { id: 4, timeSlot: '8:00am - 12:00pm', votes: 15, capacity: 20 },
        { id: 5, timeSlot: '12:00pm - 4:00pm', votes: 9, capacity: 15 },
      ],
    },
    {
      id: 3,
      title: 'Disaster Relief Training',
      date: 'Nov 5',
      cutOffDay: 'FRIDAY',
      cutOffTime: '5PM',
      description: 'Choose your preferred session for disaster relief training.',
      status: 'draft',
      totalVotes: 0,
      createdAt: '2026-10-28',
      options: [
        { id: 6, timeSlot: '9:00am - 12:00pm', votes: 0, capacity: 25 },
        { id: 7, timeSlot: '1:00pm - 4:00pm', votes: 0, capacity: 25 },
      ],
    },
  ]);

  getPolls(): Observable<Poll[]> {
    return of(this.mockPolls());
  }

  getPollById(id: number): Observable<Poll | undefined> {
    const poll = this.mockPolls().find((p) => p.id === id);
    return of(poll);
  }

  createPoll(dto: CreatePollDto): Observable<Poll> {
    const newPoll: Poll = {
      id: Math.max(...this.mockPolls().map((p) => p.id)) + 1,
      title: dto.title,
      date: dto.date,
      cutOffDay: dto.cutOffDay,
      cutOffTime: dto.cutOffTime,
      description: dto.description,
      status: 'draft',
      totalVotes: 0,
      createdAt: new Date().toISOString(),
      options: dto.options.map((opt, index) => ({
        id: Date.now() + index,
        timeSlot: opt.timeSlot,
        votes: 0,
        capacity: opt.capacity,
      })),
    };

    this.mockPolls.update((polls) => [...polls, newPoll]);
    return of(newPoll);
  }

  updatePoll(id: number, dto: Partial<CreatePollDto>): Observable<Poll | undefined> {
    const pollIndex = this.mockPolls().findIndex((p) => p.id === id);
    if (pollIndex === -1) {
      return of(undefined);
    }

    this.mockPolls.update((polls) => {
      const updatedPolls = [...polls];
      const existingPoll = updatedPolls[pollIndex];
      
      updatedPolls[pollIndex] = {
        ...existingPoll,
        title: dto.title ?? existingPoll.title,
        date: dto.date ?? existingPoll.date,
        cutOffDay: dto.cutOffDay ?? existingPoll.cutOffDay,
        cutOffTime: dto.cutOffTime ?? existingPoll.cutOffTime,
        description: dto.description ?? existingPoll.description,
        options: dto.options
          ? dto.options.map((opt, index) => ({
              id: existingPoll.options[index]?.id ?? Date.now() + index,
              timeSlot: opt.timeSlot,
              votes: existingPoll.options[index]?.votes ?? 0,
              capacity: opt.capacity,
            }))
          : existingPoll.options,
      };

      return updatedPolls;
    });

    return of(this.mockPolls()[pollIndex]);
  }

  deletePoll(id: number): Observable<boolean> {
    this.mockPolls.update((polls) => polls.filter((p) => p.id !== id));
    return of(true);
  }

  updatePollStatus(id: number, status: 'active' | 'closed' | 'draft'): Observable<boolean> {
    this.mockPolls.update((polls) => {
      const updatedPolls = [...polls];
      const pollIndex = updatedPolls.findIndex((p) => p.id === id);
      if (pollIndex !== -1) {
        updatedPolls[pollIndex] = { ...updatedPolls[pollIndex], status };
      }
      return updatedPolls;
    });
    return of(true);
  }
}
