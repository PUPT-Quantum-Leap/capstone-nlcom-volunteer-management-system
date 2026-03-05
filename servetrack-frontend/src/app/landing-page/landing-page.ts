import { Component, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
<<<<<<< HEAD
=======
import { signal, AfterViewInit } from '@angular/core';
>>>>>>> origin/main

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page-styles.scss',
})
<<<<<<< HEAD
export class LandingPage implements OnDestroy {
  private observer?: IntersectionObserver;

=======
export class LandingPage implements OnDestroy, AfterViewInit {
  private observer?: IntersectionObserver;

  // Popup control signals
  showPopup = signal(false);

>>>>>>> origin/main
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

<<<<<<< HEAD
=======
  // Popup methods
  showPopupModal() {
    this.showPopup.set(true);
  }

  closePopup() {
    this.showPopup.set(false);
  }

>>>>>>> origin/main
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
<<<<<<< HEAD
      rootMargin: '0px 0px -50px 0px'
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
=======
      rootMargin: '0px 0px -50px 0px',
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
>>>>>>> origin/main
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          // Optional: Unobserve after animating to improve performance
          this.observer?.unobserve(entry.target);
        }
      });
    }, observerOptions);

<<<<<<< HEAD
    const animatedElements = document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right');
    animatedElements.forEach(el => this.observer!.observe(el));
=======
    const animatedElements = document.querySelectorAll(
      '.fade-in-up, .fade-in-left, .fade-in-right',
    );
    animatedElements.forEach((el) => this.observer!.observe(el));
>>>>>>> origin/main
  }
}
