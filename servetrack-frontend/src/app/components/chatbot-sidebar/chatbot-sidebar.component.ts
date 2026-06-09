import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatbotService, CHATBOT_MAX_MESSAGE_LENGTH } from '../../services/chatbot.service';
import { SpeechService } from '../../services/speech.service';
import { CommandPaletteService } from '../../services/command-palette.service';
import { ChatMessage, ChatbotAction } from '../../models/chatbot.model';
import { Command } from '../../models/command.model';
import { Subscription } from 'rxjs';
import { SpeechResult } from '../../models/speech.model';
import { ChatChartComponent } from './chat-chart/chat-chart.component';

@Component({
  selector: 'app-chatbot-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ChatChartComponent],
  templateUrl: './chatbot-sidebar.component.html',
  styleUrl: './chatbot-sidebar.component.scss',
})
export class ChatbotSidebarComponent implements OnInit, OnDestroy {
  readonly chatbotService = inject(ChatbotService);
  readonly speechService = inject(SpeechService);
  readonly commandService = inject(CommandPaletteService);
  private readonly router = inject(Router);

  readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');
  readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textareaRef');

  readonly maxLength = CHATBOT_MAX_MESSAGE_LENGTH;

  readonly suggestions: readonly string[] = [
    'How do I register for an event?',
    'When is the next feeding program?',
    'How do I check my attendance?',
  ];

  // UI state
  readonly showSettings = signal(false);
  readonly showCommandPalette = signal(false);
  readonly selectedCommandIndex = signal(0);
  readonly copiedIndex = signal<number | null>(null);
  readonly voicesReady = signal(false);

  // Input state
  readonly userInput = signal('');
  readonly isRecording = signal(false);
  readonly liveTranscript = signal('');
  readonly speechError = signal('');

  // TTS state
  readonly autoSpeak = signal(
    JSON.parse(localStorage.getItem('chatbot_auto_speak') ?? 'false'),
  );

  // ─── Typewriter greeting ───────────────────────────────────────
  readonly typewriterText = signal('');
  readonly showTypewriter = signal(true);
  private readonly greetingText = "Hello! I'm Gotcha!";
  private typewriterTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // ─── Fun loading words ─────────────────────────────────────────
  readonly loadingWord = signal('Thinking...');
  private readonly funWords = [
    'Thinking...', 'Processing...', 'Analyzing...', 'Computing...',
    'Brainstorming...', 'Consulting the oracle...', 'Connecting dots...',
    'Loading wisdom...', 'Asking the stars...', 'Doing research...',
  ];
  private loadingIntervalId: ReturnType<typeof setInterval> | null = null;

  // Computed
  readonly isInputValid = computed(() => this.userInput().trim().length > 0);
  readonly isTTSSupported = this.speechService.isTTSSupported;
  readonly isSTTSupported = this.speechService.isSTTSupported;
  readonly isSpeaking = this.speechService.isSpeaking;

  readonly filteredCommands = computed(() => {
    const q = this.userInput();
    if (!q.startsWith('/')) return [];
    return this.commandService.filterCommands(q);
  });

  readonly showCommandDropdown = computed(
    () => this.filteredCommands().length > 0 || this.showCommandPalette(),
  );

  readonly visibleCommands = computed(() =>
    this.showCommandPalette()
      ? this.commandService.filterCommands(this.userInput())
      : this.filteredCommands(),
  );

  readonly groupedVoices = computed(() => this.speechService.getGroupedVoices());

  // Quick pills (derived from command service)
  readonly quickPills = computed(() =>
    this.commandService.filterCommands('/').slice(0, 4),
  );

  private subs: Subscription[] = [];

