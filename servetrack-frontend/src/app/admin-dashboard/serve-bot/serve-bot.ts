import { Component, inject, signal, computed, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminDashboardService, AdminDashboardData } from '../../services/admin-dashboard.service';

@Component({
  selector: 'app-serve-bot',
  imports: [CommonModule],
  templateUrl: './serve-bot.html',
  styleUrl: './serve-bot.scss'
})
export class ServeBotComponent implements OnInit {
  private adminService = inject(AdminDashboardService);
  
  isOpen = signal(false);
  close = output<void>();
  
  dashboardData = signal<AdminDashboardData | null>(null);
  isLoading = signal(true);
  
  welcomeMessage = signal('');
  
  summary = computed(() => {
    const data = this.dashboardData();
    if (!data) return 'Just a moment, I\'m gathering the latest updates for you...';
    
    const { stats } = data;
    return `Hello! I've analyzed your dashboard. Currently, you have ${stats.totalVolunteers} volunteers in your community, with ${stats.activeVolunteers} of them actively helping out right now. You also have ${stats.upcomingEvents} events coming up that might need your attention!`;
  });

  ngOnInit(): void {
    this.loadData();
    this.setFriendlyGreeting();
  }

  setFriendlyGreeting(): void {
    const hours = new Date().getHours();
    let greeting = 'Good morning';
    if (hours >= 12 && hours < 17) greeting = 'Good afternoon';
    if (hours >= 17) greeting = 'Good evening';
    
    this.welcomeMessage.set(`${greeting}, Admin! How can I help you manage your volunteers today?`);
  }

  loadData(): void {
    this.isLoading.set(true);
    this.adminService.getDashboardData().subscribe({
      next: (response) => {
        if (response.success) {
          this.dashboardData.set(response.data);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
