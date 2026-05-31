import { Component, OnDestroy, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page-styles.scss',
})
export class LandingPage implements OnDestroy, AfterViewInit {
  private observer?: IntersectionObserver;

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
