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
        <path d="M9.5 2L11 7L16 8.5L11 10L9.5 15L8 10L3 8.5L8 7L9.5 2Z"/>
        <path d="M18 12L19 15L22 16L19 17L18 20L17 17L14 16L17 15L18 12Z"/>
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
