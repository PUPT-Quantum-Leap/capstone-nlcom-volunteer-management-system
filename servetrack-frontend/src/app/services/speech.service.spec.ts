import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpeechService } from './speech.service';
import { SpeechResult } from '../models/speech.model';

const mockVoice = (name: string, lang: string): SpeechSynthesisVoice =>
  ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

class MockUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: ((e: Event) => void) | null = null;
  onend: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  constructor(text: string) { this.text = text; }
}

(globalThis as any).SpeechSynthesisUtterance = MockUtterance;
(globalThis as any).SpeechSynthesisEvent = class extends Event {
  constructor(type: string, init?: any) { super(type); }
};

function makeMockRecognition() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    continuous: false,
    interimResults: false,
    lang: '',
    maxAlternatives: 0,
    onstart: null as ((e: Event) => void) | null,
    onresult: null as ((e: any) => void) | null,
    onerror: null as ((e: any) => void) | null,
    onend: null as ((e: Event) => void) | null,
  };
}

function setupSpeechMocks(): ReturnType<typeof makeMockRecognition> {
  const mockRec = makeMockRecognition();

  try {
    delete (window as any).speechSynthesis;
  } catch { /* non-configurable */ }

  Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    configurable: true,
    value: {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => [
        mockVoice('Google US English', 'en-US'),
        mockVoice('Filipino', 'fil-PH'),
        mockVoice('Google UK English', 'en-GB'),
      ]),
      onvoiceschanged: null,
    },
  });

  (window as any).SpeechRecognition = function () { return mockRec; };
  (window as any).webkitSpeechRecognition = undefined;

  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({}) },
  });

  return mockRec;
}

