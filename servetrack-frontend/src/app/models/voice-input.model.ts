export type VoiceInputError =
  | 'not-supported'
  | 'permission-denied'
  | 'no-microphone'
  | 'mic-in-use'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'service-not-allowed'
  | 'unknown';

export const VOICE_INPUT_ERROR_MESSAGES: Record<VoiceInputError, string> = {
  'not-supported': 'Speech recognition is not supported in this browser.',
  'permission-denied': 'Microphone access denied. Please enable it in browser settings.',
  'no-microphone': 'No microphone detected. Please connect a microphone.',
  'mic-in-use': 'Microphone is being used by another application.',
  'no-speech': 'No speech detected. Please try again.',
  'audio-capture': 'No audio detected. Check your microphone.',
  'network': 'Network error. Check your internet connection.',
  'service-not-allowed': 'Speech recognition service not available.',
  'unknown': 'An unknown error occurred.',
};
