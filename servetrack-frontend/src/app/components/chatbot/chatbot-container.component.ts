import { Component, inject, ChangeDetectionStrategy, ElementRef, viewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService } from '../../services/chatbot.service';

@Component({
  selector: 'app-chatbot-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chatbot-wrapper" [class.open]="chatbotService.showChatbot()">
      <div class="chatbot-header">
        <div class="header-info">
          <div class="bot-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v4" />
              <line x1="8" y1="16" x2="8" y2="16" />
              <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
          </div>
          <div class="header-text">
            <h3>ServeTrack AI</h3>
            <span class="status">Online</span>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-icon" (click)="clearChat()" title="Clear chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6H5H21" />
              <path d="M8 6V4C8 3.47 8.21 2.96 8.59 2.59C8.96 2.21 9.47 2 10 2H14C14.53 2 15.04 2.21 15.41 2.59C15.79 2.96 16 3.47 16 4V6" />
              <path d="M19 6V20C19 20.53 18.79 21.04 18.41 21.41C18.04 21.79 17.53 22 17 22H7C6.47 22 5.96 21.79 5.59 21.41C5.21 21.04 5 20.53 5 20V6" />
            </svg>
          </button>
          <button class="btn-icon" (click)="chatbotService.closeChatbot()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div class="chatbot-messages" #messagesContainer>
        @if (!chatbotService.hasMessages()) {
          <div class="welcome-message">
            <div class="welcome-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            </div>
            <h4>Hello! I'm ServeTrack AI Assistant</h4>
            <p>I can help you with questions about NLCOM volunteer programs, RSVP events, attendance tracking, ICS operations, and more.</p>
            <div class="suggestion-chips">
              <button class="chip" (click)="sendSuggestion('How do I register for an event?')">How do I register for an event?</button>
              <button class="chip" (click)="sendSuggestion('When is the next feeding program?')">When is the next feeding program?</button>
              <button class="chip" (click)="sendSuggestion('How do I update my profile?')">How do I update my profile?</button>
            </div>
          </div>
        }

        @for (msg of chatbotService.messages(); track $index) {
          <div class="message" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
            @if (msg.role === 'assistant') {
              <div class="message-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <circle cx="12" cy="5" r="2" />
                  <path d="M12 7v4" />
                  <line x1="8" y1="16" x2="8" y2="16" />
                  <line x1="16" y1="16" x2="16" y2="16" />
                </svg>
              </div>
            }
            <div class="message-content">
              <p>{{ msg.message }}</p>
              @if (msg.created_at) {
                <span class="timestamp">{{ formatTime(msg.created_at) }}</span>
              }
            </div>
          </div>
        }

        @if (chatbotService.isLoading()) {
          <div class="message assistant">
            <div class="message-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            </div>
            <div class="message-content typing">
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        }
      </div>

      <div class="chatbot-input">
        <textarea
          #messageInput
          [(ngModel)]="inputMessage"
          (keydown.enter)="onEnterKey($event)"
          placeholder="Type your message..."
          rows="1"
          [maxlength]="4000"
        ></textarea>
        <button
          class="btn-send"
          (click)="sendMessage()"
          [disabled]="!inputMessage.trim() || chatbotService.isLoading()"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .chatbot-wrapper {
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100vh;
      background: var(--bg-secondary, #1a1a2e);
      border-left: 1px solid var(--border-color, rgba(255,255,255,0.1));
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    }

    .chatbot-wrapper.open {
      transform: translateX(0);
    }

    @media (max-width: 768px) {
      .chatbot-wrapper { width: 100%; }
    }

    .chatbot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: var(--bg-tertiary, #16213e);
      border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1));
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .bot-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4ade80, #22c55e);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .header-text h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }

    .header-text .status {
      font-size: 12px;
      color: #4ade80;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn-icon {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .btn-icon:hover {
      background: rgba(255,255,255,0.2);
    }

    .chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .welcome-message {
      text-align: center;
      padding: 32px 16px;
      color: #fff;
    }

    .welcome-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 16px;
      background: linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(34, 197, 94, 0.2));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #4ade80;
    }

    .welcome-message h4 {
      margin: 0 0 8px;
      font-size: 18px;
    }

    .welcome-message p {
      margin: 0 0 24px;
      font-size: 14px;
      color: rgba(255,255,255,0.7);
      line-height: 1.5;
    }

    .suggestion-chips {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .chip {
      padding: 10px 16px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px;
      color: rgba(255,255,255,0.9);
      font-size: 13px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    }

    .chip:hover {
      background: rgba(74, 222, 128, 0.2);
      border-color: #4ade80;
      color: #4ade80;
    }

    .message {
      display: flex;
      gap: 10px;
      max-width: 85%;
    }

    .message.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }

    .message.assistant {
      align-self: flex-start;
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4ade80, #22c55e);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .message-content {
      padding: 12px 16px;
      border-radius: 16px;
      line-height: 1.5;
    }

    .message.user .message-content {
      background: linear-gradient(135deg, #4ade80, #22c55e);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message.assistant .message-content {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border-bottom-left-radius: 4px;
    }

    .message-content p {
      margin: 0;
      font-size: 14px;
      white-space: pre-wrap;
    }

    .timestamp {
      display: block;
      font-size: 10px;
      color: rgba(255,255,255,0.5);
      margin-top: 4px;
    }

    .message-content.typing {
      padding: 16px 20px;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: rgba(255,255,255,0.5);
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    .chatbot-input {
      display: flex;
      gap: 8px;
      padding: 16px;
      background: var(--bg-tertiary, #16213e);
      border-top: 1px solid var(--border-color, rgba(255,255,255,0.1));
    }

    .chatbot-input textarea {
      flex: 1;
      padding: 12px 16px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      outline: none;
      min-height: 44px;
      max-height: 120px;
    }

    .chatbot-input textarea::placeholder {
      color: rgba(255,255,255,0.5);
    }

    .chatbot-input textarea:focus {
      border-color: #4ade80;
    }

    .btn-send {
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #4ade80, #22c55e);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s, transform 0.2s;
      flex-shrink: 0;
    }

    .btn-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-send:not(:disabled):hover {
      transform: scale(1.05);
    }
  `]
})
export class ChatbotContainerComponent {
  readonly chatbotService = inject(ChatbotService);
  readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');
  readonly messageInput = viewChild<ElementRef<HTMLTextAreaElement>>('messageInput');

  inputMessage = '';

  constructor() {
    effect(() => {
      if (this.chatbotService.messages().length > 0) {
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });
  }

  onEnterKey(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (!keyEvent.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    if (!this.inputMessage.trim() || this.chatbotService.isLoading()) return;
    const text = this.inputMessage;
    this.inputMessage = '';
    this.chatbotService.sendMessage(text).subscribe();
  }

  sendSuggestion(text: string): void {
    this.inputMessage = text;
    this.sendMessage();
  }

  clearChat(): void {
    if (confirm('Clear this conversation?')) {
      this.chatbotService.clearHistory().subscribe();
    }
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom(): void {
    const container = this.messagesContainer()?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}