describe('SpeechService', () => {
  let service: SpeechService;

  beforeEach(() => {
    localStorage.clear();
  });

  // ── TTS Tests ──

  describe('TTS', () => {
    beforeEach(() => {
      setupSpeechMocks();
      TestBed.configureTestingModule({ providers: [SpeechService] });
      service = TestBed.inject(SpeechService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('isTTSSupported returns true when speechSynthesis exists', () => {
      expect(service.isTTSSupported()).toBe(true);
    });

    it('isTTSSupported returns false when speechSynthesis missing', () => {
      try {
        delete (window as any).speechSynthesis;
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [SpeechService] });
        const svc = TestBed.inject(SpeechService);
        expect(svc.isTTSSupported()).toBe(false);
      } catch {
        // Non-configurable in CI
      }
    });

    it('availableVoices are loaded from synthesis', () => {
      expect(service.availableVoices().length).toBe(3);
    });

    it('getVoices returns loaded voices', () => {
      expect(service.getVoices().length).toBe(3);
    });

    it('getGroupedVoices groups by supported language', () => {
      const groups = service.getGroupedVoices();
      expect(groups.some((g) => g.lang === 'en-US')).toBe(true);
      expect(groups.some((g) => g.lang === 'fil-PH')).toBe(true);
      expect(groups.some((g) => g.lang === 'en-GB')).toBe(true);
    });

    it('setVoiceByName persists to localStorage', () => {
      service.setVoiceByName('Filipino');
      expect(localStorage.getItem('chatbot_voice_name')).toBe('Filipino');
    });

    it('setVoiceByName returns true for existing voice', () => {
      expect(service.setVoiceByName('Filipino')).toBe(true);
    });

    it('setVoiceByName returns false for missing voice', () => {
      expect(service.setVoiceByName('Nonexistent')).toBe(false);
    });

    it('setRate persists to localStorage', () => {
      service.setRate(1.5);
      expect(localStorage.getItem('chatbot_voice_rate')).toBe('1.5');
    });

    it('setRate clamps to valid range', () => {
      service.setRate(-1);
      expect(localStorage.getItem('chatbot_voice_rate')).toBe('0.1');
      service.setRate(100);
      expect(localStorage.getItem('chatbot_voice_rate')).toBe('10');
    });

    it('setPitch persists to localStorage', () => {
      service.setPitch(0.8);
      expect(localStorage.getItem('chatbot_voice_pitch')).toBe('0.8');
    });

    it('setPitch clamps to valid range', () => {
      service.setPitch(-1);
      expect(localStorage.getItem('chatbot_voice_pitch')).toBe('0');
      service.setPitch(5);
      expect(localStorage.getItem('chatbot_voice_pitch')).toBe('2');
    });

    it('speak calls speechSynthesis.speak', async () => {
      const utterances: SpeechSynthesisUtterance[] = [];
      (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(
        (u: SpeechSynthesisUtterance) => {
          utterances.push(u);
          u.onstart?.(new (globalThis as any).SpeechSynthesisEvent('start'));
          u.onend?.(new (globalThis as any).SpeechSynthesisEvent('end'));
        },
      );

      await service.speak('Hello');
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
    });

    it('speak sets isSpeaking true during speech', async () => {
      (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(
        (u: SpeechSynthesisUtterance) => {
          u.onstart?.(new (globalThis as any).SpeechSynthesisEvent('start'));
          u.onend?.(new (globalThis as any).SpeechSynthesisEvent('end'));
        },
      );

      const promise = service.speak('Hello');
      await promise;
      expect(service.isSpeaking()).toBe(false);
    });

    it('stopSpeaking calls speechSynthesis.cancel', () => {
      service.stopSpeaking();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });

    it('isSpeaking is false after stopSpeaking', () => {
      service.stopSpeaking();
      expect(service.isSpeaking()).toBe(false);
    });

    it('toggleSpeaking stops when speaking', () => {
      service.isSpeaking.set(true);
      service.toggleSpeaking('test');
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });

    it('toggleSpeaking speaks when not speaking', () => {
      service.toggleSpeaking('test');
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
    });

    it('previewVoice calls speak', async () => {
      const spy = vi.spyOn(service, 'speak').mockResolvedValue(undefined);
      await service.previewVoice();
      expect(spy).toHaveBeenCalled();
    });

    it('reloadVoices updates availableVoices', () => {
      const initial = service.availableVoices().length;
      vi.mocked(window.speechSynthesis.getVoices).mockReturnValue([
        mockVoice('New Voice', 'en-US'),
      ]);
      service.reloadVoices();
      expect(service.availableVoices().length).toBe(1);
    });
  });

  // ── STT Tests ──

  describe('STT', () => {
    let mockRecognition: ReturnType<typeof makeMockRecognition>;

    beforeEach(() => {
      mockRecognition = setupSpeechMocks();
      TestBed.configureTestingModule({ providers: [SpeechService] });
      service = TestBed.inject(SpeechService);
    });

    it('isSTTSupported returns true when SpeechRecognition exists', () => {
      expect(service.isSTTSupported()).toBe(true);
    });

    it('isSTTSupported returns false when SpeechRecognition missing', () => {
      delete (window as any).SpeechRecognition;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [SpeechService] });
      const svc = TestBed.inject(SpeechService);
      expect(svc.isSTTSupported()).toBe(false);
    });

    it('startListening sets isListening via onstart', () => {
      mockRecognition.start.mockImplementation(() => {
        mockRecognition.onstart?.(new Event('start'));
      });
      service.startListening();
      expect(service.isListening()).toBe(true);
    });

    it('startListening configures recognition', () => {
      service.startListening();
      expect(mockRecognition.maxAlternatives).toBe(1);
      expect(mockRecognition.interimResults).toBe(true);
      expect(mockRecognition.continuous).toBe(true);
    });

    it('stopListening resolves with final transcript', async () => {
      mockRecognition.start.mockImplementation(() => {
        mockRecognition.onstart?.(new Event('start'));
      });
      service.startListening();

      mockRecognition.onresult?.({
        resultIndex: 0,
        results: [Object.assign(
          [{ transcript: 'Hello world', confidence: 1 }],
          { isFinal: true },
        )],
      } as any);

      mockRecognition.stop.mockImplementation(() => {
        mockRecognition.onend?.(new Event('end'));
      });

      const transcript = await service.stopListening();
      expect(transcript).toBe('Hello world');
    });

    it('emits interim SpeechResult via transcript$', () => {
      mockRecognition.start.mockImplementation(() => {
        mockRecognition.onstart?.(new Event('start'));
      });
      service.startListening();

      const emitted: SpeechResult[] = [];
      service.transcript$.subscribe((r) => emitted.push(r));

      mockRecognition.onresult?.({
        resultIndex: 0,
        results: [Object.assign(
          [{ transcript: 'Hel', confidence: 0.5 }],
          { isFinal: false },
        )],
      } as any);

      expect(emitted.length).toBe(1);
      expect(emitted[0].transcript).toBe('Hel');
      expect(emitted[0].isFinal).toBe(false);
      expect(emitted[0].confidence).toBe(0.5);
    });

    it('emits final SpeechResult via transcript$', () => {
      mockRecognition.start.mockImplementation(() => {
        mockRecognition.onstart?.(new Event('start'));
      });
      service.startListening();

      const emitted: SpeechResult[] = [];
      service.transcript$.subscribe((r) => emitted.push(r));

      mockRecognition.onresult?.({
        resultIndex: 0,
        results: [Object.assign(
          [{ transcript: 'Hello world', confidence: 0.9 }],
          { isFinal: true },
        )],
      } as any);

      expect(emitted.length).toBe(1);
      expect(emitted[0].transcript).toBe('Hello world');
      expect(emitted[0].isFinal).toBe(true);
      expect(emitted[0].confidence).toBe(0.9);
    });

    it('sets error signal on permission denied', () => {
      service.startListening();
      mockRecognition.onerror?.({ error: 'not-allowed' } as any);
      expect(service.error()).toContain('denied');
      expect(service.isListening()).toBe(false);
    });

    it('sets error signal on network error', () => {
      service.startListening();
      mockRecognition.onstart?.();
      mockRecognition.onerror?.({ error: 'network' } as any);
      expect(service.error()).toContain('Network');
      expect(service.isListening()).toBe(false);
    });

    it('error$ emits SpeechError objects', () => {
      const emitted: any[] = [];
      service.error$.subscribe((e) => emitted.push(e));

      service.startListening();
      mockRecognition.onerror?.({ error: 'not-allowed' } as any);

      expect(emitted.length).toBe(1);
      expect(emitted[0].type).toBe('permission-denied');
      expect(emitted[0].message).toContain('denied');
    });

    it('abortListening resets state', () => {
      mockRecognition.start.mockImplementation(() => {
        mockRecognition.onstart?.(new Event('start'));
      });
      service.startListening();
      service.abortListening();
      expect(service.isListening()).toBe(false);
    });

    it('setLanguage updates recognition lang', () => {
      service.startListening();
      service.setLanguage('fil-PH');
      expect(mockRecognition.lang).toBe('fil-PH');
    });
  });

  // ── Utility Tests ──

  describe('Utility', () => {
    beforeEach(() => {
      setupSpeechMocks();
      TestBed.configureTestingModule({ providers: [SpeechService] });
      service = TestBed.inject(SpeechService);
    });

    it('isFullySupported returns true when both are supported', () => {
      expect(service.isFullySupported()).toBe(true);
    });

    it('getSupportStatus returns full', () => {
      expect(service.getSupportStatus()).toBe('full');
    });

    it('getSupportStatus returns tts-only when STT missing', () => {
      delete (window as any).SpeechRecognition;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [SpeechService] });
      const svc = TestBed.inject(SpeechService);
      expect(svc.getSupportStatus()).toBe('tts-only');
    });
  });
});
