import { Injectable, signal } from '@angular/core';
import { VoiceConfig, VoiceGroup } from '../models/tts.model';

const STORAGE_KEY_VOICE = 'chatbot_voice_name';
const STORAGE_KEY_RATE = 'chatbot_voice_rate';
const STORAGE_KEY_PITCH = 'chatbot_voice_pitch';
const SUPPORTED_LANGS = ['en-US', 'en-GB', 'fil-PH'];

@Injectable({ providedIn: 'root' })
export class TTSService {
  private voices: SpeechSynthesisVoice[] = [];
  private voiceCache = new Map<string, SpeechSynthesisVoice>();

  readonly isSpeaking = signal(false);
  readonly error = signal<string | null>(null);
  readonly voicesReady = signal(false);

  private config: VoiceConfig = {
    rate: parseFloat(localStorage.getItem(STORAGE_KEY_RATE) ?? '1.0'),
    pitch: parseFloat(localStorage.getItem(STORAGE_KEY_PITCH) ?? '1.0'),
    volume: 1.0,
    language: 'en-US',
    voiceName: localStorage.getItem(STORAGE_KEY_VOICE) ?? '',
  };

  constructor() {
    if (this.isSupported()) {
      this.loadVoices();
      // Chrome fires voiceschanged asynchronously
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  loadVoices(): void {
    this.voices = window.speechSynthesis.getVoices();
    this.voiceCache.clear();
    for (const v of this.voices) {
      this.voiceCache.set(v.name, v);
    }
    this.voicesReady.set(this.voices.length > 0);
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
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

    for (const voice of this.voices) {
      const lang = SUPPORTED_LANGS.find((l) => voice.lang.startsWith(l.split('-')[0]));
      if (lang) {
        groups.get(lang)!.push(voice);
      }
    }

    return SUPPORTED_LANGS
      .filter((lang) => groups.get(lang)!.length > 0)
      .map((lang) => ({ lang, langName: langNames[lang] ?? lang, voices: groups.get(lang)! }));
  }

  setVoice(voiceName: string): void {
    this.config.voiceName = voiceName;
    localStorage.setItem(STORAGE_KEY_VOICE, voiceName);
  }

  setRate(rate: number): void {
    this.config.rate = rate;
    localStorage.setItem(STORAGE_KEY_RATE, String(rate));
  }

  setPitch(pitch: number): void {
    this.config.pitch = pitch;
    localStorage.setItem(STORAGE_KEY_PITCH, String(pitch));
  }

  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  speak(text: string): Promise<void> {
    if (!this.isSupported()) {
      this.error.set('Text-to-speech not supported in this browser.');
      return Promise.resolve();
    }

    window.speechSynthesis.cancel();
    const cleaned = this.optimizeText(text);
    if (!cleaned) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(cleaned);
      const voice = this.voiceCache.get(this.config.voiceName);
      if (voice) utterance.voice = voice;
      utterance.rate = this.config.rate;
      utterance.pitch = this.config.pitch;
      utterance.volume = this.config.volume;

      utterance.onstart = () => {
        this.isSpeaking.set(true);
        this.error.set(null);
      };
      utterance.onend = () => {
        this.isSpeaking.set(false);
        resolve();
      };
      utterance.onerror = (e) => {
        this.error.set(`Speech error: ${e.error}`);
        this.isSpeaking.set(false);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
      this.isSpeaking.set(false);
    }
  }

  previewVoice(): Promise<void> {
    return this.speak('Hello! I am your ServeTrack AI assistant.');
  }

  private optimizeText(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, 'code block omitted')
      .replace(/`[^`]+`/g, '')
      .replace(/[#*_~|]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }
}
