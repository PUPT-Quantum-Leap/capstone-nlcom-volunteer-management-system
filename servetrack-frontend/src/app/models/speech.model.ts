export interface VoiceConfig {
  rate: number;
  pitch: number;
  volume: number;
  language: string;
  voiceName: string;
}

export interface VoiceGroup {
  lang: string;
  langName: string;
  voices: SpeechSynthesisVoice[];
}

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export type VoiceInputError =
  | 'not-supported'
  | 'permission-denied'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'unknown';

export interface SpeechError {
  type: VoiceInputError;
  message: string;
}

export const VOICE_INPUT_ERROR_MESSAGES: Record<VoiceInputError, string> = {
  'not-supported': 'Speech recognition is not supported in your browser. Try Chrome or Edge.',
  'permission-denied': 'Microphone access was denied. Please allow microphone access to use voice input.',
  'no-speech': 'No speech was detected. Please try again.',
  'audio-capture': 'No microphone was found. Please check your audio settings.',
  'network': 'Network error occurred. Please check your connection.',
  'aborted': 'Speech recognition was aborted.',
  'unknown': 'An error occurred with speech recognition.',
};
