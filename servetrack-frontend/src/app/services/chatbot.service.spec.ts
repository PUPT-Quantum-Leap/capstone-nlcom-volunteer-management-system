import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal, Component, inject } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatbotService, CHATBOT_MAX_MESSAGE_LENGTH } from './chatbot.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Component({
  template: '',
})
class DummyComponent {
  service = inject(ChatbotService);
}

describe('ChatbotService', () => {
  let service: ChatbotService;
  let httpMock: HttpTestingController;
  let currentUserSignal: any;
  let fixture: any;
  const mockUserId = 123;

  beforeEach(() => {
    localStorage.clear();

    currentUserSignal = signal({ id: String(mockUserId) });
    const authServiceMock = {
      currentUser: currentUserSignal,
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, DummyComponent],
      providers: [
        ChatbotService,
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
    service = TestBed.inject(ChatbotService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DummyComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    vi.useRealTimers();
  });

  describe('sanitizeUserInput', () => {
    it('trims surrounding whitespace', () => {
      expect(service.sanitizeUserInput('   hello   ')).toBe('hello');
    });
    it('returns empty string for whitespace-only input', () => {
      expect(service.sanitizeUserInput('   ')).toBe('');
    });
    it('returns empty string for empty input', () => {
      expect(service.sanitizeUserInput('')).toBe('');
    });
    it('strips HTML tags from input', () => {
      expect(service.sanitizeUserInput('Hello <b>world</b>')).toBe('Hello world');
      expect(service.sanitizeUserInput('<script>alert(1)</script>safe')).toBe('safe');
      expect(service.sanitizeUserInput('<iframe src="x"></iframe>text')).toBe('text');
    });
    it('strips javascript: protocol fragments', () => {
      expect(service.sanitizeUserInput('Click javascript:alert(1)')).toBe('Click alert(1)');
    });
    it('rejects messages over the max length', () => {
      expect(service.sanitizeUserInput('a'.repeat(CHATBOT_MAX_MESSAGE_LENGTH + 1))).toBe('');
    });
    it('accepts messages at the max length', () => {
      const atLimit = 'a'.repeat(CHATBOT_MAX_MESSAGE_LENGTH);
      expect(service.sanitizeUserInput(atLimit)).toBe(atLimit);
    });
    it('preserves multi-line markdown content', () => {
      const md = 'Line one\n\n* bullet one\n* bullet two';
      expect(service.sanitizeUserInput(md)).toBe(md);
    });
  });

  describe('containsMaliciousPattern', () => {
    it('flags script tags', () => {
      expect(service.containsMaliciousPattern('<script>alert(1)</script>')).toBe(true);
    });
    it('flags iframe tags', () => {
      expect(service.containsMaliciousPattern('<iframe src=x></iframe>')).toBe(true);
    });
    it('flags javascript: URIs', () => {
      expect(service.containsMaliciousPattern('javascript:alert(1)')).toBe(true);
    });
    it('flags inline event handlers', () => {
      expect(service.containsMaliciousPattern('<img onerror=alert(1)>')).toBe(true);
    });
    it('does not flag safe text', () => {
      expect(service.containsMaliciousPattern('Hello world')).toBe(false);
    });
    it('returns false for empty input', () => {
      expect(service.containsMaliciousPattern('')).toBe(false);
    });
  });

  describe('parseMarkdown', () => {
    const html = (safeHtml: unknown): string =>
      (safeHtml as { changingThisBreaksApplicationSecurity: string })
        .changingThisBreaksApplicationSecurity;

    it('renders bold text', () => {
      expect(html(service.parseMarkdown('**bold**'))).toContain('<strong>bold</strong>');
    });
    it('renders italic text', () => {
      expect(html(service.parseMarkdown('*italic*'))).toContain('<em>italic</em>');
    });
    it('renders inline code', () => {
      expect(html(service.parseMarkdown('`code`'))).toContain('<code>code</code>');
    });
    it('renders a fenced code block', () => {
      const result = html(service.parseMarkdown('```\nconsole.log(1)\n```'));
      expect(result).toContain('<pre>');
      expect(result).toContain('<code>');
    });
    it('renders an unordered list', () => {
      const result = html(service.parseMarkdown('- item one\n- item two'));
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>item one</li>');
    });
    it('renders a blockquote', () => {
      expect(html(service.parseMarkdown('> quoted text'))).toContain('<blockquote>');
    });
    it('renders a GFM table', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = html(service.parseMarkdown(md));
      expect(result).toContain('<table>');
      expect(result).toContain('<th>');
      expect(result).toContain('<td>');
    });
    it('strips script tags (XSS prevention)', () => {
      const result = html(service.parseMarkdown('<script>alert(1)</script>'));
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert(1)');
    });
    it('strips javascript: URIs from links', () => {
      const result = html(service.parseMarkdown('[click](javascript:alert(1))'));
      expect(result).not.toContain('javascript:');
    });
    it('strips onclick handlers', () => {
      const result = html(service.parseMarkdown('<div onclick="alert(1)">x</div>'));
      expect(result).not.toContain('onclick');
    });
    it('forces links to open in a new tab with rel=noopener', () => {
      const result = html(service.parseMarkdown('[link](https://example.com)'));
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
    });
    it('returns empty SafeHtml for empty input', () => {
      expect(html(service.parseMarkdown(''))).toBe('');
    });
    it('caches results (same reference for same input)', () => {
      const first = service.parseMarkdown('**hello**');
      const second = service.parseMarkdown('**hello**');
      expect(first).toBe(second);
    });
  });

  describe('isTransientError', () => {
    const err = (status: number) => ({ status } as any);
    it('returns true for network errors (status 0)', () => {
      expect(service.isTransientError(err(0))).toBe(true);
    });
    it('returns true for 500 errors', () => {
      expect(service.isTransientError(err(500))).toBe(true);
    });
    it('returns true for 503 errors', () => {
      expect(service.isTransientError(err(503))).toBe(true);
    });
    it('returns false for 400 errors', () => {
      expect(service.isTransientError(err(400))).toBe(false);
    });
    it('returns false for 422 errors', () => {
      expect(service.isTransientError(err(422))).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('refuses to send blank messages', () => {
      let errored = false;
      service.sendMessage('   ').subscribe({ error: () => { errored = true; } });
      expect(errored).toBe(true);
      httpMock.expectNone(environment.apiUrl + '/chatbot/message');
    });

    it('strips HTML before sending', () => {
      service.sendMessage('Hello<script>alert(1)</script> there').subscribe();
      const req = httpMock.expectOne(environment.apiUrl + '/chatbot/message');
      expect(req.request.body.message).toBe('Hello there');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ success: true, message: 'reply', session_id: req.request.body.session_id });
    });

    it('persists the user message in the messages signal', () => {
      service.sendMessage('hello').subscribe();
      expect(service.messages()[0].role).toBe('user');
      const req = httpMock.expectOne(environment.apiUrl + '/chatbot/message');
      req.flush({ success: true, message: 'hi back', session_id: req.request.body.session_id });
      expect(service.messages()[1].message).toBe('hi back');
    });

    it('appends an error message on permanent 4xx failure', () => {
      service.sendMessage('hello').subscribe({ error: () => {} });
      httpMock.expectOne(environment.apiUrl + '/chatbot/message')
        .flush({}, { status: 400, statusText: 'Bad Request' });
      expect(service.isLoading()).toBe(false);
      expect(service.messages().some((m) => m.role === 'assistant')).toBe(true);
    });

    it('does NOT retry on 4xx errors', () => {
      vi.useFakeTimers();
      let errorCount = 0;
      service.sendMessage('hello').subscribe({ error: () => { errorCount++; } });
      httpMock.expectOne(environment.apiUrl + '/chatbot/message')
        .flush({}, { status: 422, statusText: 'Unprocessable' });
      vi.advanceTimersByTime(10000);
      httpMock.expectNone(environment.apiUrl + '/chatbot/message');
      expect(errorCount).toBe(1);
    });

    it('retries on 5xx and succeeds on the second attempt', () => {
      vi.useFakeTimers();
      let successCount = 0;
      service.sendMessage('hello').subscribe({ next: () => { successCount++; } });
      httpMock.expectOne(environment.apiUrl + '/chatbot/message')
        .flush({}, { status: 503, statusText: 'Service Unavailable' });
      vi.advanceTimersByTime(1000);
      const req2 = httpMock.expectOne(environment.apiUrl + '/chatbot/message');
      req2.flush({ success: true, message: 'ok', session_id: req2.request.body.session_id });
      expect(successCount).toBe(1);
      expect(service.messages().some((m) => m.role === 'assistant' && m.message === 'ok')).toBe(true);
    });

    it('stops after MAX_RETRY_ATTEMPTS (3 retries = 4 total requests)', () => {
      vi.useFakeTimers();
      let errorCount = 0;
      service.sendMessage('hello').subscribe({ error: () => { errorCount++; } });
      const url = environment.apiUrl + '/chatbot/message';
      httpMock.expectOne(url).flush({}, { status: 500, statusText: 'Server Error' });
      vi.advanceTimersByTime(1000);
      httpMock.expectOne(url).flush({}, { status: 500, statusText: 'Server Error' });
      vi.advanceTimersByTime(2000);
      httpMock.expectOne(url).flush({}, { status: 500, statusText: 'Server Error' });
      vi.advanceTimersByTime(4000);
      httpMock.expectOne(url).flush({}, { status: 500, statusText: 'Server Error' });
      httpMock.expectNone(url);
      expect(errorCount).toBe(1);
      expect(service.isLoading()).toBe(false);
      expect(service.messages().some((m) => m.role === 'assistant')).toBe(true);
    });
  });

  describe('session persistence', () => {
    it('reuses session id from localStorage on init', () => {
      const stored = localStorage.getItem(`user_${mockUserId}_chatbot_session_id`);
      expect(stored).toBeTruthy();
      expect(service.sessionId()).toBe(stored);
    });
  });

  describe('showChatbot and messages state persistence and user reactivity', () => {
    it('persists showChatbot state to localStorage when it changes', () => {
      service.showChatbot.set(true);
      fixture.detectChanges();
      expect(localStorage.getItem(`user_${mockUserId}_chatbot_show`)).toBe('true');

      service.showChatbot.set(false);
      fixture.detectChanges();
      expect(localStorage.getItem(`user_${mockUserId}_chatbot_show`)).toBe('false');
    });

    it('syncs state when the currentUser changes', () => {
      // Setup state for another user in localStorage
      const otherUserId = '456';
      localStorage.setItem(`user_${otherUserId}_chatbot_show`, 'true');
      localStorage.setItem(`user_${otherUserId}_chatbot_session_id`, 'session-xyz');
      localStorage.setItem(
        `user_${otherUserId}_chatbot_messages`,
        JSON.stringify([{ role: 'user', message: 'Hello other user' }])
      );

      // Change currentUser to 456
      currentUserSignal.set({ id: otherUserId });
      fixture.detectChanges();

      // Check that the service has updated its states automatically
      expect(service.showChatbot()).toBe(true);
      expect(service.sessionId()).toBe('session-xyz');
      expect(service.messages().length).toBe(1);
      expect(service.messages()[0].message).toBe('Hello other user');
    });

    it('saves messages automatically when messages change', () => {
      const mockMsg = { role: 'user' as const, message: 'Auto-save test' };
      service.messages.set([mockMsg]);
      fixture.detectChanges();

      const stored = localStorage.getItem(`user_${mockUserId}_chatbot_messages`);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)[0].message).toBe('Auto-save test');
    });

    it('removes messages from localStorage when messages is empty', () => {
      localStorage.setItem(
        `user_${mockUserId}_chatbot_messages`,
        JSON.stringify([{ role: 'user', message: 'test' }])
      );
      service.messages.set([]);
      fixture.detectChanges();

      expect(localStorage.getItem(`user_${mockUserId}_chatbot_messages`)).toBeNull();
    });
  });
});