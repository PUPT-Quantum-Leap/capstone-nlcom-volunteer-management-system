import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandPaletteService, VOLUNTEER_COMMANDS } from './command-palette.service';

describe('CommandPaletteService', () => {
  let service: CommandPaletteService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [CommandPaletteService] });
    service = TestBed.inject(CommandPaletteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getCommands returns all 6 volunteer commands', () => {
    expect(service.getCommands().length).toBe(6);
  });

  it('all VOLUNTEER_COMMANDS have required fields', () => {
    for (const cmd of VOLUNTEER_COMMANDS) {
      expect(cmd.id).toBeTruthy();
      expect(cmd.command).toMatch(/^\//);
      expect(cmd.text).toBeTruthy();
      expect(cmd.icon).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.action).toBeTruthy();
    }
  });

  it('filterCommands returns all when query is empty', () => {
    expect(service.filterCommands('').length).toBe(6);
  });

  it('filterCommands matches by id', () => {
    const results = service.filterCommands('events');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('events');
  });

  it('filterCommands matches by command prefix', () => {
    const results = service.filterCommands('/att');
    expect(results.some((c) => c.id === 'attendance')).toBe(true);
  });

  it('filterCommands is case-insensitive', () => {
    expect(service.filterCommands('HOURS').length).toBeGreaterThan(0);
  });

  it('filterCommands returns empty for no match', () => {
    expect(service.filterCommands('zzznomatch').length).toBe(0);
  });

  it('trackCommandUsage stores recent commands', () => {
    service.trackCommandUsage('events');
    const recent = service.getRecentCommands();
    expect(recent[0].id).toBe('events');
  });

  it('trackCommandUsage deduplicates', () => {
    service.trackCommandUsage('events');
    service.trackCommandUsage('hours');
    service.trackCommandUsage('events');
    const recent = service.getRecentCommands();
    expect(recent.filter((c) => c.id === 'events').length).toBe(1);
    expect(recent[0].id).toBe('events');
  });

  it('getRecentCommands returns empty initially', () => {
    expect(service.getRecentCommands().length).toBe(0);
  });
});
