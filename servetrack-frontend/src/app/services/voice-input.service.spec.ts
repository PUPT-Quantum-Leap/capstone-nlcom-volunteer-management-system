import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceInputService } from './voice-input.service';
import { SpeechResult } from '../models/voice-input.model';

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

describe('VoiceInputService', () => {
  let service: VoiceInputService;
  let mockRecognition: ReturnType<typeof makeMockRecognition>;

  beforeEach(() => {
    mockRecognition = makeMockRecognition();
    (window as any).SpeechRecognition = function() { return mockRecognition; };

    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({}) },
    });

    TestBed.configureTestingModule({ providers: [VoiceInputService] });
    service = TestBed.inject(VoiceInputService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('isSupported returns true when SpeechRecognition exists', () => {
    expect(service.isSupported()).toBe(true);
  });

  it('isSupported returns false when SpeechRecognition missing', () => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
    expect(service.isSupported()).toBe(false);
    (window as any).SpeechRecognition = vi.fn(() => mockRecognition);
  });

  it('start sets isListening to true via onstart', () => {
    mockRecognition.start.mockImplementation(() => {
      mockRecognition.onstart?.(new Event('start'));
    });
    service.start();
    expect(service.isListening()).toBe(true);
  });

  it('start configures maxAlternatives and interimResults', () => {
    service.start();
    expect(mockRecognition.maxAlternatives).toBe(1);
    expect(mockRecognition.interimResults).toBe(true);
    expect(mockRecognition.continuous).toBe(true);
  });

  it('stop resolves with final transcript', async () => {
    mockRecognition.start.mockImplementation(() => {
      mockRecognition.onstart?.(new Event('start'));
    });
    service.start();

    mockRecognition.onresult?.({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Hello world', confidence: 1 }], { isFinal: true }),
      ],
    } as any);

    mockRecognition.stop.mockImplementation(() => {
      mockRecognition.onend?.(new Event('end'));
    });

    const transcript = await service.stop();
    expect(transcript).toBe('Hello world');
  });

  it('emits interim SpeechResult via transcript$', () => {
    mockRecognition.start.mockImplementation(() => {
      mockRecognition.onstart?.(new Event('start'));
    });
    service.start();

    const emitted: SpeechResult[] = [];
    service.transcript$.subscribe((r) => emitted.push(r));

    mockRecognition.onresult?.({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Hel', confidence: 0.5 }], { isFinal: false }),
      ],
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
    service.start();

    const emitted: SpeechResult[] = [];
    service.transcript$.subscribe((r) => emitted.push(r));

    mockRecognition.onresult?.({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Hello world', confidence: 0.9 }], { isFinal: true }),
      ],
    } as any);

    expect(emitted.length).toBe(1);
    expect(emitted[0].transcript).toBe('Hello world');
    expect(emitted[0].isFinal).toBe(true);
    expect(emitted[0].confidence).toBe(0.9);
  });

  it('sets error on permission denied and stops listening', () => {
    service.start();
    mockRecognition.onerror?.({ error: 'not-allowed' } as any);
    expect(service.error()).toContain('denied');
    expect(service.isListening()).toBe(false);
  });

  it('sets error on network error and stops listening', () => {
    service.start();
    mockRecognition.onerror?.({ error: 'network' } as any);
    expect(service.error()).toContain('Network');
    expect(service.isListening()).toBe(false);
  });

  it('abort resets state', () => {
    mockRecognition.start.mockImplementation(() => {
      mockRecognition.onstart?.(new Event('start'));
    });
    service.start();
    service.abort();
    expect(service.isListening()).toBe(false);
    expect(service.transcript()).toBe('');
  });

  it('error$ emits SpeechError objects', () => {
    const emitted: any[] = [];
    service.error$.subscribe((e) => emitted.push(e));

    service.start();
    mockRecognition.onerror?.({ error: 'not-allowed' } as any);

    expect(emitted.length).toBe(1);
    expect(emitted[0].type).toBe('permission-denied');
    expect(emitted[0].message).toContain('denied');
  });
});
