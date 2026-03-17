import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { InputSanitizerService } from '../services/input-sanitizer.service';

export function phoneNumberValidator(sanitizer: InputSanitizerService): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    
    if (!value) {
      return { required: 'Phone number is required' };
    }
    
    if (!sanitizer.validatePhoneNumber(value)) {
      return { 
        invalidPhone: 'Invalid Philippine phone number format. Use 09XXXXXXXX or +639XXXXXXXX'
      };
    }
    
    return null;
  };
}

export function nameValidator(sanitizer: InputSanitizerService): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    
    if (!value) {
      return { required: 'Name is required' };
    }
    
    const sanitized = sanitizer.sanitizeText(value);
    
    if (sanitized.length < 2) {
      return { 
        minLength: 'Name must be at least 2 characters long'
      };
    }
    
    if (sanitized.length > 50) {
      return { 
        maxLength: 'Name cannot exceed 50 characters'
      };
    }
    
    if (!sanitizer.validateName(value)) {
      return { 
        invalidName: 'Name contains invalid characters'
      };
    }
    
    return null;
  };
}

/**
 * Validates an email control's value for presence and proper email format.
 *
 * @param sanitizer - Service used to validate the email format
 * @returns `{ required: 'Email is required' }` if the value is empty, `{ invalidEmail: 'Invalid email format' }` if the value fails validation, or `null` if the value is valid
 */
export function emailValidator(sanitizer: InputSanitizerService): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    
    if (!value) {
      return { required: 'Email is required' };
    }
    
    if (!sanitizer.validateEmail(value)) {
      return { 
        invalidEmail: 'Invalid email format'
      };
    }
    
    return null;
  };
}

/**
 * Validates a date control ensuring a value is present and not in the future.
 *
 * @param sanitizer - Service used to sanitize and validate the date (used to detect future dates)
 * @param fieldName - Label used in generated error messages (defaults to `'Date'`)
 * @returns A `ValidationErrors` object with a `required` or `futureDate` message when invalid, or `null` when valid
 */
export function dateValidator(sanitizer: InputSanitizerService, fieldName = 'Date'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    
    if (!value) {
      return { required: `${fieldName} is required` };
    }
    
    if (sanitizer.isFutureDate(value)) {
      return { 
        futureDate: `${fieldName} cannot be in the future`
      };
    }
    
    return null;
  };
}

export function conditionalRequiredValidator(
  conditionControl: AbstractControl, 
  requiredValue: any,
  fieldName: string
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (conditionControl.value === requiredValue && (!control.value || control.value.trim() === '')) {
      return { 
        conditionalRequired: `${fieldName} is required`
      };
    }
    return null;
  };
}

export function addressValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    
    if (!value) {
      return { required: 'Address is required' };
    }
    
    if (value.length < 10) {
      return { 
        minLength: 'Address must be at least 10 characters long'
      };
    }
    
    if (value.length > 255) {
      return { 
        maxLength: 'Address cannot exceed 255 characters'
      };
    }
    
    return null;
  };
}

export function emergencyContactValidator(sanitizer: InputSanitizerService): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    
    if (!value) {
      return { required: 'Emergency contact number is required' };
    }
    
    if (!sanitizer.validatePhoneNumber(value)) {
      return { 
        invalidPhone: 'Invalid emergency contact number format. Use 09XXXXXXXX or +639XXXXXXXX'
      };
    }
    
    return null;
  };
}

export function customAvailabilityValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    
    if (!parent) {
      return null;
    }
    
    const availability = parent.get('availability')?.value;
    const customAvailability = control.value;
    
    if (availability === 'others' && (!customAvailability || customAvailability.trim() === '')) {
      return { 
        required: 'Custom availability description is required when "Others" is selected'
      };
    }
    
    if (customAvailability && customAvailability.length > 100) {
      return { 
        maxLength: 'Custom availability cannot exceed 100 characters'
      };
    }
    
    return null;
  };
}

export function lifegroupLeaderValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    
    if (!parent) {
      return null;
    }
    
    const partOfLifegroup = parent.get('partOfLifegroup')?.value;
    const leaderName = control.value;
    
    if (partOfLifegroup === 'yes' && (!leaderName || leaderName.trim() === '')) {
      return { 
        required: 'Lifegroup leader name is required when you are part of a lifegroup'
      };
    }
    
    if (leaderName && leaderName.length > 100) {
      return { 
        maxLength: 'Lifegroup leader name cannot exceed 100 characters'
      };
    }
    
    return null;
  };
}

export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    
    if (!value) {
      return { required: 'Password is required' };
    }
    
    const errors: string[] = [];
    
    if (value.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(value)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(value)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(value)) {
      errors.push('Password must contain at least one number');
    }
    
    if (errors.length > 0) {
      return { 
        passwordStrength: errors.join('; ')
      };
    }
    
    return null;
  };
}