  constructor() {
    // Auto-scroll on new messages
    effect(() => {
      this.chatbotService.messages();
      this.chatbotService.isLoading();
      queueMicrotask(() => this.scrollToBottom());
    });

    // Auto-speak new assistant messages
    effect(() => {
      const msgs = this.chatbotService.messages();
      if (!this.autoSpeak() || msgs.length === 0) return;
      const last = msgs[msgs.length - 1];
      if (last.role === 'assistant') {
        this.speechService.speak(last.message);
      }
    });

    // Fun loading words rotation
    effect(() => {
      if (this.chatbotService.isLoading()) {
        this.rotateLoadingWord();
        this.loadingIntervalId = setInterval(() => this.rotateLoadingWord(), 800);
      } else {
        if (this.loadingIntervalId) {
          clearInterval(this.loadingIntervalId);
          this.loadingIntervalId = null;
        }
        this.loadingWord.set('Thinking...');
      }
    });

    // Hide typewriter when messages appear
    effect(() => {
      if (this.chatbotService.hasMessages()) {
        this.showTypewriter.set(false);
        this.stopTypewriterAnimation();
      }
    });
  }

  ngOnInit(): void {
    // Load voices (constructor already tries, but some browsers load async)
    this.speechService.reloadVoices();
    setTimeout(() => this.voicesReady.set(this.speechService.availableVoices().length > 0), 500);

    // Start typewriter greeting
    this.startTypewriterAnimation();

    // Subscribe to speech results and errors
    this.subs.push(
      this.speechService.transcript$.subscribe((result: SpeechResult) => {
        this.liveTranscript.set(result.transcript);
        if (result.isFinal) {
          const existingText = this.userInput().trim();
          const newText = result.transcript.trim();
          const combined = existingText
            ? `${existingText} ${newText}`
            : newText;
          this.userInput.set(combined);
          this.liveTranscript.set('');
        }
      }),
      this.speechService.error$.subscribe((e) => {
        if (this.isRecording()) {
          this.speechError.set(e.message);
          this.isRecording.set(false);
          setTimeout(() => this.speechError.set(''), 5000);
        }
      }),
    );

    // Keyboard shortcuts
    window.addEventListener('keydown', this.onWindowKeydown);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    window.removeEventListener('keydown', this.onWindowKeydown);
    this.stopTypewriterAnimation();
    if (this.loadingIntervalId) {
      clearInterval(this.loadingIntervalId);
    }
  }

  // ─── Typewriter methods ────────────────────────────────────────
  private startTypewriterAnimation(): void {
    let charIndex = 0;
    let deleting = false;
    this.typewriterText.set('');

    const typeNext = (): void => {
      if (!deleting) {
        if (charIndex < this.greetingText.length) {
          this.typewriterText.set(this.greetingText.slice(0, charIndex + 1));
          charIndex++;
          this.typewriterTimeoutId = setTimeout(typeNext, 60);
        } else {
          deleting = true;
          this.typewriterTimeoutId = setTimeout(typeNext, 1200);
        }
      } else {
        if (charIndex > 0) {
          charIndex--;
          this.typewriterText.set(this.greetingText.slice(0, charIndex));
          this.typewriterTimeoutId = setTimeout(typeNext, 30);
        } else {
          deleting = false;
          this.typewriterTimeoutId = setTimeout(typeNext, 500);
        }
      }
    };

    this.typewriterTimeoutId = setTimeout(typeNext, 400);
  }

  private stopTypewriterAnimation(): void {
    if (this.typewriterTimeoutId) {
      clearTimeout(this.typewriterTimeoutId);
      this.typewriterTimeoutId = null;
    }
  }

  // ─── Loading word rotation ─────────────────────────────────────
  private rotateLoadingWord(): void {
    const randomIndex = Math.floor(Math.random() * this.funWords.length);
    this.loadingWord.set(this.funWords[randomIndex]);
  }

  // ─── Action button handler ─────────────────────────────────────
  executeAction(action: ChatbotAction): void {
    if (action.type === 'navigate' && action.url) {
      void this.router.navigateByUrl(action.url);
    } else if (action.type === 'action' && action.label) {
      // Send the action label as a message prompt
      this.userInput.set(action.label);
      this.sendMessage();
    }
  }

