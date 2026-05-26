export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  chatbot: {
    ttsEnabled: true,
    voiceInputEnabled: true,
    commandPaletteEnabled: true,
    ttsLanguage: 'en-US',
    supportedVoices: 'en-US,en-GB,fil-PH',
    voiceRate: 1.0,
    voicePitch: 1.0,
    commandDebounceMs: 300,
  },
};
