import { Component, OnDestroy, AfterViewInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, CommonModule],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page-styles.scss',
})
export class LandingPage implements OnDestroy, AfterViewInit {
  private observer?: IntersectionObserver;

  // Popup control signals
  showPopup = signal(false);

  // AI chatbot state
  showChatWindow = signal(false);
  chatInput = signal('');
  chatMessages = signal<{ sender: 'user' | 'bot'; text: string }[]>([
    { sender: 'bot', text: 'Hello! I am ServeBot, your NLCOM volunteer assistant. Ask me anything about volunteering, events, or onboarding.' },
  ]);
  predefinedQuestions = [
    { question: 'How do I sign up as a volunteer?' },
    { question: 'What are the upcoming events?' },
    { question: 'How do I track my volunteer hours?' },
    { question: 'Can I cancel a volunteer shift?' },
  ];

  ngAfterViewInit() {
    this.initScrollAnimations();
  }

  ngOnDestroy() {
    // Clean up observer to prevent memory leak
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }

  // Popup methods
  showPopupModal() {
    this.showPopup.set(true);
  }

  closePopup() {
    this.showPopup.set(false);
  }

  // AI Chat methods
  openChatWindow() {
    this.showChatWindow.set(true);
  }

  closeChatWindow() {
    this.showChatWindow.set(false);
  }

  setChatInput(message: string) {
    this.chatInput.set(message);
  }

  askQuickQuestion(question: string) {
    this.chatInput.set(question);
    this.sendChatMessage();
  }

  sendChatMessage() {
    const message = this.chatInput().trim();
    if (!message) {
      return;
    }

    this.chatMessages.update((list) => [...list, { sender: 'user', text: message }]);

    const normalized = message.toLowerCase();

    const answerMap: Record<string, string> = {
      'how do i sign up as a volunteer?':
        'Tap the "Get Started" button to create an account, then fill in your volunteer profile and choose available events.',
      'what are the upcoming events?':
        'Visit the volunteer dashboard after logging in to see upcoming volunteer events and sign up for shifts.',
      'how do i track my volunteer hours?':
        'Volunteer hours are tracked automatically when you check into and check out of events. Visit your profile for detailed logs.',
      'can i cancel a volunteer shift?':
        'Yes, you can cancel a shift on your RSVP page. Look for the cancel button next to the event and confirm.',
    };

    const botResponse =
      answerMap[normalized] ||
      "Great question! For specific details, go to the volunteer dashboard or contact your NLCOM coordinator.";

    setTimeout(() => {
      this.chatMessages.update((list) => [...list, { sender: 'bot', text: botResponse }]);
    }, 400);

    this.chatInput.set('');
  }

  scrollToSection(sectionId: string, event: Event) {
    event.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  initScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          // Optional: Unobserve after animating to improve performance
          this.observer?.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const animatedElements = document.querySelectorAll(
      '.fade-in-up, .fade-in-left, .fade-in-right',
    );
    animatedElements.forEach((el) => this.observer!.observe(el));
  }
}
