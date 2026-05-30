import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ChatbotService } from '../../services/chatbot.service';

@Component({
  selector: 'app-chatbot-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="chatbot-btn"
      (click)="chatbotService.openChatbot()"
      title="Ask Gotcha!"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="9" width="18" height="12" rx="3"/>
        <circle cx="9" cy="15" r="2"/>
        <circle cx="15" cy="15" r="2"/>
        <path d="M12 3v4"/>
        <path d="M8 7h8"/>
      </svg>
      Ask Gotcha!
    </button>
  `,
  styles: [`
    .chatbot-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, rgba(74, 222, 128, 0.15), rgba(34, 197, 94, 0.15));
      border: 1px solid rgba(74, 222, 128, 0.3);
      border-radius: 10px;
      color: #4ade80;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .chatbot-btn:hover {
      background: linear-gradient(135deg, rgba(74, 222, 128, 0.25), rgba(34, 197, 94, 0.25));
      border-color: #4ade80;
      transform: translateY(-1px);
    }
  `]
})
export class ChatbotButtonComponent {
  readonly chatbotService = inject(ChatbotService);
}
