import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ChatbotSidebarComponent } from './chatbot-sidebar.component';
import { ChatbotService } from '../../services/chatbot.service';
import { TTSService } from '../../services/tts.service';
import { VoiceInputService } from '../../services/voice-input.service';
import { CommandPaletteService } from '../../services/command-palette.service';

function setupSpeechMocks(): void {
  Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    value: { speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn(() => []), onvoiceschanged: null },
  });
  (window as any).SpeechRecognition = undefined;
  (window as any).webkitSpeechRecognition = undefined;
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({}) },
  });
}

describe('ChatbotSidebarComponent', () => {
  let component: ChatbotSidebarComponent;
  let fixture: ComponentFixture<ChatbotSidebarComponent>;

  beforeEach(async () => {
    localStorage.clear();
    setupSpeechMocks();

    await TestBed.configureTestingModule({
      imports: [ChatbotSidebarComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ChatbotService,
        TTSService,
        VoiceInputService,
        CommandPaletteService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatbotSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sidebar is closed by default', () => {
    expect(component.chatbotService.showChatbot()).toBe(false);
  });

  it('toggles settings panel', () => {
    expect(component.showSettings()).toBe(false);
    component.toggleSettings();
    expect(component.showSettings()).toBe(true);
    component.toggleSettings();
    expect(component.showSettings()).toBe(false);
  });

  it('toggles command palette', () => {
    expect(component.showCommandPalette()).toBe(false);
    component.toggleCommandPalette();
    expect(component.showCommandPalette()).toBe(true);
  });

  it('sendMessage clears input', () => {
    component.userInput.set('Hello');
    component.chatbotService.isLoading.set(false);
    // Mock the HTTP call to avoid real requests
    const spy = vi.spyOn(component.chatbotService, 'sendMessage').mockReturnValue({
      subscribe: vi.fn(),
    } as any);
    component.sendMessage();
    expect(component.userInput()).toBe('');
    spy.mockRestore();
  });

  it('sendMessage does nothing when input is empty', () => {
    const spy = vi.spyOn(component.chatbotService, 'sendMessage');
    component.userInput.set('   ');
    component.sendMessage();
    expect(spy).not.toHaveBeenCalled();
  });

  it('filteredCommands returns empty when input does not start with /', () => {
    component.userInput.set('hello');
    expect(component.filteredCommands().length).toBe(0);
  });

  it('filteredCommands returns commands when input starts with /', () => {
    component.userInput.set('/');
    expect(component.filteredCommands().length).toBeGreaterThan(0);
  });

  it('filteredCommands filters by command name', () => {
    component.userInput.set('/events');
    const results = component.filteredCommands();
    expect(results.some((c) => c.id === 'events')).toBe(true);
  });

  it('selectCommand tracks usage and clears palette', () => {
    const trackSpy = vi.spyOn(component.commandService, 'trackCommandUsage');
    const sendSpy = vi.spyOn(component.chatbotService, 'sendMessage').mockReturnValue({
      subscribe: vi.fn(),
    } as any);
    component.showCommandPalette.set(true);

    const cmd = component.commandService.getCommands()[0]; // events
    component.selectCommand(cmd);

    expect(trackSpy).toHaveBeenCalledWith(cmd.id);
    expect(component.showCommandPalette()).toBe(false);
    sendSpy.mockRestore();
  });

  it('toggleAutoSpeak persists to localStorage', () => {
    component.autoSpeak.set(false);
    component.toggleAutoSpeak();
    expect(component.autoSpeak()).toBe(true);
    expect(localStorage.getItem('chatbot_auto_speak')).toBe('true');
  });

  it('selectVoice updates currentVoiceName', () => {
    component.selectVoice('Google US English');
    expect(component.currentVoiceName()).toBe('Google US English');
  });

  it('copyMessage sets copiedIndex', fakeAsync(() => {
    const msg = { role: 'assistant' as const, message: 'Test message' };
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    component.copyMessage(msg, 2);
    tick(50);
    expect(component.copiedIndex()).toBe(2);
    tick(1500);
    expect(component.copiedIndex()).toBeNull();
  }));

  it('formatTime returns empty string for invalid date', () => {
    expect(component.formatTime(undefined)).toBe('');
    expect(component.formatTime('invalid')).toBe('');
  });

  it('formatTime returns formatted time for valid date', () => {
    const result = component.formatTime('2025-05-26T10:30:00Z');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('isTTSSupported reflects ttsService', () => {
    expect(component.isTTSSupported()).toBe(component.ttsService.isSupported());
  });

  it('isSTTSupported is false when SpeechRecognition unavailable', () => {
    expect(component.isSTTSupported()).toBe(false);
  });

  it('renders empty state when no messages', () => {
    component.chatbotService.messages.set([]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });

  it('renders messages when present', () => {
    component.chatbotService.messages.set([
      { role: 'user', message: 'Hi', created_at: new Date().toISOString() },
    ]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.message.user')).toBeTruthy();
  });

  it('shows copy button on assistant messages', () => {
    component.chatbotService.messages.set([
      { role: 'assistant', message: 'Hello!', created_at: new Date().toISOString() },
    ]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.copy-btn')).toBeTruthy();
  });
});

// ── Integration: command execution flow ──────────────────────────────────
describe('ChatbotSidebarComponent - command integration', () => {
  let component: ChatbotSidebarComponent;
  let fixture: ComponentFixture<ChatbotSidebarComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    setupSpeechMocks();

    await TestBed.configureTestingModule({
      imports: [ChatbotSidebarComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ChatbotService,
        TTSService,
        VoiceInputService,
        CommandPaletteService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatbotSidebarComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('executing /events command sends message to backend', fakeAsync(() => {
    const eventsCmd = component.commandService.getCommands().find((c) => c.id === 'events')!;
    component.selectCommand(eventsCmd);
    tick();

    const req = httpMock.expectOne((r) => r.url.includes('/chatbot/message'));
    expect(req.request.body.message).toBe('/events');
    req.flush({ success: true, message: 'Here are upcoming events', session_id: 'test' });
    tick();

    expect(component.chatbotService.messages().length).toBeGreaterThan(0);
    httpMock.verify();
  }));

  it('sending a message adds user message immediately', fakeAsync(() => {
    component.userInput.set('What events are available?');
    component.sendMessage();
    tick();

    const msgs = component.chatbotService.messages();
    expect(msgs.some((m) => m.role === 'user' && m.message === 'What events are available?')).toBe(true);

    httpMock.expectOne((r) => r.url.includes('/chatbot/message')).flush({
      success: true, message: 'Here are events', session_id: 'test',
    });
    tick();
    httpMock.verify();
  }));
});
