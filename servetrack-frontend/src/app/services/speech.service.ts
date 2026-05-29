import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { VoiceConfig, VoiceGroup, SpeechResult, SpeechError, VoiceInputError, VOICE_INPUT_ERROR_MESSAGES } from '../models/speech.model';

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

const STORAGE_KEY_VOICE = 'chatbot_voice_name';
const STORAGE_KEY_RATE = 'chatbot_voice_rate';
const STORAGE_KEY_PITCH = 'chatbot_voice_pitch';
const SUPPORTED_LANGS = ['en-US', 'en-GB', 'fil-PH'];

@Injectable({ providedIn: 'root' })
export class SpeechService implements OnDestroy {
  // STT
  private recognition: ISpeechRecognition | null = null;
  private recognitionSubject = new Subject<SpeechResult>();
  private errorSubject = new Subject<SpeechError>();
  private finalTranscript = '';

  // TTS
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voiceCache = new Map<string, SpeechSynthesisVoice>();
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private speechRate = parseFloat(localStorage.getItem(STORAGE_KEY_RATE) ?? '0.95');
  private speechPitch = parseFloat(localStorage.getItem(STORAGE_KEY_PITCH) ?? '1.0');
  private speechVolume = 1.0;

  // State signals
  readonly isListening = signal(false);
  readonly isSpeaking = signal(false);
  readonly error = signal<string | null>(null);
  readonly isSTTSupported = signal(false);
  readonly isTTSSupported = signal(false);
  readonly availableVoices = signal<SpeechSynthesisVoice[]>([]);
  readonly currentVoiceName = signal<string>(localStorage.getItem(STORAGE_KEY_VOICE) ?? '');

  // Observables
  readonly transcript$: Observable<SpeechResult> = this.recognitionSubject.asObservable();
  readonly error$: Observable<SpeechError> = this.errorSubject.asObservable();

  constructor() {
    this.initializeSpeechAPIs();
  }

  ngOnDestroy(): void {
    this.abortListening();
    this.stopSpeaking();
    this.recognitionSubject.complete();
    this.errorSubject.complete();
  }

  // ═══════════════ Initialization ═══════════════

  private initializeSpeechAPIs(): void {
    // STT
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      this.isSTTSupported.set(true);
    } else {
      console.warn('Speech Recognition API not supported in this browser');
    }

