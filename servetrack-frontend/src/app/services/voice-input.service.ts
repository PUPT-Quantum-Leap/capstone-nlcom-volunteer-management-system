import { Injectable, signal, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import {
  SpeechResult,
  VoiceInputError,
  SpeechError,
  VOICE_INPUT_ERROR_MESSAGES,
} from '../models/voice-input.model';

interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}

interface ISpeechRecognitionResultList {
  readonly length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: ISpeechRecognitionConstructor;
    webkitSpeechRecognition: ISpeechRecognitionConstructor;
  }
}

@Injectable({ providedIn: 'root' })
export class VoiceInputService implements OnDestroy {
  private recognition: ISpeechRecognition | null = null;
  private recognitionSubject = new Subject<SpeechResult>();
  private errorSubject = new Subject<SpeechError>();
  private finalTranscript = '';

  readonly isListening = signal(false);
  readonly transcript = signal('');
  readonly error = signal<string | null>(null);

  readonly transcript$: Observable<SpeechResult> = this.recognitionSubject.asObservable();
  readonly error$: Observable<SpeechError> = this.errorSubject.asObservable();

  isSupported(): boolean {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    return SpeechRecognitionAPI !== undefined;
  }

  start(): Observable<SpeechResult> {
    if (!this.isSupported()) {
      this.emitError('not-supported');
      return this.transcript$;
    }

    if (this.isListening()) {
      return this.transcript$;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionAPI();
    this.finalTranscript = '';
    this.configureRecognition();

    try {
      this.recognition.start();
    } catch {
      // Already started — ignore
    }

    return this.transcript$;
  }

  stop(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.recognition) {
        resolve(this.finalTranscript.trim());
        return;
      }
      const prev = this.recognition.onend;
      this.recognition.onend = () => {
        this.isListening.set(false);
        resolve(this.finalTranscript.trim());
        this.recognition!.onend = prev;
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

  ngOnDestroy(): void {
    this.abort();
    this.recognitionSubject.complete();
    this.errorSubject.complete();
  }

  private configureRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening.set(true);
      this.transcript.set('');
      this.error.set(null);
    };

    this.recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const t = result[0].transcript;
        const confidence = result[0].confidence;
        if (result.isFinal) {
          this.finalTranscript += t + ' ';
          this.recognitionSubject.next({ transcript: t, isFinal: true, confidence });
        } else {
          interim += t;
          this.recognitionSubject.next({ transcript: t, isFinal: false, confidence });
        }
      }
      this.transcript.set(interim);
    };

    this.recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      const errorType = this.mapSpeechError(event.error);
      this.emitError(errorType);
    };

    this.recognition.onend = () => {
      this.isListening.set(false);
    };
  }

  private mapSpeechError(error: string): VoiceInputError {
    switch (error) {
      case 'not-allowed':
        return 'permission-denied';
      case 'no-speech':
        return 'no-speech';
      case 'audio-capture':
        return 'audio-capture';
      case 'network':
        return 'network';
      case 'aborted':
        return 'aborted';
      default:
        return 'unknown';
    }
  }

  private emitError(type: VoiceInputError): void {
    const msg = VOICE_INPUT_ERROR_MESSAGES[type];
    this.error.set(msg);
    this.errorSubject.next({ type, message: msg });
    this.isListening.set(false);
  }
}
