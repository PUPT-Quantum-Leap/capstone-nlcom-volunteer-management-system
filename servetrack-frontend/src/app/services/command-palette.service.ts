import { Injectable } from '@angular/core';
import { Command } from '../models/command.model';

export const VOLUNTEER_COMMANDS: Command[] = [
  {
    id: 'events',
    command: '/events',
    text: 'List upcoming events',
    icon: 'bi-calendar-event',
    description: 'Show all upcoming RSVP events you can join',
    action: { type: 'query', label: 'View Events', params: { limit: 10 } },
  },
  {
    id: 'attendance',
    command: '/attendance',
    text: 'Check my attendance',
    icon: 'bi-clipboard-check',
    description: 'View your attendance records for all events',
    action: { type: 'query', label: 'View Attendance' },
  },
  {
    id: 'hours',
    command: '/hours',
    text: 'View my volunteer hours',
    icon: 'bi-hourglass-end',
    description: 'Check total volunteer hours logged this month',
    action: { type: 'query', label: 'View Hours' },
  },
  {
    id: 'feedback',
    command: '/feedback',
    text: 'Send feedback',
    icon: 'bi-chat-left-quote',
    description: 'Share feedback about your volunteer experience',
    action: { type: 'modal', label: 'Open Feedback Form' },
  },
  {
    id: 'help',
    command: '/help',
    text: 'Get help',
    icon: 'bi-question-circle',
    description: 'View FAQs and common questions',
    action: { type: 'url', label: 'Open Help', url: '/help' },
  },
  {
    id: 'profile',
    command: '/profile',
    text: 'View my profile',
    icon: 'bi-person-circle',
    description: 'Edit your volunteer profile information',
    action: { type: 'url', label: 'Go to Profile', url: '/profile' },
  },
];

const STORAGE_KEY_RECENT = 'chatbot_recent_commands';

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private recentIds: string[] = this.loadRecent();

  getCommands(): Command[] {
    return VOLUNTEER_COMMANDS;
  }

  filterCommands(query: string): Command[] {
    const q = query.replace(/^\//, '').toLowerCase().trim();
    if (!q) return VOLUNTEER_COMMANDS;
    return VOLUNTEER_COMMANDS.filter(
      (c) =>
        c.id.includes(q) ||
        c.command.includes(q) ||
        c.text.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }

  getRecentCommands(): Command[] {
    return this.recentIds
      .map((id) => VOLUNTEER_COMMANDS.find((c) => c.id === id))
      .filter((c): c is Command => c !== undefined);
  }

  trackCommandUsage(cmdId: string): void {
    this.recentIds = [cmdId, ...this.recentIds.filter((id) => id !== cmdId)].slice(0, 5);
    localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(this.recentIds));
  }

  private loadRecent(): string[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT) ?? '[]');
    } catch {
      return [];
    }
  }
}
