import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceInputService } from './voice-input.service';

function makeMockRecognition() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    continuous: false,
    interimResults: false,
    lang: '',
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

  it('start sets isListening to true via onstart', async () => {
    mockRecognition.start.mockImplementation(() => {
      mockRecognition.onstart?.(new Event('start'));
    });
    await service.start();
    expect(service.isListening()).toBe(true);
  });

  it('stop resolves with final transcript', async () => {
    mockRecognition.start.mockImplementation(() => {
      mockRecognition.onstart?.(new Event('start'));
    });
    await service.start();

    // Simulate final result
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

  it('emits interim transcript via transcript$', async () => {
    mockRecognition.start.mockImplementation(() => {
      mockRecognition.onstart?.(new Event('start'));
    });
    await service.start();

    const emitted: string[] = [];
    service.transcript$.subscribe((t) => emitted.push(t));

    mockRecognition.onresult?.({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Hel', confidence: 0.5 }], { isFinal: false }),
      ],
    } as any);

    expect(emitted).toContain('Hel');
  });

  it('sets error on permission denied', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error(), { name: 'NotAllowedError' }),
    );
    await service.start();
    expect(service.error()).toContain('denied');
  });

  it('abort resets state', async () => {
    mockRecognition.start.mockImplementation(() => {
      mockRecognition.onstart?.(new Event('start'));
    });
    await service.start();
    service.abort();
    expect(service.isListening()).toBe(false);
    expect(service.transcript()).toBe('');
  });
});
