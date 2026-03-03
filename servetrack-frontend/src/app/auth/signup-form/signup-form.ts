import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  passwordStrengthValidator,
  passwordMatchValidator,
} from '../../validators/password.validator';
import {
  phoneNumberValidator,
  nameValidator,
  emailValidator,
  dateValidator,
  addressValidator,
  emergencyContactValidator,
  customAvailabilityValidator,
  lifegroupLeaderValidator,
} from '../../validators/form.validator';
import { AuthService } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';

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
  private sanitizer = inject(InputSanitizerService);

  currentStep = signal(1);
  isSubmitting = signal(false);
  showOtherInput = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  showPasswordRequirements = signal(false);
  error = signal<string | null>(null);
  showSuccessModal = signal(false);
  showLifegroupLeaderInput = signal(false);
  showOtherAvailabilityInput = signal(false);

  personalInfoForm: FormGroup;
  educationForm: FormGroup;
  preferencesForm: FormGroup;

  constructor() {
    this.personalInfoForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      facebookName: ['', [Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^(09|\+639)\d{9}$/)]],
      birthdate: ['', [Validators.required]],
      lastMedicalExam: ['', [Validators.required]],
      completeAddress: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(255)]],
    });

    this.educationForm = this.fb.group({
      educationalAttainment: ['', [Validators.required, Validators.maxLength(100)]],
      trainingExperience: ['', [Validators.maxLength(1000)]],
      skillsHobbies: ['', [Validators.maxLength(1000)]],
      classesTraining: ['', [Validators.maxLength(1000)]],
    });

    this.preferencesForm = this.fb.group(
      {
        volunteerPreference: ['', [Validators.required]],
        otherPreference: ['', [Validators.maxLength(255)]],
        availability: ['', [Validators.required]],
        otherAvailability: ['', [Validators.maxLength(100)]],
        partOfLifegroup: ['', [Validators.required]],
        lifegroupLeaderName: ['', [Validators.maxLength(100)]],
        leadingLifegroup: ['', [Validators.required]],
        emergencyContactName: ['', [Validators.required, Validators.maxLength(100)]],
        emergencyContactNumber: ['', [Validators.required, Validators.pattern(/^(09|\+639)\d{9}$/)]],
        emergencyContactRelationship: ['', [Validators.required, Validators.maxLength(50)]],
        password: ['', [Validators.required, passwordStrengthValidator()]],
        confirmPassword: ['', [Validators.required]],
      },
      {
        validators: passwordMatchValidator('password', 'confirmPassword'),
      },
    );

    this.preferencesForm.get('lifegroupLeaderName')?.setValidators([
      Validators.maxLength(100),
      lifegroupLeaderValidator()
    ]);

    this.preferencesForm.get('otherAvailability')?.setValidators([
      Validators.maxLength(100),
      customAvailabilityValidator()
    ]);

    this.preferencesForm.get('volunteerPreference')?.valueChanges.subscribe((value) => {
      this.showOtherInput.set(value === 'other');
      if (value !== 'other') {
        this.preferencesForm.get('otherPreference')?.setValue('');
      }
    });

    this.preferencesForm.get('availability')?.valueChanges.subscribe((value) => {
      this.showOtherAvailabilityInput.set(value === 'others');
      if (value !== 'others') {
        this.preferencesForm.get('otherAvailability')?.setValue('');
      }
    });

    this.preferencesForm.get('partOfLifegroup')?.valueChanges.subscribe((value) => {
      const lifegroupLeaderControl = this.preferencesForm.get('lifegroupLeaderName');
      this.showLifegroupLeaderInput.set(value === 'yes');
      
      if (value === 'yes') {
        lifegroupLeaderControl?.setValidators([Validators.required]);
      } else {
        lifegroupLeaderControl?.clearValidators();
        lifegroupLeaderControl?.setValue('');
      }
      lifegroupLeaderControl?.updateValueAndValidity();
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
      
      // Sanitize and validate form data
      const formData = this.sanitizeAndValidateFormData();
      
      if (!formData) {
        this.isSubmitting.set(false);
        return;
      }

      // Submit to real backend API
      this.authService
        .volunteerSignup(formData)
        .then((response: { success: boolean; message?: string }) => {
          if (response.success) {
            // Show success modal
            this.showSuccessModal.set(true);
            
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 5000);
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

  private sanitizeAndValidateFormData(): any | null {
    const rawData = {
      ...this.personalInfoForm.value,
      ...this.educationForm.value,
      ...this.preferencesForm.value,
    };

    // Sanitize text fields
    const sanitized = {
      firstName: this.sanitizer.sanitizeInput(rawData.firstName, 'both'),
      lastName: this.sanitizer.sanitizeInput(rawData.lastName, 'both'),
      facebookName: this.sanitizer.sanitizeInput(rawData.facebookName, 'both'),
      email: this.sanitizer.sanitizeInput(rawData.email, 'text'),
      mobileNumber: this.sanitizer.sanitizeInput(rawData.mobileNumber, 'text'),
      birthdate: rawData.birthdate,
      lastMedicalExam: rawData.lastMedicalExam,
      completeAddress: this.sanitizer.sanitizeInput(rawData.completeAddress, 'both'),
      educationalAttainment: this.sanitizer.sanitizeInput(rawData.educationalAttainment, 'both'),
      trainingExperience: this.sanitizer.sanitizeInput(rawData.trainingExperience, 'both'),
      skillsHobbies: this.sanitizer.sanitizeInput(rawData.skillsHobbies, 'both'),
      classesTraining: this.sanitizer.sanitizeInput(rawData.classesTraining, 'both'),
      volunteerPreference: rawData.volunteerPreference,
      otherPreference: this.sanitizer.sanitizeInput(rawData.otherPreference, 'both'),
      availability: rawData.availability,
      otherAvailability: this.sanitizer.sanitizeInput(rawData.otherAvailability, 'both'),
      partOfLifegroup: rawData.partOfLifegroup,
      lifegroupLeaderName: this.sanitizer.sanitizeInput(rawData.lifegroupLeaderName, 'both'),
      leadingLifegroup: rawData.leadingLifegroup,
      emergencyContactName: this.sanitizer.sanitizeInput(rawData.emergencyContactName, 'both'),
      emergencyContactNumber: this.sanitizer.sanitizeInput(rawData.emergencyContactNumber, 'text'),
      emergencyContactRelationship: this.sanitizer.sanitizeInput(rawData.emergencyContactRelationship, 'both'),
      password: rawData.password,
      confirmPassword: rawData.confirmPassword,
    };

    // Additional validations
    const errors: string[] = [];

    if (!this.sanitizer.validateEmail(sanitized.email)) {
      errors.push('Invalid email format');
    }

    if (!this.sanitizer.validatePhoneNumber(sanitized.mobileNumber)) {
      errors.push('Invalid mobile number format');
    }
    if (!this.sanitizer.validatePhoneNumber(sanitized.emergencyContactNumber)) {
      errors.push('Invalid emergency contact number format');
    }

    if (this.sanitizer.isFutureDate(sanitized.birthdate)) {
      errors.push('Birthdate cannot be in the future');
    }
    if (this.sanitizer.isFutureDate(sanitized.lastMedicalExam)) {
      errors.push('Medical exam date cannot be in the future');
    }

    if (!this.sanitizer.validateName(sanitized.firstName)) {
      errors.push('Invalid first name');
    }
    if (!this.sanitizer.validateName(sanitized.lastName)) {
      errors.push('Invalid last name');
    }

    const passwordValidation = this.sanitizer.validatePasswordStrength(sanitized.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }

    if (sanitized.partOfLifegroup === 'yes' && !sanitized.lifegroupLeaderName) {
      errors.push('Lifegroup leader name is required when part of a lifegroup');
    }

    if (sanitized.availability === 'others' && !sanitized.otherAvailability) {
      errors.push('Custom availability description is required');
    }

    if (errors.length > 0) {
      this.error.set(errors.join('; '));
      return null;
    }

    return sanitized;
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
      if (fieldName === 'mobileNumber' || fieldName === 'emergencyContactNumber') {
        return 'Please enter a valid Philippine mobile number';
      }
      return 'Invalid format';
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
