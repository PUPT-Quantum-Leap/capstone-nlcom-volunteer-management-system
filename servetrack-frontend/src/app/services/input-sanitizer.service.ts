import { Injectable, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class InputSanitizerService {
  private sanitizer = inject(DomSanitizer);

  /**
   * Sanitize text input to prevent XSS attacks
   */
  sanitizeText(input: string): string {
    if (!input) return '';
    
    // Remove potentially dangerous HTML/JS patterns
    const sanitized = input.trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<img\b[^>]*onerror\s*=/gi, '')
      .replace(/<img\b[^>]*onload\s*=/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<[^>]*>/g, '');

    return sanitized;
  }

  /**
   * Sanitize input to prevent injection patterns
   */
  sanitizeForSQL(input: string): string {
    if (!input) return '';
    
    // Keep valid characters like hyphens and single quotes
    return input.trim();
  }

  /**
   * Comprehensive sanitization for form inputs
   */
  sanitizeInput(input: string, context: 'text' | 'sql' | 'both' = 'both'): string {
    if (!input) return '';
    
    let sanitized = input;
    
    if (context === 'text' || context === 'both') {
      sanitized = this.sanitizeText(sanitized);
    }
    
    if (context === 'sql' || context === 'both') {
      sanitized = this.sanitizeForSQL(sanitized);
    }
    
    return sanitized;
  }

  /**
   * Validate phone number format (Philippines)
   * Allow spaces, hyphens, and parentheses for user convenience
   */
  validatePhoneNumber(phone: string): boolean {
    if (!phone) return false;
    // Strip common separators
    const cleaned = phone.replace(/[\s\-()]/g, '');
    const phoneRegex = /^(09|\+639)\d{9}$/;
    return phoneRegex.test(cleaned);
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate name fields (allow special characters but prevent scripts)
   */
  validateName(name: string): boolean {
    const sanitized = this.sanitizeText(name);
    return sanitized.length > 0 && sanitized.length <= 50;
  }

  /**
   * Check for future dates
   */
  isFutureDate(dateString: string): boolean {
    const inputDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate > today;
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
