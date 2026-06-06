/**
 * Detect if running on a Vercel preview deployment.
 * If so, use relative API paths (proxied via vercel.json rewrites).
 * Otherwise, use the absolute production API URL.
 */
const isVercelPreview =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

export const environment = {
  production: true,
  apiUrl: isVercelPreview ? '/api' : 'https://api.servetrack.quantumapp.tech/api',
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
