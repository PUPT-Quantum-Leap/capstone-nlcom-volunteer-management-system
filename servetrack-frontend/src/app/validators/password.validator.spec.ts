import '@angular/compiler';
import { FormControl, FormGroup } from '@angular/forms';
import { passwordMatchValidator, passwordStrengthValidator } from './password.validator';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Password Validators', () => {
  describe('passwordStrengthValidator', () => {
    const validator = passwordStrengthValidator();

    it('should return null for empty values', () => {
      const control = new FormControl('');
      expect(validator(control)).toBeNull();

      const nullControl = new FormControl(null);
      expect(validator(nullControl)).toBeNull();

      const undefinedControl = new FormControl(undefined);
      expect(validator(undefinedControl)).toBeNull();
    });

    it('should return minLength error for passwords shorter than 12 characters', () => {
      const control = new FormControl('Short1!');
      const result = validator(control);
      expect(result).toBeTruthy();
      expect(result?.['minLength']).toEqual({ requiredLength: 12, actualLength: 7 });
    });

    it('should return maxLength error for passwords longer than 128 characters', () => {
      const longString = 'A'.repeat(129) + 'b1!';
      const control = new FormControl(longString);
      const result = validator(control);
      expect(result).toBeTruthy();
      expect(result?.['maxLength']).toEqual({ maxLength: 128, actualLength: 132 });
    });

    it('should return requiresUppercase error for passwords without uppercase letters', () => {
      const control = new FormControl('nouppercase1!');
      const result = validator(control);
      expect(result).toBeTruthy();
      expect(result?.['requiresUppercase']).toBe(true);
    });

    it('should return requiresLowercase error for passwords without lowercase letters', () => {
      const control = new FormControl('NOLOWERCASE1!');
      const result = validator(control);
      expect(result).toBeTruthy();
      expect(result?.['requiresLowercase']).toBe(true);
    });

    it('should return requiresNumber error for passwords without numbers', () => {
      const control = new FormControl('NoNumbersHere!');
      const result = validator(control);
      expect(result).toBeTruthy();
      expect(result?.['requiresNumber']).toBe(true);
    });

    it('should return requiresSpecialChar error for passwords without special characters', () => {
      const control = new FormControl('NoSpecialChar1');
      const result = validator(control);
      expect(result).toBeTruthy();
      expect(result?.['requiresSpecialChar']).toBe(true);
    });

    it('should return commonPattern error for passwords containing common patterns', () => {
      const patterns = ['password', '123456', 'qwerty', 'admin'];
      patterns.forEach(pattern => {
        const control = new FormControl(`${pattern}A1!validLength`);
        const result = validator(control);
        expect(result).toBeTruthy();
        expect(result?.['commonPattern']).toBe(true);
      });

      // Should also catch uppercase/mixed case patterns
      const control = new FormControl('PaSsWoRd!1234');
      const result = validator(control);
      expect(result).toBeTruthy();
      expect(result?.['commonPattern']).toBe(true);
    });

    it('should return repeatedChars error for passwords with 3+ repeated consecutive characters', () => {
      const control = new FormControl('StrongPasssss1!');
      const result = validator(control);
      expect(result).toBeTruthy();
      expect(result?.['repeatedChars']).toBe(true);
    });

    it('should return multiple errors if multiple conditions fail', () => {
      const control = new FormControl('short');
      const result = validator(control);
      expect(result).toBeTruthy();
      expect(result?.['minLength']).toBeDefined();
      expect(result?.['requiresUppercase']).toBeDefined();
      expect(result?.['requiresNumber']).toBeDefined();
      expect(result?.['requiresSpecialChar']).toBeDefined();
    });

    it('should return null for valid strong passwords', () => {
      const control = new FormControl('Str0ngP@ssw0rd!');
      expect(validator(control)).toBeNull();
    });
  });

  describe('passwordMatchValidator', () => {
    let formGroup: FormGroup;
    const validator = passwordMatchValidator();

    beforeEach(() => {
      formGroup = new FormGroup({
        password: new FormControl(''),
        confirmPassword: new FormControl('')
      });
    });

    it('should return null if either control is missing', () => {
      const singleControlGroup = new FormGroup({
        password: new FormControl('Test1!')
      });
      expect(validator(singleControlGroup)).toBeNull();
    });

    it('should return passwordMismatch error if passwords do not match', () => {
      formGroup.get('password')?.setValue('Password123!');
      formGroup.get('confirmPassword')?.setValue('Different123!');

      const result = validator(formGroup);
      expect(result).toEqual({ passwordMismatch: true });

      // Should also set the error on the confirmPassword control
      expect(formGroup.get('confirmPassword')?.errors).toEqual({ passwordMismatch: true });
    });

    it('should return null and remove passwordMismatch error if passwords match', () => {
      // First make them mismatch
      formGroup.get('password')?.setValue('Password123!');
      formGroup.get('confirmPassword')?.setValue('Different123!');
      validator(formGroup);
      expect(formGroup.get('confirmPassword')?.hasError('passwordMismatch')).toBe(true);

      // Then make them match
      formGroup.get('confirmPassword')?.setValue('Password123!');
      const result = validator(formGroup);

      expect(result).toBeNull();
      // Error should be removed from confirmPassword control
      expect(formGroup.get('confirmPassword')?.hasError('passwordMismatch')).toBe(false);
    });

    it('should work with custom field names', () => {
      const customValidator = passwordMatchValidator('newPass', 'confirmNewPass');
      const customFormGroup = new FormGroup({
        newPass: new FormControl('Password123!'),
        confirmNewPass: new FormControl('Different123!')
      });

      const result = customValidator(customFormGroup);
      expect(result).toEqual({ passwordMismatch: true });
      expect(customFormGroup.get('confirmNewPass')?.errors).toEqual({ passwordMismatch: true });
    });
  });
});
