import { Injectable } from '@angular/core';
import { Command } from '../models/command.model';

export const VOLUNTEER_COMMANDS: Command[] = [
  {
    id: 'events',
    command: '/events',
    text: 'Upcoming events',
    icon: 'calendar',
    description: 'Show all upcoming RSVP events I can join',
    action: { type: 'query', label: 'View Events' },
  },
  {
    id: 'attendance',
    command: '/attendance',
    text: 'My attendance',
    icon: 'clipboard',
    description: 'View my attendance records for all events',
    action: { type: 'query', label: 'View Attendance' },
  },
  {
    id: 'hours',
    command: '/hours',
    text: 'Volunteer hours',
    icon: 'clock',
    description: 'How many volunteer hours have I logged this month?',
    action: { type: 'query', label: 'View Hours' },
  },
  {
    id: 'schedule',
    command: '/schedule',
    text: 'Next schedule',
    icon: 'calendar-check',
    description: 'When is my next volunteer shift or event?',
    action: { type: 'query', label: 'View Schedule' },
  },
  {
    id: 'help',
    command: '/help',
    text: 'Get help',
    icon: 'help',
    description: 'What can you help me with?',
    action: { type: 'query', label: 'Help' },
  },
  {
    id: 'tips',
    command: '/tips',
    text: 'Volunteer tips',
    icon: 'lightbulb',
    description: 'Give me tips on being a better volunteer',
    action: { type: 'query', label: 'Tips' },
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