  private onWindowKeydown = (e: KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.toggleCommandPalette();
    }
    if (e.key === 'Escape') {
      if (this.showCommandPalette()) {
        this.showCommandPalette.set(false);
      } else {
        this.chatbotService.closeChatbot();
      }
    }
    if (this.showCommandDropdown()) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedCommandIndex.update((i) =>
          Math.min(i + 1, this.visibleCommands().length - 1),
        );
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedCommandIndex.update((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && this.showCommandDropdown()) {
        const cmd = this.visibleCommands()[this.selectedCommandIndex()];
        if (cmd) {
          e.preventDefault();
          this.selectCommand(cmd);
        }
      }
    }
  };

  onInputChange(value: string): void {
    this.userInput.set(value ?? '');
    this.selectedCommandIndex.set(0);
    this.autoResize();
  }

  onEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey && !this.showCommandDropdown()) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    const text = this.userInput().trim();
    if (!text || this.chatbotService.isLoading()) return;
    this.userInput.set('');
    this.liveTranscript.set('');
    this.speechError.set('');
    this.showCommandPalette.set(false);
    this.resetTextareaHeight();
    this.chatbotService.sendMessage(text).subscribe({ error: () => undefined });
  }

  clearChat(): void {
    if (confirm('Clear this conversation?')) {
      this.chatbotService.clearHistory().subscribe();
      this.showTypewriter.set(true);
      this.startTypewriterAnimation();
    }
  }

  toggleSettings(): void {
    this.showSettings.update((v) => !v);
  }

  toggleCommandPalette(): void {
    this.showCommandPalette.update((v) => !v);
    this.selectedCommandIndex.set(0);
    if (this.showCommandPalette()) {
      this.userInput.set('/');
      setTimeout(() => this.textareaRef()?.nativeElement.focus(), 50);
    }
  }

  selectCommand(cmd: Command): void {
    this.commandService.trackCommandUsage(cmd.id);
    this.showCommandPalette.set(false);
    this.userInput.set('');
    this.resetTextareaHeight();
    this.chatbotService.sendMessage(cmd.command).subscribe({ error: () => undefined });
  }

  toggleRecording(): void {
    this.speechError.set('');
    if (this.isRecording()) {
      this.isRecording.set(false);
      this.speechService.stopListening();
      this.liveTranscript.set('');
    } else {
      this.speechService.startListening();
      if (!this.speechService.error()) {
        this.isRecording.set(true);
      }
    }
  }

  speakMessage(text: string): void {
    if (this.speechService.isSpeaking()) {
      this.speechService.stopSpeaking();
    } else {
      this.speechService.speak(text);
    }
  }

  copyMessage(msg: ChatMessage, index: number): void {
    const write = (t: string): Promise<void> => {
      if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(t);
      return new Promise<void>((res, rej) => {
        try {
          const ta = document.createElement('textarea');
          ta.value = t;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          res();
        } catch (e) { rej(e); }
      });
    };
    write(msg.message).then(() => {
      this.copiedIndex.set(index);
      setTimeout(() => { if (this.copiedIndex() === index) this.copiedIndex.set(null); }, 1500);
    }).catch(() => undefined);
  }

  toggleAutoSpeak(): void {
    this.autoSpeak.update((v) => !v);
    localStorage.setItem('chatbot_auto_speak', JSON.stringify(this.autoSpeak()));
    if (!this.autoSpeak()) this.speechService.stopSpeaking();
  }

  selectVoice(name: string): void {
    this.speechService.setVoiceByName(name);
  }

  previewVoice(): void {
    this.speechService.previewVoice();
  }

  sendSuggestion(text: string): void {
    this.userInput.set(text);
    this.sendMessage();
  }

  formatTime(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  private autoResize(): void {
    const el = this.textareaRef()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  private resetTextareaHeight(): void {
    const el = this.textareaRef()?.nativeElement;
    if (el) el.style.height = 'auto';
  }

  private scrollToBottom(): void {
    const c = this.messagesContainer()?.nativeElement;
    if (c) c.scrollTop = c.scrollHeight;
  }
}
