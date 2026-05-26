import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { VoiceInputError, VOICE_INPUT_ERROR_MESSAGES } from '../models/voice-input.model';

function getSpeechRecognition(): (new () => any) | null {
  return (
    (window as any).SpeechRecognition ??
    (window as any).webkitSpeechRecognition ??
    null
  );
}

@Injectable({ providedIn: 'root' })
export class VoiceInputService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private finalTranscript = '';

  readonly isListening = signal(false);
  readonly transcript = signal('');
  readonly error = signal<string | null>(null);

  readonly transcript$ = new Subject<string>();
  readonly error$ = new Subject<string>();

  isSupported(): boolean {
    return getSpeechRecognition() !== null;
  }

  async start(): Promise<void> {
    if (!this.isSupported()) {
      this.setError('not-supported');
      return;
    }

    const hasAccess = await this.requestMicAccess();
    if (!hasAccess) return;

    const Ctor = getSpeechRecognition()!;
    this.recognition = new Ctor();
    this.finalTranscript = '';

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening.set(true);
      this.transcript.set('');
      this.error.set(null);
    };

    this.recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.finalTranscript += t + ' ';
        } else {
          interim += t;
        }
      }
      this.transcript.set(interim);
      this.transcript$.next(interim);
    };

    this.recognition.onerror = (event: any) => {
      const map: Record<string, VoiceInputError> = {
        'not-allowed': 'permission-denied',
        'audio-capture': 'audio-capture',
        'no-speech': 'no-speech',
        'network': 'network',
        'service-not-allowed': 'service-not-allowed',
      };
      const key: VoiceInputError = map[event.error] ?? 'unknown';
      this.setError(key);
      this.error$.next(VOICE_INPUT_ERROR_MESSAGES[key]);
    };

    this.recognition.onend = () => {
      this.isListening.set(false);
    };

    this.recognition.start();
  }

  stop(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.recognition) {
        resolve('');
        return;
      }
      const prev = this.recognition.onend;
      this.recognition.onend = () => {
        this.isListening.set(false);
        resolve(this.finalTranscript.trim());
        this.recognition.onend = prev;
      };
      this.recognition.stop();
    });
  }

  abort(): void {
    this.recognition?.abort();
    this.isListening.set(false);
    this.transcript.set('');
    this.finalTranscript = '';
  }

  private async requestMicAccess(): Promise<boolean> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (err: unknown) {
      const name = (err as DOMException).name;
      if (name === 'NotAllowedError') this.setError('permission-denied');
      else if (name === 'NotFoundError') this.setError('no-microphone');
      else if (name === 'NotReadableError') this.setError('mic-in-use');
      else this.setError('unknown');
      return false;
    }
  }

  private setError(key: VoiceInputError): void {
    const msg = VOICE_INPUT_ERROR_MESSAGES[key];
    this.error.set(msg);
    this.error$.next(msg);
    this.isListening.set(false);
  }
}
