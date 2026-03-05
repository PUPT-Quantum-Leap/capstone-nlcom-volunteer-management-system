import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { passwordMatchValidator, passwordStrengthValidator } from './password.validator';

describe('PasswordValidators', () => {
  describe('passwordStrengthValidator', () => {
    const validator = passwordStrengthValidator();

    it('should return null for empty values', () => {
      const control = new FormControl('');
      expect(validator(control)).toBeNull();
    });

    it('should return null for valid passwords', () => {
      const control = new FormControl('Valid1!pass12');
      expect(validator(control)).toBeNull();
    });

    it('should return minLength error if password is less than 12 characters', () => {
      const control = new FormControl('Val1!');
      const result = validator(control);
      expect(result).toEqual({ minLength: { requiredLength: 12, actualLength: 5 } });
    });

    it('should return requiresUppercase error if password has no uppercase letter', () => {
      const control = new FormControl('valid1!pass');
      const result = validator(control);
      expect(result).toHaveProperty('requiresUppercase');
    });

    it('should return requiresLowercase error if password has no lowercase letter', () => {
      const control = new FormControl('VALID1!PASS');
      const result = validator(control);
      expect(result).toHaveProperty('requiresLowercase');
    });

    it('should return requiresNumber error if password has no number', () => {
      const control = new FormControl('Valid!pass');
      const result = validator(control);
      expect(result).toHaveProperty('requiresNumber');
    });

    it('should return requiresSpecialChar error if password has no special character', () => {
      const control = new FormControl('Valid1pass');
      const result = validator(control);
      expect(result).toHaveProperty('requiresSpecialChar');
    });

    it('should return multiple errors if multiple requirements are missing', () => {
      const control = new FormControl('val');
      const result = validator(control);
      expect(result).toHaveProperty('minLength');
      expect(result).toHaveProperty('requiresUppercase');
      expect(result).toHaveProperty('requiresNumber');
      expect(result).toHaveProperty('requiresSpecialChar');
    });
  });

  describe('passwordMatchValidator', () => {
    it('should return null if passwords match', () => {
      const group = new FormGroup({
        password: new FormControl('Password123!'),
        confirmPassword: new FormControl('Password123!'),
      });
      const validator = passwordMatchValidator('password', 'confirmPassword');
      expect(validator(group)).toBeNull();
      expect(group.get('confirmPassword')?.hasError('passwordMismatch')).toBe(false);
    });

    it('should return passwordMismatch error if passwords do not match', () => {
      const group = new FormGroup({
        password: new FormControl('Password123!'),
        confirmPassword: new FormControl('Different123!'),
      });
      const validator = passwordMatchValidator('password', 'confirmPassword');
      const result = validator(group);
      expect(result).toEqual({ passwordMismatch: true });
      expect(group.get('confirmPassword')?.hasError('passwordMismatch')).toBe(true);
    });

    it('should return null if one of the controls is missing', () => {
      const group = new FormGroup({
        password: new FormControl('Password123!'),
      });
      const validator = passwordMatchValidator('password', 'confirmPassword');
      expect(validator(group)).toBeNull();
    });

    it('should clear passwordMismatch error when passwords become matching', () => {
      const group = new FormGroup({
        password: new FormControl('Password123!'),
        confirmPassword: new FormControl('Different123!'),
      });
      const validator = passwordMatchValidator('password', 'confirmPassword');

      // First run - they don't match
      validator(group);
      expect(group.get('confirmPassword')?.hasError('passwordMismatch')).toBe(true);

      // Change confirmPassword to match
      group.get('confirmPassword')?.setValue('Password123!');
      validator(group);

      expect(group.get('confirmPassword')?.hasError('passwordMismatch')).toBe(false);
    });
  });
});