    // TTS
    if ('speechSynthesis' in window) {
      this.isTTSSupported.set(true);
      this.synthesis = window.speechSynthesis;
      this.loadVoices();
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = () => this.loadVoices();
      }
    } else {
      console.warn('Speech Synthesis API not supported in this browser');
    }
  }

  private configureRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening.set(true);
      this.error.set(null);
    };

    this.recognition.onresult = (event: ISpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        if (result.isFinal) {
          this.finalTranscript += transcript + ' ';
          this.recognitionSubject.next({ transcript, isFinal: true, confidence });
        } else {
          this.recognitionSubject.next({ transcript, isFinal: false, confidence });
        }
      }
    };

    this.recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      const errorType = this.mapSpeechError(event.error);
      this.emitError(errorType);
    };

    this.recognition.onend = () => {
      this.isListening.set(false);
    };
  }

  // ═══════════════ STT Methods ═══════════════

  startListening(): Observable<SpeechResult> {
    if (!this.isSTTSupported()) {
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
      // Already started guard
    }

    return this.transcript$;
  }

  stopListening(): Promise<string> {
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

  abortListening(): void {
    this.recognition?.abort();
    this.isListening.set(false);
    this.finalTranscript = '';
  }

  setLanguage(lang: string): void {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  // ═══════════════ TTS Methods ═══════════════

  speak(text: string): Promise<void> {
    if (!this.synthesis) {
      this.error.set('Text-to-speech not supported in this browser.');
      return Promise.resolve();
    }

    this.stopSpeaking();
    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText.trim()) return Promise.resolve();

    return new Promise<void>((resolve) => {
      this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
      if (this.selectedVoice) {
        this.currentUtterance.voice = this.selectedVoice;
      }
      this.currentUtterance.rate = this.speechRate;
      this.currentUtterance.pitch = this.speechPitch;
      this.currentUtterance.volume = this.speechVolume;

      this.currentUtterance.onstart = () => {
        this.isSpeaking.set(true);
        this.error.set(null);
      };
      this.currentUtterance.onend = () => {
        this.isSpeaking.set(false);
        this.currentUtterance = null;
        resolve();
      };
      this.currentUtterance.onerror = (e) => {
        this.error.set(`Speech error: ${e.error}`);
        this.isSpeaking.set(false);
        this.currentUtterance = null;
        resolve();
      };

      this.synthesis!.speak(this.currentUtterance);
    });
  }

  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking.set(false);
      this.currentUtterance = null;
    }
  }

  toggleSpeaking(text: string): void {
    if (this.isSpeaking()) {
      this.stopSpeaking();
    } else {
      this.speak(text);
    }
  }

  previewVoice(): Promise<void> {
    return this.speak('Hello! I am your ServeTrack AI assistant.');
  }

  // ═══════════════ Voice Selection ═══════════════

  private loadVoices(): void {
    if (!this.synthesis) return;

    const voices = this.synthesis.getVoices();
    if (voices.length > 0) {
      this.availableVoices.set(voices);
      this.voiceCache.clear();
      for (const v of voices) {
        this.voiceCache.set(v.name, v);
      }

      const savedVoiceName = localStorage.getItem(STORAGE_KEY_VOICE);
      if (savedVoiceName) {
        const savedVoice = voices.find((v) => v.name === savedVoiceName);
        if (savedVoice) {
          this.selectedVoice = savedVoice;
          this.currentVoiceName.set(savedVoice.name);
          return;
        }
      }

      const preferredVoice = voices.find((v) => v.lang === 'en-PH')
        || voices.find((v) => v.lang === 'fil-PH')
        || voices.find((v) => v.lang.startsWith('en') && v.name.includes('Google'))
        || voices.find((v) => v.lang.startsWith('en') && v.localService)
        || voices.find((v) => v.lang.startsWith('en'))
        || voices[0];

      this.selectedVoice = preferredVoice;
      this.currentVoiceName.set(preferredVoice?.name ?? '');
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  getGroupedVoices(): VoiceGroup[] {
    const langNames: Record<string, string> = {
      'en-US': 'English (United States)',
      'en-GB': 'English (United Kingdom)',
      'fil-PH': 'Filipino (Philippines)',
    };

    const groups = new Map<string, SpeechSynthesisVoice[]>();
    for (const lang of SUPPORTED_LANGS) {
      groups.set(lang, []);
    }

    const voices = this.availableVoices();
    for (const voice of voices) {
      const lang = SUPPORTED_LANGS.find((l) => voice.lang === l || voice.lang.startsWith(l))
        || SUPPORTED_LANGS.find((l) => voice.lang.startsWith(l.split('-')[0]));
      if (lang) {
        groups.get(lang)!.push(voice);
      }
    }

    return SUPPORTED_LANGS
      .filter((lang) => groups.get(lang)!.length > 0)
      .map((lang) => ({ lang, langName: langNames[lang] ?? lang, voices: groups.get(lang)! }));
  }

  setVoiceByName(voiceName: string): boolean {
    const voice = this.availableVoices().find((v) => v.name === voiceName)
      || (this.synthesis ? this.synthesis.getVoices().find((v) => v.name === voiceName) : undefined);
    if (voice) {
      this.selectedVoice = voice;
      this.currentVoiceName.set(voice.name);
      localStorage.setItem(STORAGE_KEY_VOICE, voice.name);
      return true;
    }
    return false;
  }

  setRate(rate: number): void {
    this.speechRate = Math.max(0.1, Math.min(10, rate));
    localStorage.setItem(STORAGE_KEY_RATE, String(this.speechRate));
  }

  setPitch(pitch: number): void {
    this.speechPitch = Math.max(0, Math.min(2, pitch));
    localStorage.setItem(STORAGE_KEY_PITCH, String(this.speechPitch));
  }

  setVolume(volume: number): void {
    this.speechVolume = Math.max(0, Math.min(1, volume));
  }

  reloadVoices(): void {
    this.loadVoices();
  }

  // ═══════════════ Speech Text Cleaning ═══════════════

  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/₱(\d+(?:,\d{3})*(?:\.\d{2})?)/g, '$1 Philippine Pesos')
      .replace(/₱/g, 'Philippine Pesos')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^[-*•]\s+/gm, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/gu, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[*#_~`|]/g, '')
      .replace(/\n/g, ', ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }

  // ═══════════════ Utility ═══════════════

  isFullySupported(): boolean {
    return this.isSTTSupported() && this.isTTSSupported();
  }

  getSupportStatus(): string {
    if (this.isFullySupported()) return 'full';
    if (this.isTTSSupported()) return 'tts-only';
    if (this.isSTTSupported()) return 'stt-only';
    return 'none';
  }

  private mapSpeechError(error: string): VoiceInputError {
    switch (error) {
      case 'not-allowed': return 'permission-denied';
      case 'no-speech': return 'no-speech';
      case 'audio-capture': return 'audio-capture';
      case 'network': return 'network';
      case 'aborted': return 'aborted';
      default: return 'unknown';
    }
  }

  private emitError(type: VoiceInputError): void {
    const msg = VOICE_INPUT_ERROR_MESSAGES[type];
    this.error.set(msg);
    this.errorSubject.next({ type, message: msg });
    this.isListening.set(false);
  }
}
