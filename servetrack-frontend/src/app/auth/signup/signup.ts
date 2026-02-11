import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, CommonModule],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  name: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  isLoading: boolean = false;

  constructor(private router: Router) {}

  onSubmit() {
    if (this.name && this.email && this.password && this.confirmPassword) {
      if (this.password !== this.confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      this.isLoading = true;
      // Simulate API call
      setTimeout(() => {
        console.log('Signup attempt:', {
          name: this.name,
          email: this.email,
          password: this.password
        });
        this.isLoading = false;
        
      }, 2000);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
