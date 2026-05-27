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
import { TTSService } from '../../services/tts.service';
import { VoiceInputService } from '../../services/voice-input.service';
import { CommandPaletteService } from '../../services/command-palette.service';
import { ChatMessage } from '../../models/chatbot.model';
import { Command } from '../../models/command.model';
import { Subscription } from 'rxjs';
import { SpeechResult } from '../../models/voice-input.model';

@Component({
  selector: 'app-chatbot-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './chatbot-sidebar.component.html',
  styleUrl: './chatbot-sidebar.component.scss',
})
export class ChatbotSidebarComponent implements OnInit, OnDestroy {
  readonly chatbotService = inject(ChatbotService);
  readonly ttsService = inject(TTSService);
  readonly voiceInputService = inject(VoiceInputService);
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
  private pendingTranscript = '';

  // TTS state
  readonly autoSpeak = signal(
    JSON.parse(localStorage.getItem('chatbot_auto_speak') ?? 'false'),
  );
  readonly currentVoiceName = signal(localStorage.getItem('chatbot_voice_name') ?? '');

  // Computed
  readonly isInputValid = computed(() => this.userInput().trim().length > 0);
  readonly isTTSSupported = computed(() => this.ttsService.isSupported());
  readonly isSTTSupported = computed(() => this.voiceInputService.isSupported());
  readonly isSpeaking = computed(() => this.ttsService.isSpeaking());

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

  readonly groupedVoices = computed(() => this.ttsService.getGroupedVoices());

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
        this.ttsService.speak(last.message);
      }
    });
  }

  ngOnInit(): void {
    // Restore voice preference
    const voiceName = this.currentVoiceName();
    if (voiceName) this.ttsService.setVoice(voiceName);

    // Load voices async
    this.ttsService.loadVoices();
    setTimeout(() => this.voicesReady.set(this.ttsService.getVoices().length > 0), 500);

    // Subscribe to speech results and errors
    this.subs.push(
      this.voiceInputService.transcript$.subscribe((result: SpeechResult) => {
        if (result.isFinal) {
          this.pendingTranscript += result.transcript + ' ';
        } else {
          this.liveTranscript.set(result.transcript);
        }
      }),
      this.voiceInputService.error$.subscribe((e) => {
        this.speechError.set(e.message);
        this.isRecording.set(false);
        setTimeout(() => this.speechError.set(''), 5000);
      }),
    );

    // Keyboard shortcuts
    window.addEventListener('keydown', this.onWindowKeydown);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    window.removeEventListener('keydown', this.onWindowKeydown);
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

    if (cmd.action.type === 'url' && cmd.action.url) {
      void this.router.navigateByUrl(cmd.action.url);
      return;
    }

    // For query/modal types: send as message
    this.userInput.set('');
    this.resetTextareaHeight();
    this.chatbotService.sendMessage(cmd.command).subscribe({ error: () => undefined });
  }

  async toggleRecording(): Promise<void> {
    this.speechError.set('');
    if (this.isRecording()) {
      this.isRecording.set(false);
      await this.voiceInputService.stop();
      this.liveTranscript.set('');
      const transcript = this.pendingTranscript.trim();
      this.pendingTranscript = '';
      if (transcript) {
        this.userInput.set(transcript);
        this.sendMessage();
      }
    } else {
      this.pendingTranscript = '';
      this.voiceInputService.start();
      if (!this.voiceInputService.error()) {
        this.isRecording.set(true);
      }
    }
  }

  speakMessage(text: string): void {
    if (this.ttsService.isSpeaking()) {
      this.ttsService.stop();
    } else {
      this.ttsService.speak(text);
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
    if (!this.autoSpeak()) this.ttsService.stop();
  }

  selectVoice(name: string): void {
    this.currentVoiceName.set(name);
    this.ttsService.setVoice(name);
  }

  previewVoice(): void {
    this.ttsService.previewVoice();
  }

  sendSuggestion(text: string): void {
    this.userInput.set(text);
    this.sendMessage();
  }

  formatTime(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
