import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Custom validator for password strength
 * Requires:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - No common patterns (e.g. "password", "123456")
 * - No 3+ repeated consecutive characters (e.g. "aaa")
 */
export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) {
      return null; // Let 'required' validator handle empty values
    }

    const errors: ValidationErrors = {};

    if (value.length < 12) {
      errors['minLength'] = { requiredLength: 12, actualLength: value.length };
    }

    if (value.length > 128) {
      errors['maxLength'] = { maxLength: 128, actualLength: value.length };
    }

    if (!/[A-Z]/.test(value)) {
      errors['requiresUppercase'] = true;
    }

    if (!/[a-z]/.test(value)) {
      errors['requiresLowercase'] = true;
    }

    if (!/[0-9]/.test(value)) {
      errors['requiresNumber'] = true;
    }

    if (!/[^A-Za-z0-9]/.test(value)) {
      errors['requiresSpecialChar'] = true;
    }

    // Check for common patterns
    if (/^(password|123456|qwerty|admin)/i.test(value)) {
      errors['commonPattern'] = true;
    }

    // Check for 3+ repeated consecutive characters
    if (/(.)\1{2,}/.test(value)) {
      errors['repeatedChars'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

/**
 * Custom validator to check if password and confirm password match
 */
export function passwordMatchValidator(
  passwordField = 'password',
  confirmPasswordField = 'confirmPassword',
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get(passwordField);
    const confirmPassword = control.get(confirmPasswordField);

    if (!password || !confirmPassword) {
      return null;
    }

    if (password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ ...confirmPassword.errors, passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      // Remove passwordMismatch error if passwords now match
      if (confirmPassword.hasError('passwordMismatch')) {
        const errors = { ...confirmPassword.errors };
        delete errors['passwordMismatch'];
        confirmPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }

    return null;
  };
}
