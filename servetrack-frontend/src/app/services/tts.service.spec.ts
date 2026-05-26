import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TTSService } from './tts.service';

const mockVoice = (name: string, lang: string): SpeechSynthesisVoice =>
  ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

// jsdom doesn't implement SpeechSynthesisUtterance/SpeechSynthesisEvent
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

describe('TTSService', () => {
  let service: TTSService;

  beforeEach(() => {
    localStorage.clear();

    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      configurable: true,
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn(() => [
          mockVoice('Google US English', 'en-US'),
          mockVoice('Filipino', 'fil-PH'),
        ]),
        onvoiceschanged: null,
      },
    });

    TestBed.configureTestingModule({ providers: [TTSService] });
    service = TestBed.inject(TTSService);
    service.loadVoices();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('isSupported returns true when speechSynthesis exists', () => {
    expect(service.isSupported()).toBe(true);
  });

  it('isSupported returns false when speechSynthesis missing', () => {
    const orig = (window as any).speechSynthesis;
    delete (window as any).speechSynthesis;
    expect(service.isSupported()).toBe(false);
    (window as any).speechSynthesis = orig;
  });

  it('getVoices returns loaded voices', () => {
    expect(service.getVoices().length).toBe(2);
  });

  it('getGroupedVoices groups by supported language', () => {
    const groups = service.getGroupedVoices();
    expect(groups.some((g) => g.lang === 'en-US')).toBe(true);
    expect(groups.some((g) => g.lang === 'fil-PH')).toBe(true);
  });

  it('setVoice persists to localStorage', () => {
    service.setVoice('Google US English');
    expect(localStorage.getItem('chatbot_voice_name')).toBe('Google US English');
  });

  it('setRate persists to localStorage', () => {
    service.setRate(1.5);
    expect(localStorage.getItem('chatbot_voice_rate')).toBe('1.5');
  });

  it('setPitch persists to localStorage', () => {
    service.setPitch(0.8);
    expect(localStorage.getItem('chatbot_voice_pitch')).toBe('0.8');
  });

  it('speak calls speechSynthesis.speak', async () => {
    const utterances: SpeechSynthesisUtterance[] = [];
    (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(
      (u: SpeechSynthesisUtterance) => {
        utterances.push(u);
        u.onstart?.(new SpeechSynthesisEvent('start', { utterance: u }));
        u.onend?.(new SpeechSynthesisEvent('end', { utterance: u }));
      },
    );

    await service.speak('Hello');
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });

  it('stop calls speechSynthesis.cancel', () => {
    service.stop();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('isSpeaking is false after stop', () => {
    service.stop();
    expect(service.isSpeaking()).toBe(false);
  });
});
