import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;

  constructor(private router: Router) {}

  onSubmit() {
    if (this.email && this.password) {
      this.isLoading = true;
      // Simulate API call
      setTimeout(() => {
        console.log('Login attempt:', { email: this.email, password: this.password });
        this.isLoading = false;
        
      }, 2000);
    }
  }

  navigateToSignup() {
    this.router.navigate(['/signup']);
  }
}
