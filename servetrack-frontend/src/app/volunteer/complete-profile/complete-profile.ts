import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  Signal,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
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

interface StepConfig {
  readonly id: number;
  readonly label: string;
  readonly fields: ReadonlyArray<string>;
}

const STEP_CONFIGS: ReadonlyArray<StepConfig> = [
  {
    id: 1,
    label: 'Personal',
    fields: [
      'firstName',
      'lastName',
      'mobileNumber',
      'birthdate',
      'completeAddress',
      'lastMedicalExam',
    ],
  },
  {
    id: 2,
    label: 'Education',
    fields: [
      'educationalAttainment',
      'trainingExperience',
      'skillsHobbies',
      'classesTraining',
    ],
  },
  {
    id: 3,
    label: 'Preferences',
    fields: [
      'volunteerPreference',
      'otherPreference',
      'availability',
      'otherAvailability',
      'partOfLifegroup',
      'lifegroupLeaderName',
      'leadingLifegroup',
    ],
  },
  {
    id: 4,
    label: 'Emergency',
    fields: [
      'emergencyContactName',
      'emergencyContactNumber',
      'emergencyContactRelationship',
    ],
  },
];

export const DRAFT_STORAGE_KEY = 'completeProfile.draft';

@Component({
  selector: 'app-complete-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './complete-profile.html',
  styleUrl: './complete-profile.scss',
})
export class ProfileCompleteComponent implements OnInit {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sanitizer = inject(InputSanitizerService);

  readonly steps = STEP_CONFIGS;
  readonly currentStep = signal(1);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly stepError = signal<string | null>(null);
  readonly showOtherPreference = signal(false);
  readonly showOtherAvailability = signal(false);
  readonly showLifegroupLeader = signal(false);
  readonly completedSteps = signal<ReadonlySet<number>>(new Set());

  readonly currentUser = this.authService.currentUser;
  readonly displayName = computed(() => this.currentUser()?.name ?? '');
  readonly displayEmail = computed(() => this.currentUser()?.email ?? '');
  readonly isGoogleUser = computed(() => this.currentUser()?.provider === 'google');

  readonly totalSteps = this.steps.length;
  readonly progressPercent = computed(() =>
    Math.round(((this.currentStep() - 1) / (this.totalSteps - 1)) * 100),
  );
  readonly isFirstStep = computed(() => this.currentStep() === 1);
  readonly isLastStep = computed(() => this.currentStep() === this.totalSteps);
  readonly currentStepConfig: Signal<StepConfig> = computed(
    () => this.steps[this.currentStep() - 1] ?? this.steps[0]!,
  );

  readonly stepHeading = viewChild<ElementRef<HTMLHeadingElement>>('stepHeading');

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

  constructor() {
    let prevStep = 0;
    effect(() => {
      const step = this.currentStep();
      if (step === prevStep) { return; }
      prevStep = step;
      queueMicrotask(() => {
        this.stepHeading()?.nativeElement.focus();
      });
    });
  }

  ngOnInit(): void {
    const user = this.currentUser();
    if (user && !this.isGoogleUser()) {
      const volunteer = user.volunteer_profile;
      const nameParts = user.name?.split(' ') ?? [];
      this.form.patchValue({
        firstName: nameParts[0] ?? '',
        lastName: nameParts.slice(1).join(' ') ?? '',
        mobileNumber: volunteer?.mobile_number ?? '',
      });
      for (const field of ['firstName', 'lastName', 'mobileNumber']) {
        const ctrl = this.form.get(field);
        ctrl?.clearValidators();
        ctrl?.updateValueAndValidity();
      }
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

    this.restoreDraft();

    this.form.valueChanges.subscribe(() => {
      this.persistDraft();
    });
  }

  nextStep(): void {
    if (!this.validateCurrentStep()) { return; }
    this.stepError.set(null);
    this.completedSteps.update((set) => new Set([...set, this.currentStep()]));
    if (this.isLastStep()) { return; }
    this.currentStep.update((s) => s + 1);
  }

  prevStep(): void {
    this.stepError.set(null);
    if (this.isFirstStep()) { return; }
    this.currentStep.update((s) => s - 1);
  }

  goToStep(step: number): void {
    if (step === this.currentStep()) { return; }
    if (step > this.currentStep() && !this.completedSteps().has(step - 1)
        && step - 1 !== this.currentStep() - 1) { return; }
    if (step < this.currentStep() || this.completedSteps().has(step)) {
      this.currentStep.set(step);
    }
  }

  validateCurrentStep(): boolean {
    const config = this.currentStepConfig();
    let valid = true;
    for (const field of config.fields) {
      const ctrl = this.form.get(field);
      if (!ctrl) { continue; }
      ctrl.markAsTouched();
      ctrl.updateValueAndValidity({ onlySelf: true });
      if (ctrl.invalid) { valid = false; }
    }
    if (!valid) {
      this.stepError.set('Please fix the highlighted fields before continuing.');
    }
    return valid;
  }

  hasError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  isFieldInCurrentStep(field: string): boolean {
    return this.currentStepConfig().fields.includes(field);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.stepError.set('Some required fields are missing. Please review each step.');
      return;
    }
    if (this.isSubmitting()) { return; }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.stepError.set(null);

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

    try {
      const response = await firstValueFrom(this.authService.completeProfile$(payload));
      if (response.success) {
        this.clearDraft();
        await this.router.navigate(['/volunteer-dashboard']);
      } else {
        this.submitError.set(response.message ?? 'Profile completion failed. Please try again.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile completion failed. Please try again.';
      this.submitError.set(message);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private persistDraft(): void {
    if (typeof sessionStorage === 'undefined') { return; }
    try {
      const draft = {
        step: this.currentStep(),
        values: this.form.value,
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // storage may be unavailable; fail silently
    }
  }

  private restoreDraft(): void {
    if (typeof sessionStorage === 'undefined') { return; }
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) { return; }
      const parsed = JSON.parse(raw) as { step?: number; values?: Record<string, unknown> };
      if (parsed.values && typeof parsed.values === 'object') {
        this.form.patchValue(parsed.values);
      }
      if (parsed.step && parsed.step >= 1 && parsed.step <= this.totalSteps) {
        this.currentStep.set(parsed.step);
        const completed = new Set<number>();
        for (let i = 1; i < parsed.step; i++) { completed.add(i); }
        this.completedSteps.set(completed);
      }
    } catch {
      // corrupt draft; ignore
    }
  }

  private clearDraft(): void {
    if (typeof sessionStorage === 'undefined') { return; }
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
