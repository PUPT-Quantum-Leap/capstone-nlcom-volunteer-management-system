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
