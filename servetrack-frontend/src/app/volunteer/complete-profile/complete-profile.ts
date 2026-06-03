import { Component, ChangeDetectionStrategy, signal, inject, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';
import {
  phoneNumberValidator,
  nameValidator,
  dateValidator,
  addressValidator,
  emergencyContactValidator,
  customAvailabilityValidator,
  lifegroupLeaderValidator,
} from '../../validators/form.validator';

@Component({
  selector: 'app-complete-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './complete-profile.html',
  styleUrl: './complete-profile.scss',
})
export class ProfileCompleteComponent implements OnInit {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sanitizer = inject(InputSanitizerService);

  isSubmitting = signal(false);
  submitError = signal<string | null>(null);
  showOtherPreference = signal(false);
  showOtherAvailability = signal(false);
  showLifegroupLeader = signal(false);

  currentUser = this.authService.currentUser;
  displayName = computed(() => this.currentUser()?.name ?? '');
  displayEmail = computed(() => this.currentUser()?.email ?? '');
  isGoogleUser = computed(() => this.currentUser()?.provider === 'google');

  form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, nameValidator(this.sanitizer)]],
    lastName: ['', [Validators.required, nameValidator(this.sanitizer)]],
    mobileNumber: ['', [Validators.required, phoneNumberValidator(this.sanitizer)]],
    birthdate: ['', [Validators.required, dateValidator(this.sanitizer, 'Birthdate')]],
    completeAddress: ['', [Validators.required, addressValidator()]],
    lastMedicalExam: ['', [Validators.required, dateValidator(this.sanitizer, 'Medical exam date')]],
    educationalAttainment: ['', [Validators.required, Validators.maxLength(100)]],
    trainingExperience: ['', [Validators.maxLength(1000)]],
    skillsHobbies: ['', [Validators.maxLength(1000)]],
    classesTraining: ['', [Validators.maxLength(1000)]],
    volunteerPreference: ['', [Validators.required]],
    otherPreference: ['', [Validators.maxLength(255)]],
    availability: ['', [Validators.required]],
    otherAvailability: ['', [Validators.maxLength(100), customAvailabilityValidator()]],
    partOfLifegroup: ['', [Validators.required]],
    lifegroupLeaderName: ['', [Validators.maxLength(100), lifegroupLeaderValidator()]],
    leadingLifegroup: ['', [Validators.required]],
    emergencyContactName: ['', [Validators.required, Validators.maxLength(100)]],
    emergencyContactNumber: ['', [Validators.required, emergencyContactValidator(this.sanitizer)]],
    emergencyContactRelationship: ['', [Validators.required, Validators.maxLength(50)]],
  });

  ngOnInit(): void {
    // For email signup users: pre-fill and hide fields already collected at registration
    const user = this.currentUser();
    if (user && !this.isGoogleUser()) {
      const volunteer = user.volunteer_profile;
      const nameParts = user.name?.split(' ') ?? [];
      this.form.patchValue({
        firstName: nameParts[0] ?? '',
        lastName: nameParts.slice(1).join(' ') ?? '',
        mobileNumber: volunteer?.mobile_number ?? '',
      });
      // Remove required validators since these are already stored
      this.form.get('firstName')?.clearValidators();
      this.form.get('lastName')?.clearValidators();
      this.form.get('mobileNumber')?.clearValidators();
    }

    this.form.get('volunteerPreference')?.valueChanges.subscribe((v) => {
      this.showOtherPreference.set(v === 'other');
      if (v !== 'other') { this.form.get('otherPreference')?.setValue(''); }
    });

    this.form.get('availability')?.valueChanges.subscribe((v) => {
      this.showOtherAvailability.set(v === 'others');
      if (v !== 'others') { this.form.get('otherAvailability')?.setValue(''); }
    });

    this.form.get('partOfLifegroup')?.valueChanges.subscribe((v) => {
      const ctrl = this.form.get('lifegroupLeaderName');
      const baseValidators = [Validators.maxLength(100), lifegroupLeaderValidator()];
      this.showLifegroupLeader.set(v === 'yes');
      if (v === 'yes') {
        ctrl?.setValidators([...baseValidators, Validators.required]);
      } else {
        ctrl?.setValidators(baseValidators);
        ctrl?.setValue('');
      }
      ctrl?.updateValueAndValidity();
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isSubmitting()) { return; }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const v = this.form.value;
    const payload = {
      firstName: this.sanitizer.sanitizeInput(v.firstName, 'both'),
      lastName: this.sanitizer.sanitizeInput(v.lastName, 'both'),
      mobileNumber: v.mobileNumber,
      birthdate: v.birthdate,
      completeAddress: this.sanitizer.sanitizeInput(v.completeAddress, 'both'),
      lastMedicalExam: v.lastMedicalExam,
      educationalAttainment: this.sanitizer.sanitizeInput(v.educationalAttainment, 'both'),
      trainingExperience: v.trainingExperience ? this.sanitizer.sanitizeInput(v.trainingExperience, 'both') : '',
      skillsHobbies: v.skillsHobbies ? this.sanitizer.sanitizeInput(v.skillsHobbies, 'both') : '',
      classesTraining: v.classesTraining ? this.sanitizer.sanitizeInput(v.classesTraining, 'both') : '',
      volunteerPreference: v.volunteerPreference,
      otherPreference: v.otherPreference ?? '',
      availability: v.availability,
      otherAvailability: v.otherAvailability ?? '',
      partOfLifegroup: v.partOfLifegroup,
      lifegroupLeaderName: v.lifegroupLeaderName ?? '',
      leadingLifegroup: v.leadingLifegroup,
      emergencyContactName: this.sanitizer.sanitizeInput(v.emergencyContactName, 'both'),
      emergencyContactNumber: v.emergencyContactNumber,
      emergencyContactRelationship: this.sanitizer.sanitizeInput(v.emergencyContactRelationship, 'both'),
    };

    const response = await firstValueFrom(this.authService.completeProfile$(payload));

    this.isSubmitting.set(false);

    if (response.success) {
      await this.router.navigate(['/volunteer-dashboard']);
    } else {
      this.submitError.set(response.message ?? 'Profile completion failed. Please try again.');
    }
  }

  hasError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }
}
