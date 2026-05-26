# 🚀 Comprehensive ChatBot Implementation Plan: AppVengers-Style Sidebar with Full Parity

## Executive Summary

This document outlines the complete implementation strategy for transforming the ServeTrack chatbot from a simple embedded container into a **production-grade AppVengers-style sidebar** with:

- Fixed right-side animated sidebar layout
- Text-to-Speech (TTS) with multi-language support
- Voice input (speech-to-text)
- Command palette with volunteer-specific slash commands
- Settings panel for voice configuration
- Advanced animations and polished UX
- Comprehensive test coverage

**Timeline:** 4-5 development sprints (implementation-ready, not including deployment)
**Risk Level:** Medium (requires new dependencies, browser API integration)
**Rollback:** Easy (feature-flagged, old component still available)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Dependencies & Setup](#2-dependencies--setup)
3. [File Structure](#3-file-structure)
4. [Component Design](#4-component-design)
5. [Service Architecture](#5-service-architecture)
6. [Implementation Phases](#6-implementation-phases)
7. [Volunteer-Specific Commands](#7-volunteer-specific-commands)
8. [TTS Implementation Strategy](#8-tts-implementation-strategy)
9. [Voice Input Implementation Strategy](#9-voice-input-implementation-strategy)
10. [State Management & Persistence](#10-state-management--persistence)
11. [Testing Strategy](#11-testing-strategy)
12. [Git Commit Strategy](#12-git-commit-strategy)
13. [Migration Path](#13-migration-path)
14. [Deployment & Rollback](#14-deployment--rollback)

---

## 1. Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────┐
│           ServeTrack Dashboard                   │
│  (Admin Layout / Volunteer Dashboard Shell)     │
│                                                  │
│  [Toggle Button] ──────────────┐                │
│                                 │                │
│                                 ↓                │
│                    ┌────────────────────────┐   │
│                    │ Chatbot Sidebar        │   │
│                    │ (Fixed, Right: -400px) │   │
│                    │                        │   │
│                    │ Header                 │   │
│                    │ ├─ Avatar + Title      │   │
│                    │ ├─ TTS Toggle          │   │
│                    │ ├─ Settings            │   │
│                    │ └─ Close               │   │
│                    │                        │   │
│                    │ Messages Container     │   │
│                    │ ├─ Typewriter Greeting │   │
│                    │ ├─ User Messages       │   │
│                    │ ├─ Bot Messages        │   │
│                    │ │  ├─ Markdown Render  │   │
│                    │ │  ├─ Copy Button      │   │
│                    │ │  └─ Speak Button     │   │
│                    │ └─ Typing Indicator    │   │
│                    │                        │   │
│                    │ Settings Panel         │   │
│                    │ ├─ Voice Selection     │   │
│                    │ ├─ Voice Preview       │   │
│                    │ └─ Auto-Speak Toggle   │   │
│                    │                        │   │
│                    │ Command Palette        │   │
│                    │ ├─ Quick Commands      │   │
│                    │ └─ Command Pills       │   │
│                    │                        │   │
│                    │ Input Area             │   │
│                    │ ├─ Textarea            │   │
│                    │ ├─ Slash Commands Btn  │   │
│                    │ ├─ Microphone Btn      │   │
│                    │ └─ Send Button         │   │
│                    └────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Key Principles

1. **Encapsulation**: All chatbot logic in a single, replaceable component
2. **Reusability**: Shared ChatbotService across dashboards
3. **Browser-Native**: TTS & voice input use Web Audio API (no server-side processing)
4. **Resilience**: Fallbacks for unsupported browsers
5. **Performance**: Lazy-load TTS library, cache parsed markdown
6. **Accessibility**: ARIA labels, keyboard navigation, screen reader support

---

## 2. Dependencies & Setup

### New NPM Packages

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `web-speech-api` | ^0.0.2 | Polyfill for speech recognition | ~5KB |

### Browser APIs (Built-in, No Installation)

- **Web Speech API**: `SpeechRecognition` / `SpeechSynthesisUtterance` (voice input/TTS)
- **Web Audio API**: For recording audio (microphone input visualization)
- **IndexedDB**: For caching parsed markdown & voice samples

### Environment Variables

```bash
# .env (already exists, add these)
NG_APP_TTS_LANGUAGE=en-US
NG_APP_SUPPORTED_VOICES=en-US,en-GB,fil-PH
NG_APP_VOICE_RATE=1.0
NG_APP_VOICE_PITCH=1.0
NG_APP_COMMAND_DEBOUNCE_MS=300
```

---

## 3. File Structure

### Directory Organization

```
servetrack-frontend/src/app/
├── components/
│   └── chatbot-sidebar/                    (NEW - replaces chatbot-container)
│       ├── chatbot-sidebar.component.ts    (Main component)
│       ├── chatbot-sidebar.component.html  (Template)
│       ├── chatbot-sidebar.component.scss  (Styling)
│       ├── chatbot-sidebar.spec.ts         (Unit tests)
│       ├── sub-components/                 (NEW)
│       │   ├── chatbot-header.component.ts
│       │   ├── chatbot-header.component.html
│       │   ├── chatbot-messages.component.ts
│       │   ├── chatbot-messages.component.html
│       │   ├── chatbot-input.component.ts
│       │   ├── chatbot-input.component.html
│       │   ├── settings-panel.component.ts
│       │   ├── settings-panel.component.html
│       │   └── command-palette.component.ts
│       ├── animations/                     (NEW)
│       │   ├── chatbot.animations.ts       (Reusable animation triggers)
│       │   └── typing-indicator.animations.ts
│       └── __tests__/                      (NEW)
│           ├── chatbot-sidebar.integration.spec.ts
│           ├── tts.spec.ts
│           └── voice-input.spec.ts
│
├── services/
│   ├── chatbot.service.ts                  (ENHANCED - add TTS, voice, commands)
│   ├── chatbot.service.spec.ts             (UPDATED - add new tests)
│   ├── tts.service.ts                      (NEW)
│   ├── tts.service.spec.ts                 (NEW)
│   ├── voice-input.service.ts              (NEW)
│   ├── voice-input.service.spec.ts         (NEW)
│   ├── command-palette.service.ts          (NEW)
│   └── command-palette.service.spec.ts     (NEW)
│
├── models/
│   ├── chatbot.model.ts                    (ENHANCED - add new types)
│   ├── tts.model.ts                        (NEW)
│   ├── voice-input.model.ts                (NEW)
│   └── command.model.ts                    (NEW)
│
├── styles/
│   └── chatbot-sidebar/                    (NEW - organized styling)
│       ├── _chatbot-sidebar.scss           (Main layout)
│       ├── _chatbot-header.scss
│       ├── _chatbot-messages.scss
│       ├── _chatbot-input.scss
│       ├── _settings-panel.scss
│       ├── _command-palette.scss
│       ├── _animations.scss
│       ├── _typing-indicator.scss
│       └── _responsive.scss
│
└── public/
    └── assets/
        └── kamen-rider-gotchard.jpg        (NEW - avatar image from AppVengers)
```

### Files to Delete (Cleanup)

```
servetrack-frontend/src/app/
├── components/chatbot/                     (DEPRECATED - entire folder)
└── src/app/asset/                          (CLEANUP - after moving image)
```

---

## 4. Component Design

### Main Component: ChatbotSidebarComponent

**Purpose:** Root container, orchestrates all sub-components and services

```
chatbot-sidebar.component.ts
├── Inputs/Outputs: (none - managed by service signals)
├── Signals:
│   ├── isOpen: boolean (from service)
│   ├── messages: ChatMessage[] (from service)
│   ├── isLoading: boolean (from service)
│   ├── showSettings: boolean
│   ├── showCommandPalette: boolean
│   ├── isRecording: boolean
│   ├── isSpeaking: boolean
│   ├── liveTranscript: string
│   ├── autoSpeak: boolean
│   ├── currentVoiceName: string
│   └── selectedCommandIndex: number
├── Computed:
│   ├── hasMessages: boolean (messages.length > 0)
│   ├── filteredCommands: Command[]
│   ├── isTTSSupported: boolean
│   ├── isSTTSupported: boolean
│   └── typewriterText: string (animated greeting)
├── Services (injected):
│   ├── ChatbotService
│   ├── TTSService
│   ├── VoiceInputService
│   ├── CommandPaletteService
│   └── DomSanitizer
├── ViewChild:
│   ├── scrollContainer: ElementRef (messages)
│   ├── textareaRef: ElementRef (input)
│   └── commandPaletteRef: ElementRef
├── Listeners:
│   ├── window.keydown (Escape to close, Cmd+K for commands)
│   ├── messages signal changes (scroll to bottom)
│   └── autoSpeak signal changes (trigger TTS)
└── Methods:
    ├── toggleSidebar()
    ├── sendMessage()
    ├── clearChat()
    ├── toggleSettings()
    ├── toggleAutoSpeak()
    ├── selectVoice(name: string)
    ├── previewVoice()
    ├── toggleRecording()
    ├── speakMessage(text: string)
    ├── copyMessage(msg: ChatMessage)
    ├── toggleCommandPalette()
    ├── selectCommand(cmd: Command, index: number)
    ├── executeAction(action: CommandAction)
    ├── autoResize(event: Event)
    ├── handleKeydown(event: KeyboardEvent)
    ├── retryLastMessage()
    ├── parseMarkdown(text: string)
    ├── formatTime(date: Date): string
    ├── onInputChange(text: string)
    ├── getGroupedVoices(): VoiceGroup[]
    └── closeCommandPalette()
```

### Sub-Components (for maintainability)

#### ChatbotHeaderComponent
- Avatar + title + status
- Settings button, voice button, clear button, close button
- Auto-hide/show based on scroll position (optional)

#### ChatbotMessagesComponent
- Message list rendering
- Typing indicator with avatar
- Empty state with typewriter greeting
- Error retry button

#### ChatbotInputComponent
- Auto-resizing textarea
- Action buttons (slash commands, mic, send)
- Live transcript display (during recording)
- Speech error messages

#### SettingsPanelComponent
- Voice selection dropdown
- Voice preview button
- Auto-speak toggle
- Settings hints & info text

#### CommandPaletteComponent
- Quick command search/filter
- Command list with icons & descriptions
- Keyboard navigation (Up/Down arrows)
- Quick action pills

---

## 5. Service Architecture

### ChatbotService (Enhanced)

**Existing Methods** (keep all):
- `sendMessage()`, `loadHistory()`, `clearHistory()`, `parseMarkdown()`, etc.

**New Methods**:

```typescript
// TTS Integration
ttsService = inject(TTSService);
voiceInputService = inject(VoiceInputService);
commandPaletteService = inject(CommandPaletteService);

// Signals for UI state
autoSpeak = signal(false);
currentVoiceIdx = signal(0);
liveTranscript = signal('');
isRecording = signal(false);
isSpeaking = signal(false);
showSettings = signal(false);
showCommandPalette = signal(false);

// Methods
async handleAutoSpeak(message: ChatMessage) {
  if (this.autoSpeak() && message.role === 'assistant') {
    await this.ttsService.speak(message.message);
  }
}

getAvailableVoices(): SpeechSynthesisVoice[] {
  return this.ttsService.getVoices();
}

async selectVoice(voiceName: string) {
  await this.ttsService.setVoice(voiceName);
  this.currentVoiceIdx.update(idx => idx + 1); // Trigger reactivity
}

async toggleRecording() {
  if (this.isRecording()) {
    const transcript = await this.voiceInputService.stop();
    this.liveTranscript.set('');
    if (transcript) this.sendMessage(transcript);
  } else {
    this.voiceInputService.start();
    this.isRecording.set(true);
  }
}

selectCommand(cmd: Command) {
  if (cmd.action) {
    this.executeCommand(cmd);
  } else {
    this.userInput.set(cmd.text);
  }
}

executeCommand(cmd: Command) {
  this.sendMessage(`/${cmd.id}: ${cmd.params || ''}`);
}
```

### New Service: TTSService

**Responsibilities:**
- Browser Web Speech API wrapper (TTS)
- Voice selection & caching
- Playback control (play, pause, stop)
- Rate/pitch configuration
- Language-specific voice selection

**Key Methods:**
```typescript
speak(text: string): Promise<void>
stop(): void
getVoices(): SpeechSynthesisVoice[]
setVoice(voiceName: string): void
setRate(rate: number): void
setPitch(pitch: number): void
isSpeaking(): boolean
getSupportedLanguages(): string[]
previewVoice(previewText?: string): Promise<void>
```

**Configuration:**
```typescript
private readonly voiceConfig = signal({
  rate: 1.0,           // 0.1 - 10
  pitch: 1.0,          // 0 - 2
  volume: 1.0,         // 0 - 1
  language: 'en-US',   // From NG_APP_SUPPORTED_VOICES env
  voiceName: '',       // Selected voice
});
```

### New Service: VoiceInputService

**Responsibilities:**
- Browser Web Speech API wrapper (STT)
- Microphone permission handling
- Live transcript streaming
- Error handling (mic not available, network errors)
- Browser compatibility detection

**Key Methods:**
```typescript
start(): void
stop(): Promise<string>  // Returns transcript
abort(): void
isSupported(): boolean
isMicAvailable(): boolean
getError(): string | null
```

**Event Stream:**
```typescript
transcript$ = new Subject<string>();  // Live transcript updates
error$ = new Subject<string>();       // Errors
isListening$ = new Observable<boolean>();
```

### New Service: CommandPaletteService

**Responsibilities:**
- Command registry (volunteer-specific commands)
- Command search/filtering
- Quick actions management
- Command history (for analytics)

**Key Methods:**
```typescript
getCommands(): Command[]
filterCommands(query: string): Command[]
executeCommand(cmdId: string, params?: Record<string, any>): Promise<void>
getRecentCommands(): Command[]
trackCommandUsage(cmdId: string): void
```

---

## 6. Implementation Phases

### Phase 1: Layout & Basic Structure (Week 1)

**Deliverables:**
- Sidebar layout (fixed right, slide-in animation)
- Header with avatar, title, action buttons
- Messages container with message rendering
- Basic input area
- Responsive design (mobile, tablet, desktop)

**Files to Create:**
- `chatbot-sidebar.component.ts|html|scss`
- `chatbot-sidebar/_*.scss` (style modules)
- Avatar moved to `public/assets/`

**Key Tasks:**
1. Create sidebar wrapper with `right: -400px` → `right: 0` animation
2. Add header with avatar image (from `public/assets/`)
3. Add messages container with scroll behavior
4. Add input area with textarea
5. Integrate existing ChatbotService signals
6. Add responsive breakpoints

**Tests:**
- [ ] Sidebar opens/closes with toggle
- [ ] Messages scroll to bottom on new message
- [ ] Input textarea expands as user types
- [ ] Responsive layout works on mobile/tablet/desktop

**Acceptance Criteria:**
- Sidebar visible only when `showChatbot()` is true
- Smooth slide-in animation (0.3s ease)
- Avatar displays from public/assets
- Messages render with proper styling
- Auto-scroll to latest message
- Mobile: full width, Desktop: 400px width

---

### Phase 2: Advanced Styling & Animations (Week 1-2)

**Deliverables:**
- Polished message styling (user gradient, bot background)
- Copy & speak button per message
- Typing indicator with pulsing avatar
- Empty state with typewriter greeting
- Settings panel UI
- Command palette UI
- Smooth transitions & shadows

**Files to Update:**
- `chatbot-sidebar.component.ts` (add signals for settings/commands)
- `chatbot-sidebar/_animations.scss` (keyframes)
- `chatbot-sidebar/_messages.scss` (styling)
- `chatbot-sidebar/_input.scss` (input styling)

**Key Tasks:**
1. Add message styling (user gradient, bot background)
2. Add copy button logic + toast notification
3. Add typing indicator animation
4. Create empty state with typewriter greeting animation
5. Build settings panel HTML/SCSS structure
6. Build command palette HTML/SCSS structure
7. Add smooth transitions & box shadows

**Tests:**
- [ ] User message shows gradient background
- [ ] Bot message shows light background with border
- [ ] Copy button shows "Copied!" state
- [ ] Typing indicator animates continuously
- [ ] Typewriter greeting animates character by character
- [ ] Settings panel slides down smoothly
- [ ] Command palette filters commands as user types

**Acceptance Criteria:**
- Messages have professional styling (shadows, colors, spacing)
- Typing indicator shows pulsing avatar animation
- Typewriter greeting completes in ~2 seconds
- Copy button feedback is clear (visual + toast)
- All animations use prefers-reduced-motion media query

---

### Phase 3: Text-to-Speech (TTS) (Week 2-3)

**Deliverables:**
- TTSService implementation
- Voice selection dropdown
- Voice preview button
- Auto-speak toggle
- Settings panel fully functional
- Multi-language support (en-US, en-GB, fil-PH)

**Files to Create:**
- `services/tts.service.ts`
- `services/tts.service.spec.ts`
- `models/tts.model.ts`
- Sub-component: `settings-panel.component.ts|html|scss`

**Key Tasks:**
1. Implement TTSService with Web Speech API
2. Create settings panel component
3. Add voice selection dropdown with grouped voices (by language)
4. Implement preview button to test selected voice
5. Add auto-speak toggle
6. Integrate with ChatMessage to auto-speak on display
7. Add error handling (TTS not supported, voice error)
8. Add stop button during playback

**Tests:**
- [ ] TTSService initializes voices on load
- [ ] Voice dropdown shows grouped voices
- [ ] Preview button speaks sample text
- [ ] Auto-speak toggle controls message playback
- [ ] Message auto-speaks when auto-speak enabled
- [ ] Stop button stops playback mid-sentence
- [ ] Browser without TTS support shows graceful fallback
- [ ] Voice rate & pitch affect playback

**Acceptance Criteria:**
- At least 3 languages supported (en-US, en-GB, fil-PH)
- Voice preview works (speaks sample text)
- Auto-speak can be toggled on/off
- Settings persist to localStorage
- Graceful fallback if browser doesn't support TTS

---

### Phase 4: Voice Input (Speech-to-Text) (Week 3-4)

**Deliverables:**
- VoiceInputService implementation
- Microphone button in input area
- Live transcript display while recording
- Error handling (mic not available, network)
- Visual recording indicator
- Browser compatibility detection

**Files to Create:**
- `services/voice-input.service.ts`
- `services/voice-input.service.spec.ts`
- `models/voice-input.model.ts`

**Key Tasks:**
1. Implement VoiceInputService with Web Speech API (recognition)
2. Add microphone button to input area
3. Show live transcript as user speaks
4. Auto-send message on recognition stop (optional)
5. Show recording indicator (animated mic icon)
6. Handle microphone permission requests
7. Error handling (mic denied, network error, timeout)
8. Add "Stop Recording" button
9. Fallback for browsers without STT

**Tests:**
- [ ] Mic button starts/stops recording
- [ ] Live transcript updates as user speaks
- [ ] Recording indicator animates
- [ ] Microphone permission popup appears
- [ ] Network errors display user-friendly message
- [ ] Message auto-sends after recognition stops
- [ ] Browser without STT shows disabled mic button

**Acceptance Criteria:**
- Microphone works in Chrome, Firefox, Safari (with fallbacks)
- Live transcript is visible while recording
- Recording state is clear to user
- Errors are handled gracefully
- Message is sent after transcript is complete

---

### Phase 5: Command Palette & Polish (Week 4-5)

**Deliverables:**
- CommandPaletteService implementation
- Command palette UI (search + list)
- Volunteer-specific commands (6 commands)
- Quick action pills
- Keyboard navigation (Cmd+K, arrow keys, Enter)
- Command history
- Final polish & edge case handling

**Files to Create:**
- `services/command-palette.service.ts`
- `services/command-palette.service.spec.ts`
- `models/command.model.ts`
- Sub-component: `command-palette.component.ts|html|scss`

**Key Tasks:**
1. Create CommandPaletteService with command registry
2. Implement command palette component (search + list)
3. Add 6 volunteer-specific commands (see section 7)
4. Implement keyboard shortcuts (Cmd+K to open, arrows to navigate)
5. Add quick action pills (visible when palette open)
6. Handle command execution (send to backend or local action)
7. Add command usage analytics
8. Edge cases: empty commands, long command names, mobile UX

**Keyboard Shortcuts:**
- `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux): Open command palette
- `Esc`: Close command palette or sidebar
- `↑/↓`: Navigate commands
- `Enter`: Execute selected command
- `/`: Type to filter commands

**Tests:**
- [ ] Command palette opens with Cmd+K
- [ ] Commands filter as user types
- [ ] Arrow keys navigate command list
- [ ] Enter executes selected command
- [ ] Esc closes palette
- [ ] Mobile: command palette accessible without keyboard
- [ ] All 6 volunteer commands exist and execute

**Acceptance Criteria:**
- Keyboard shortcuts work across browsers
- Command search is fast (< 100ms filter)
- Mobile UX doesn't break with palette
- All 6 volunteer commands are functional

---

### Phase 6: Integration & Testing (Week 5)

**Deliverables:**
- Full integration tests (component + services)
- Performance optimization
- Accessibility audit (WCAG 2.1 AA)
- Browser compatibility matrix
- Code cleanup & documentation

**Tests:**
- [ ] Full message send flow (user input → API → response)
- [ ] TTS + voice input interaction
- [ ] Command execution flow
- [ ] Error recovery (retry, fallback)
- [ ] Mobile responsiveness
- [ ] Keyboard accessibility
- [ ] Performance: no janky animations, smooth scrolling

---

## 7. Volunteer-Specific Commands

### Command Registry

```typescript
export const VOLUNTEER_COMMANDS: Command[] = [
  {
    id: 'events',
    command: '/events',
    text: 'List upcoming events',
    icon: 'bi-calendar-event',
    description: 'Show all upcoming RSVP events you can join',
    action: {
      type: 'query',
      label: 'View Events',
      params: { limit: 10 }
    }
  },
  {
    id: 'attendance',
    command: '/attendance',
    text: 'Check my attendance',
    icon: 'bi-clipboard-check',
    description: 'View your attendance records for all events',
    action: {
      type: 'query',
      label: 'View Attendance'
    }
  },
  {
    id: 'hours',
    command: '/hours',
    text: 'View my volunteer hours',
    icon: 'bi-hourglass-end',
    description: 'Check total volunteer hours logged this month',
    action: {
      type: 'query',
      label: 'View Hours'
    }
  },
  {
    id: 'feedback',
    command: '/feedback',
    text: 'Send feedback',
    icon: 'bi-chat-left-quote',
    description: 'Share feedback about your volunteer experience',
    action: {
      type: 'modal',
      label: 'Open Feedback Form'
    }
  },
  {
    id: 'help',
    command: '/help',
    text: 'Get help',
    icon: 'bi-question-circle',
    description: 'View FAQs and common questions',
    action: {
      type: 'url',
      label: 'Open Help',
      url: '/help'
    }
  },
  {
    id: 'profile',
    command: '/profile',
    text: 'View my profile',
    icon: 'bi-person-circle',
    description: 'Edit your volunteer profile information',
    action: {
      type: 'url',
      label: 'Go to Profile',
      url: '/profile'
    }
  }
];
```

### Backend Integration

When user executes a command:

```
User: /events
  ↓
CommandPaletteService.executeCommand('events')
  ↓
ChatbotService.sendMessage('/events: ')
  ↓
Backend API receives: { message: '/events: ', sessionId: '...' }
  ↓
n8n webhook recognizes /events command
  ↓
n8n fetches upcoming events from database
  ↓
n8n returns formatted response with event list
  ↓
Frontend renders as markdown table
```

### Command Execution Types

1. **Query** (`/events`, `/attendance`, `/hours`): Send to backend, display response
2. **Modal** (`/feedback`): Open client-side modal for input
3. **URL** (`/help`, `/profile`): Navigate to internal route
4. **Local** (future): Execute client-side logic (e.g., /clear-chat)

---

## 8. TTS Implementation Strategy

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│           TTSService (Angular Service)                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Web Speech API (SpeechSynthesis)               │    │
│  ├────────────────────────────────────────────────┤    │
│  │ - Browser-native, no dependencies             │    │
│  │ - 100+ voices (by language/region)            │    │
│  │ - Configurable rate, pitch, volume            │    │
│  │ - Supported: Chrome, Firefox, Safari, Edge    │    │
│  └────────────────────────────────────────────────┘    │
│           ↓ Voice.name lookup, Fallback                 │
│  ┌────────────────────────────────────────────────┐    │
│  │ Voice Cache (localStorage)                     │    │
│  ├────────────────────────────────────────────────┤    │
│  │ - Caches available voices on first load        │    │
│  │ - Stores user's selected voice preference      │    │
│  │ - TTL: 24 hours                                │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Implementation Details

**Voice Selection Strategy:**

```typescript
// For volunteer in Philippines
NG_APP_SUPPORTED_VOICES = 'en-US,en-GB,fil-PH';

// TTSService.getGroupedVoices() returns:
[
  {
    lang: 'en-US',
    langName: 'English (United States)',
    voices: [
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Samantha', lang: 'en-US' },
      ...
    ]
  },
  {
    lang: 'fil-PH',
    langName: 'Filipino (Philippines)',
    voices: [
      { name: 'Filipino', lang: 'fil-PH' },
      ...
    ]
  }
]
```

**Performance Optimization:**

```typescript
// 1. Lazy-load voices on first TTS access
if (!this.voicesLoaded) {
  this.loadVoices();  // ~100-200ms, async
}

// 2. Cache voice objects in memory
private voiceCache = new Map<string, SpeechSynthesisVoice>();

// 3. Use localStorage for user preference
localStorage.setItem('tts_selected_voice', 'Filipino');

// 4. Debounce multiple speak() calls
private speakQueue = new Queue();

// 5. Pre-process text for TTS optimization
private optimizeTextForTTS(text: string): string {
  // Remove markdown, code blocks
  // Expand abbreviations (NLCOM → N L C O M for clarity)
  // Add pauses before sentences
  return processedText;
}
```

**Error Handling:**

```typescript
async speak(text: string): Promise<void> {
  try {
    // Check if TTS supported
    if (!this.isSupported()) {
      throw new Error('Text-to-speech not supported in this browser');
    }

    // Optimize text
    const optimizedText = this.optimizeTextForTTS(text);

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(optimizedText);
    utterance.voice = this.getSelectedVoice();
    utterance.rate = this.config.rate;
    utterance.pitch = this.config.pitch;
    utterance.volume = this.config.volume;

    // Handle events
    utterance.onstart = () => this.isSpeaking.set(true);
    utterance.onend = () => this.isSpeaking.set(false);
    utterance.onerror = (e) => {
      this.error.set(`Speech error: ${e.error}`);
      this.isSpeaking.set(false);
    };

    // Speak
    speechSynthesis.speak(utterance);
  } catch (err) {
    this.error.set(err.message);
  }
}
```

**Browser Compatibility:**

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 25+ | ✅ Full | SpeechSynthesis + SpeechRecognition |
| Firefox 49+ | ✅ Full | SpeechSynthesis; Recognition needs flag |
| Safari 14+ | ✅ Full | Both APIs supported |
| Edge 79+ | ✅ Full | Same as Chrome (Chromium) |
| Opera | ✅ Full | Same as Chrome |
| Mobile Safari | ⚠️ Limited | TTS only, speech recognition limited |
| Chrome Android | ✅ Full | Both APIs |
| Firefox Android | ⚠️ Limited | TTS only |

**Fallback UI:**

```typescript
isTTSSupported(): boolean {
  return (
    'speechSynthesis' in window ||
    'webkitSpeechSynthesis' in window
  );
}

// In template:
@if (isTTSSupported()) {
  <!-- Show TTS buttons -->
} @else {
  <!-- Show message: "TTS not available in your browser" -->
}
```

---

## 9. Voice Input Implementation Strategy

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│       VoiceInputService (Angular Service)               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Web Speech API (SpeechRecognition)             │    │
│  ├────────────────────────────────────────────────┤    │
│  │ - Browser-native, no dependencies             │    │
│  │ - Real-time speech-to-text                    │    │
│  │ - Continuous mode (keep listening)            │    │
│  │ - Supported: Chrome, Edge (Desktop)           │    │
│  │ - Limited: Firefox, Safari                    │    │
│  └────────────────────────────────────────────────┘    │
│           ↓ Microphone permission                       │
│  ┌────────────────────────────────────────────────┐    │
│  │ Browser Microphone API                         │    │
│  ├────────────────────────────────────────────────┤    │
│  │ - getUserMedia() for mic access               │    │
│  │ - Permission prompt shown once                │    │
│  │ - Can be revoked in browser settings           │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Implementation Details

**Voice Input Flow:**

```typescript
// 1. Check support
isSTTSupported(): boolean {
  const SpeechRecognition = window.SpeechRecognition ||
                             window.webkitSpeechRecognition;
  return !!SpeechRecognition;
}

// 2. Request microphone
async requestMicrophoneAccess(): Promise<boolean> {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      this.error.set('Microphone access denied');
    } else if (err.name === 'NotFoundError') {
      this.error.set('No microphone found');
    }
    return false;
  }
}

// 3. Start listening
async start(): Promise<void> {
  const hasAccess = await this.requestMicrophoneAccess();
  if (!hasAccess) return;

  const SpeechRecognition = window.SpeechRecognition ||
                             window.webkitSpeechRecognition;
  this.recognition = new SpeechRecognition();

  // Continuous mode
  this.recognition.continuous = true;
  this.recognition.interimResults = true;
  this.recognition.lang = this.selectedLanguage;

  // Events
  this.recognition.onstart = () => {
    this.isListening.set(true);
    this.transcript.set('');
  };

  this.recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        this.finalTranscript += transcript + ' ';
      } else {
        interim += transcript;
      }
    }
    this.transcript.set(interim);
    this.transcript$.next(interim);
  };

  this.recognition.onerror = (event) => {
    this.error.set(`Speech error: ${event.error}`);
    this.error$.next(event.error);
  };

  this.recognition.onend = () => {
    this.isListening.set(false);
  };

  this.recognition.start();
}

// 4. Stop listening and get transcript
stop(): Promise<string> {
  return new Promise((resolve) => {
    this.recognition.onend = () => {
      this.isListening.set(false);
      resolve(this.finalTranscript.trim());
    };
    this.recognition.stop();
  });
}
```

**Error Handling:**

```typescript
// Permission errors
NotAllowedError: 'Microphone access denied. Please enable in browser settings.'
NotFoundError: 'No microphone detected. Please connect a microphone.'
NotReadableError: 'Microphone is being used by another application.'

// Speech recognition errors
no-speech: 'No speech detected. Please try again.'
audio-capture: 'No audio detected. Check microphone.'
network: 'Network error. Check your internet connection.'
service-not-allowed: 'Speech recognition service not available.'
```

**Mobile Support:**

| Platform | TTS | STT | Notes |
|----------|-----|-----|-------|
| iOS Safari | ⚠️ Yes | ❌ No | TTS works, mic access limited |
| Android Chrome | ✅ Yes | ✅ Yes | Full support |
| Android Firefox | ⚠️ Yes | ❌ No | TTS only |

**Optimization:**

```typescript
// 1. Debounce interim results (don't update UI every 50ms)
transcript$ = this.recognition.onresult.pipe(
  debounceTime(100)
);

// 2. Detect silence timeout (stop after 3 seconds of silence)
private silenceTimeout: ReturnType<typeof setTimeout>;

// 3. Max recording time (prevent accidental long recordings)
private maxRecordingTime = 60 * 1000; // 60 seconds

// 4. Live waveform visualization (optional, performance-intensive)
private audioContext = new (window.AudioContext ||
                              window.webkitAudioContext)();
private analyser = audioContext.createAnalyser();
```

---

## 10. State Management & Persistence

### Signal-Based State

```typescript
// ChatbotSidebarComponent signals
export class ChatbotSidebarComponent {
  // UI State
  showSettings = signal(false);
  showCommandPalette = signal(false);
  selectedCommandIndex = signal(0);

  // Input State
  userInput = signal('');
  isRecording = signal(false);
  liveTranscript = signal('');
  speechError = signal('');

  // TTS State (from service)
  autoSpeak = signal(false);
  currentVoiceName = signal('');
  isSpeaking = signal(false);

  // Computed
  hasMessages = computed(() => this.chatbotService.messages().length > 0);
  isTTSSupported = computed(() => this.ttsService.isSupported());
  isSTTSupported = computed(() => this.voiceInputService.isSupported());
  filteredCommands = computed(() => {
    const query = this.userInput().toLowerCase();
    return this.commandService.filterCommands(query);
  });
}
```

### LocalStorage Persistence

**Keys:**

```typescript
// User preferences (persistent across sessions)
localStorage.setItem('chatbot_auto_speak', JSON.stringify(true));
localStorage.setItem('chatbot_voice_name', 'Filipino');
localStorage.setItem('chatbot_voice_rate', '1.0');
localStorage.setItem('chatbot_voice_pitch', '1.0');
localStorage.setItem('chatbot_language', 'en-US');

// Session state (ephemeral)
sessionStorage.setItem('chatbot_session_id', uuid());
sessionStorage.setItem('chatbot_expanded_settings', 'true');

// Cache (can be cleared)
localStorage.setItem('tts_voices_cache', JSON.stringify(voices));
localStorage.setItem('commands_cache', JSON.stringify(commands));
```

**Hydration (on component init):**

```typescript
ngOnInit() {
  // Restore user preferences
  const autoSpeak = JSON.parse(
    localStorage.getItem('chatbot_auto_speak') || 'false'
  );
  this.autoSpeak.set(autoSpeak);

  const voiceName = localStorage.getItem('chatbot_voice_name');
  if (voiceName) {
    this.ttsService.setVoice(voiceName);
  }

  // Load chat history
  this.chatbotService.loadHistory();

  // Initialize TTS voices (async)
  this.ttsService.loadVoices().then(() => {
    this.voicesReady.set(true);
  });
}
```

### Backend Persistence (Supabase via n8n)

**Chat History Storage:**

```
POST /chatbot/message
{
  "message": "Hello",
  "sessionId": "uuid",
  "userId": "user-uuid"
}

Response:
{
  "success": true,
  "message": "Hi there!",
  "sessionId": "uuid",
  "storedAt": "2025-05-26T10:30:00Z"
}

n8n saves to Supabase:
{
  id: uuid,
  session_id: uuid,
  user_id: user-uuid,
  user_message: "Hello",
  bot_response: "Hi there!",
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## 11. Testing Strategy

### Unit Tests (Service Level)

#### ChatbotService Tests (Enhanced)

```typescript
describe('ChatbotService - TTS Integration', () => {
  let service: ChatbotService;
  let ttsService: TTSService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatbotService, TTSService]
    });
    service = TestBed.inject(ChatbotService);
    ttsService = TestBed.inject(TTSService);
  });

  it('should auto-speak message when autoSpeak enabled', (done) => {
    const spy = vi.spyOn(ttsService, 'speak');
    service.autoSpeak.set(true);

    service.messages.set([{
      role: 'assistant',
      message: 'Hello!',
      created_at: new Date()
    }]);

    setTimeout(() => {
      expect(spy).toHaveBeenCalledWith('Hello!');
      done();
    }, 100);
  });

  it('should not auto-speak when autoSpeak disabled', () => {
    const spy = vi.spyOn(ttsService, 'speak');
    service.autoSpeak.set(false);

    service.messages.set([{
      role: 'assistant',
      message: 'Hello!'
    }]);

    expect(spy).not.toHaveBeenCalled();
  });
});
```

#### TTSService Tests

```typescript
describe('TTSService', () => {
  let service: TTSService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TTSService]
    });
    service = TestBed.inject(TTSService);

    // Mock SpeechSynthesis
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => [
        { name: 'Google US English', lang: 'en-US' }
      ])
    } as any;
  });

  it('should speak text', async () => {
    await service.speak('Hello');
    expect(speechSynthesis.speak).toHaveBeenCalled();
  });

  it('should group voices by language', () => {
    const grouped = service.getGroupedVoices();
    expect(grouped).toContainEqual(
      jasmine.objectContaining({ lang: 'en-US' })
    );
  });

  it('should cache voice selection', async () => {
    await service.setVoice('Google US English');
    expect(localStorage.getItem('chatbot_voice_name'))
      .toBe('Google US English');
  });

  it('should return false for isSupported if SpeechSynthesis unavailable', () => {
    delete (window as any).speechSynthesis;
    expect(service.isSupported()).toBe(false);
  });
});
```

#### VoiceInputService Tests

```typescript
describe('VoiceInputService', () => {
  let service: VoiceInputService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VoiceInputService]
    });
    service = TestBed.inject(VoiceInputService);

    // Mock SpeechRecognition
    const mockRecognition = {
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null
    };
    (window as any).SpeechRecognition = vi.fn(() => mockRecognition);
  });

  it('should start recording', () => {
    service.start();
    expect(service.isListening()).toBe(true);
  });

  it('should return transcript on stop', async () => {
    service.start();
    // Simulate speech result
    service['recognition'].onresult?.({
      results: [[{ transcript: 'Hello', isFinal: true }]]
    } as any);

    const transcript = await service.stop();
    expect(transcript).toBe('Hello');
  });

  it('should emit transcript changes', (done) => {
    service.transcript$.subscribe((text) => {
      expect(text).toBe('Hel');
      done();
    });

    service.start();
    service['recognition'].onresult?.({
      results: [[{ transcript: 'Hel', isFinal: false }]]
    } as any);
  });
});
```

### Component Tests

#### ChatbotSidebarComponent Tests

```typescript
describe('ChatbotSidebarComponent', () => {
  let component: ChatbotSidebarComponent;
  let fixture: ComponentFixture<ChatbotSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatbotSidebarComponent],
      providers: [
        ChatbotService,
        TTSService,
        VoiceInputService,
        CommandPaletteService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChatbotSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should open sidebar when toggleSidebar called', () => {
    expect(component.isOpen()).toBe(false);
    component.toggleSidebar();
    expect(component.isOpen()).toBe(true);
  });

  it('should send message on sendMessage', fakeAsync(() => {
    component.userInput.set('Hello');
    component.sendMessage();

    tick();

    expect(component.userInput()).toBe(''); // Cleared
    expect(component.chatbotService.messages().length).toBeGreaterThan(0);
  }));

  it('should toggle settings panel', () => {
    expect(component.showSettings()).toBe(false);
    component.toggleSettings();
    expect(component.showSettings()).toBe(true);
  });

  it('should filter commands as user types', () => {
    component.userInput.set('/ev');
    expect(component.filteredCommands().length).toBeGreaterThan(0);
    expect(component.filteredCommands()[0].id).toBe('events');
  });

  it('should start/stop recording', async () => {
    expect(component.isRecording()).toBe(false);
    await component.toggleRecording();
    expect(component.isRecording()).toBe(true);
  });

  it('should auto-scroll to latest message', fakeAsync(() => {
    const scrollSpy = vi.spyOn(
      component['scrollContainer'].nativeElement,
      'scrollTop',
      'set'
    );

    component.chatbotService.messages.set([
      { role: 'user', message: 'Hi' },
      { role: 'assistant', message: 'Hello' }
    ]);

    tick();

    expect(scrollSpy).toHaveBeenCalled();
  }));

  it('should render typewriter greeting on empty state', () => {
    component.chatbotService.messages.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('Hello! I\'m ServeTrack AI');
  });

  it('should show copy button on assistant message', () => {
    component.chatbotService.messages.set([{
      role: 'assistant',
      message: 'Test'
    }]);
    fixture.detectChanges();

    const copyBtn = fixture.nativeElement.querySelector('.copy-btn');
    expect(copyBtn).toBeTruthy();
  });
});
```

### Integration Tests

```typescript
describe('ChatbotSidebar - Full Integration', () => {
  let component: ChatbotSidebarComponent;
  let fixture: ComponentFixture<ChatbotSidebarComponent>;
  let httpMock: HttpTestingController;

  it('should send message, get response, and auto-speak', fakeAsync(() => {
    // 1. Enable auto-speak
    component.autoSpeak.set(true);

    // 2. Send message
    component.userInput.set('What events are happening?');
    component.sendMessage();

    // 3. Simulate API response
    tick(100);
    const req = httpMock.expectOne('/chatbot/message');
    req.flush({
      success: true,
      message: 'Here are upcoming events...'
    });

    // 4. Verify auto-speak was called
    tick(100);
    expect(component.ttsService.isSpeaking()).toBe(true);

    // 5. Simulate speak completion
    tick(500);
    expect(component.chatbotService.messages().length).toBe(2);
  }));

  it('should handle voice input -> send -> TTS -> display', fakeAsync(() => {
    // 1. Start recording
    component.toggleRecording();
    expect(component.isRecording()).toBe(true);

    // 2. Simulate transcript
    component.liveTranscript.set('What events...');

    // 3. Stop recording (sends message)
    component.toggleRecording();
    tick(200);

    // 4. Backend responds
    const req = httpMock.expectOne('/chatbot/message');
    req.flush({
      success: true,
      message: 'Event list: ...'
    });

    // 5. Auto-speak enabled
    tick(100);
    expect(component.ttsService.isSpeaking()).toBe(true);
  }));

  it('should execute command /events', fakeAsync(() => {
    // 1. Open command palette
    component.showCommandPalette.set(true);
    expect(component.filteredCommands().length).toBeGreaterThan(0);

    // 2. Select /events command
    component.selectCommand(component.filteredCommands()[0]);

    // 3. Message sent to backend
    tick(100);
    const req = httpMock.expectOne('/chatbot/message');
    expect(req.request.body.message).toContain('/events');

    // 4. Backend returns events
    req.flush({
      success: true,
      message: '| Event | Date | Location |\n|---|---|---|\n...'
    });

    tick(100);
    expect(component.chatbotService.messages().length).toBe(2);
  }));
});
```

---

## 12. Git Commit Strategy

### Logical Commit Grouping

```
Commit 1: refactor: migrate ChatbotContainer to ChatbotSidebarComponent layout
- Move from modal to fixed sidebar
- Add slide-in animation
- Implement responsive breakpoints
- Move avatar to public/assets

Commit 2: feat: add chatbot header with avatar and action buttons
- Header component with logo/title
- Settings, clear, close buttons
- Avatar image display

Commit 3: feat: enhance chatbot messages with styling and animations
- Message styling (user gradient, bot background)
- Copy button with toast
- Typing indicator with pulsing avatar
- Typewriter greeting animation

Commit 4: feat: create settings panel with TTS configuration
- Settings panel UI
- Voice selection dropdown
- Voice preview button
- Auto-speak toggle

Commit 5: feat: add TTSService for text-to-speech
- Web Speech API wrapper
- Voice selection and caching
- Multi-language support (en-US, en-GB, fil-PH)
- Error handling and browser compatibility

Commit 6: feat: add voice input (speech-to-text) capability
- VoiceInputService with SpeechRecognition
- Microphone button in input area
- Live transcript display
- Error handling and permission requests

Commit 7: feat: implement command palette with volunteer-specific commands
- CommandPaletteService with command registry
- Command palette UI with search/filter
- 6 volunteer commands (/events, /attendance, /hours, /feedback, /help, /profile)
- Keyboard shortcuts (Cmd+K, arrow keys, Enter)

Commit 8: feat: add sub-components for better maintainability
- Extract ChatbotHeaderComponent
- Extract ChatbotMessagesComponent
- Extract ChatbotInputComponent
- Extract SettingsPanelComponent
- Extract CommandPaletteComponent

Commit 9: test: add comprehensive test coverage for all features
- Unit tests for services (TTS, voice input, commands)
- Component tests for sidebar and sub-components
- Integration tests for full message flow

Commit 10: style: organize chatbot styles into modules
- _chatbot-sidebar.scss (main layout)
- _animations.scss (keyframes & transitions)
- _messages.scss (message styling)
- _input.scss (input area)
- _responsive.scss (mobile breakpoints)

Commit 11: chore: update admin-layout and volunteer-dashboard for new sidebar
- Update toggle button styling
- Verify z-index layering
- Test integration with new sidebar
```

---

## 13. Migration Path

### Phase A: Parallel Deployment (0 Breaking Changes)

```
Week 1-2:
1. Implement ChatbotSidebarComponent in new folder
2. Keep old ChatbotContainerComponent untouched
3. Feature flag: USE_CHATBOT_SIDEBAR = false in environment
4. Both dashboards can test new sidebar without affecting production

Week 3:
5. Internal testing and feedback
6. Performance profiling
7. Accessibility audit (WCAG 2.1 AA)
8. Browser compatibility matrix

Week 4:
9. Set feature flag: USE_CHATBOT_SIDEBAR = true
10. Monitor error logs and analytics
11. Gradual rollout (10% → 50% → 100%)

Week 5:
12. Remove old ChatbotContainerComponent
13. Clean up old styles and imports
```

### Feature Flag Implementation

```typescript
// environment.ts
export const environment = {
  production: false,
  chatbot: {
    useSidebar: false,  // Toggle between old/new
    ttsEnabled: true,
    voiceInputEnabled: true,
    commandPaletteEnabled: true
  }
};

// admin-layout.ts
import { environment } from '../../environments/environment';

export class AdminLayout {
  readonly ChatbotComponent = environment.chatbot.useSidebar
    ? ChatbotSidebarComponent
    : ChatbotContainerComponent;
}

// volunteer-dashboard-shell.ts
export class VolunteerDashboardShell {
  readonly ChatbotComponent = environment.chatbot.useSidebar
    ? ChatbotSidebarComponent
    : ChatbotContainerComponent;
}
```

### Backward Compatibility

- ChatbotService remains unchanged (existing interface)
- All new features are opt-in (TTS, voice input, commands)
- No breaking changes to message model
- Session persistence works same way

---

## 14. Deployment & Rollback

### Pre-Deployment Checklist

- [ ] All 12 commits reviewed and approved
- [ ] 95%+ test coverage achieved
- [ ] No TypeScript errors (`npm run build`)
- [ ] Pint formatting clean (`./vendor/bin/pint --dirty`)
- [ ] All linting passes (`ng lint`)
- [ ] Performance budget met (LCP < 2s, no jank)
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Browser compatibility matrix complete
- [ ] Analytics events configured
- [ ] Error logging configured
- [ ] Rollback script prepared

### Deployment Steps

```bash
# 1. Create feature branch
git checkout -b feat/chatbot-sidebar-full-parity

# 2. Implement all phases (commits 1-11)

# 3. PR created and approved

# 4. Merge to main
git checkout main
git pull origin main
git merge feat/chatbot-sidebar-full-parity

# 5. Deploy to staging
npm run build
npm run test -- --run
npm run lint

# 6. Deploy to production with feature flag OFF

# 7. Enable feature flag gradually
# Stage 1: 10% of users
# Stage 2: 50% of users (after 1 hour, monitor errors)
# Stage 3: 100% of users (after 4 hours, no issues)
```

### Rollback Plan

```bash
# If critical errors detected:

# Option 1: Feature flag OFF (instant, no deploy)
# - Set useSidebar: false in environment
# - No build needed, works immediately

# Option 2: Git revert (if code issue)
git revert <merge-commit>
npm run build && npm run deploy

# Option 3: Keep sidebar but disable sub-features
# - TTS: ttsEnabled: false
# - Voice input: voiceInputEnabled: false
# - Commands: commandPaletteEnabled: false
```

### Monitoring & Analytics

```typescript
// Track feature usage
this.analyticsService.trackEvent('chatbot_message_sent', {
  messageLength: msg.length,
  hasTTS: this.autoSpeak(),
  hasVoiceInput: this.isRecording(),
  commandUsed: msg.startsWith('/')
});

// Error tracking
try {
  await this.ttsService.speak(text);
} catch (err) {
  this.errorService.captureException(err, {
    context: 'tts_speak',
    userAgent: navigator.userAgent
  });
}

// Performance monitoring
performance.mark('chatbot_message_sent');
// ... API call ...
performance.mark('chatbot_response_received');
performance.measure('chatbot_round_trip',
  'chatbot_message_sent',
  'chatbot_response_received'
);
```

---

## Summary & Timeline

### Quick Reference

| Phase | Duration | Complexity | Files | Tests |
|-------|----------|-----------|-------|-------|
| 1: Layout | 3-4 days | Medium | 3 | 4 |
| 2: Styling | 2-3 days | Low | 8 | 5 |
| 3: TTS | 3-4 days | High | 4 | 10 |
| 4: Voice | 3-4 days | High | 3 | 8 |
| 5: Commands | 3-4 days | Medium | 4 | 8 |
| 6: Testing | 3-4 days | High | - | 25 |
| **Total** | **17-23 days** | **High** | **22** | **60+** |

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| TTS not supported in browser | Medium | Low | Graceful fallback + feature flag |
| Microphone permission denied | Medium | Low | Clear UX explanation + fallback |
| Performance degradation | Low | Medium | Lazy-load, cache, debounce |
| Accessibility issues | Low | High | WCAG audit before launch |
| Safari/Firefox compatibility | Medium | Medium | Polyfill + limited feature set |
