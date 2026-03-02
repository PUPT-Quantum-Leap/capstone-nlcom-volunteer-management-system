import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  passwordStrengthValidator,
  passwordMatchValidator,
} from '../../validators/password.validator';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup-form',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './signup-form.html',
  styleUrl: './signup-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupForm {
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  currentStep = signal(1);
  isSubmitting = signal(false);
  showOtherInput = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  showPasswordRequirements = signal(false);
  error = signal<string | null>(null);
  showSuccessModal = signal(false);

  personalInfoForm: FormGroup;
  educationForm: FormGroup;
  preferencesForm: FormGroup;

  constructor() {
    this.personalInfoForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      facebookName: [''],
      email: ['', [Validators.required, Validators.email]],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^(09|\+639)\d{9}$/)]],
      birthdate: ['', [Validators.required]],
      lastMedicalExam: ['', [Validators.required]],
      completeAddress: ['', [Validators.required, Validators.minLength(10)]],
    });

    this.educationForm = this.fb.group({
      educationalAttainment: ['', [Validators.required]],
      trainingExperience: [''],
      skillsHobbies: [''],
      classesTraining: [''],
    });

    this.preferencesForm = this.fb.group(
      {
        volunteerPreference: ['', [Validators.required]],
        otherPreference: [''],
        password: ['', [Validators.required, passwordStrengthValidator()]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator('password', 'confirmPassword') },
    );

    this.preferencesForm.get('volunteerPreference')?.valueChanges.subscribe((value) => {
      this.showOtherInput.set(value === 'other');
      if (value !== 'other') {
        this.preferencesForm.get('otherPreference')?.setValue('');
      }
    });
  }

  getCurrentForm(): FormGroup {
    if (this.currentStep() === 1) return this.personalInfoForm;
    if (this.currentStep() === 2) return this.educationForm;
    return this.preferencesForm;
  }

  onNext(): void {
    const currentForm = this.getCurrentForm();

    if (currentForm.valid) {
      if (this.currentStep() < 3) {
        this.currentStep.set(this.currentStep() + 1);
      } else {
        this.onSubmit();
      }
    } else {
      this.markFormGroupTouched(currentForm);
    }
  }

  onBack(): void {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    }
  }

  onSubmit(): void {
    if (this.personalInfoForm.valid && this.educationForm.valid && this.preferencesForm.valid) {
      this.isSubmitting.set(true);
      const formData = {
        ...this.personalInfoForm.value,
        ...this.educationForm.value,
        ...this.preferencesForm.value,
      };

      // Submit to real backend API
      this.authService
        .volunteerSignup(formData)
        .then((response: { success: boolean; message?: string }) => {
          if (response.success) {
            // Show success modal
            this.showSuccessModal.set(true);
            
            // Auto-redirect after 3 seconds
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 3000);
          } else {
            // Show error message
            this.error.set(response.message || 'Registration failed');
          }
        })
        .catch((error: any) => {
          this.error.set('Registration failed. Please try again.');
        })
        .finally(() => {
          this.isSubmitting.set(false);
        });
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Close success modal
   */
  closeSuccessModal(): void {
    this.showSuccessModal.set(false);
  }

  /**
   * Navigate to login immediately
   */
  navigateToLoginNow(): void {
    this.closeSuccessModal();
    this.router.navigate(['/login']);
  }

  getErrorMessage(fieldName: string): string {
    const control = this.getCurrentForm().get(fieldName);
    if (!control || !control.touched || !control.errors) {
      return '';
    }

    const errors = control.errors;

    if (errors['required']) {
      return 'This field is required';
    }
    if (errors['email']) {
      return 'Please enter a valid email address';
    }
    if (errors['minlength']) {
      return `Minimum ${errors['minlength'].requiredLength} characters required`;
    }
    if (errors['pattern']) {
      return 'Please enter a valid Philippine mobile number';
    }

    // Password strength errors
    if (fieldName === 'password') {
      if (errors['minLength']) return 'Password must be at least 8 characters';
      if (errors['maxLength']) return 'Password is too long (max 128 characters)';
      if (errors['requiresUppercase']) return 'Password must contain an uppercase letter';
      if (errors['requiresLowercase']) return 'Password must contain a lowercase letter';
      if (errors['requiresNumber']) return 'Password must contain a number';
      if (errors['requiresSpecialChar']) return 'Password must contain a special character';
    }

    // Confirm password errors
    if (fieldName === 'confirmPassword') {
      if (errors['passwordMismatch']) return 'Passwords do not match';
    }

    return '';
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  getPasswordRequirements(): { label: string; met: boolean }[] {
    const password = this.preferencesForm.get('password')?.value || '';

    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter', met: /[a-z]/.test(password) },
      { label: 'One number', met: /[0-9]/.test(password) },
      { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
    ];
  }
}
