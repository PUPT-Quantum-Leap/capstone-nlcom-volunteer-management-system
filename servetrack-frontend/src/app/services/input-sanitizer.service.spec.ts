import 'zone.js';
import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { InputSanitizerService } from './input-sanitizer.service';
import { DomSanitizer } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import { vi } from 'vitest';

// Initialize testing environment
try {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch (e) {
  // Already initialized
}

describe('InputSanitizerService', () => {
  let service: InputSanitizerService;
  let sanitizerSpy: any;

  beforeEach(() => {
    sanitizerSpy = {
      sanitize: vi.fn((context: SecurityContext, value: string) => {
        if (!value) return '';
        return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }),
    };

    TestBed.configureTestingModule({
      providers: [InputSanitizerService, { provide: DomSanitizer, useValue: sanitizerSpy }],
    });
    service = TestBed.inject(InputSanitizerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('sanitizeText', () => {
    it('should handle empty input', () => {
      expect(service.sanitizeText('')).toBe('');
      expect(service.sanitizeText(null as any)).toBe('');
      expect(service.sanitizeText(undefined as any)).toBe('');
    });

    it('should trim whitespace', () => {
      expect(service.sanitizeText('  hello  ')).toBe('hello');
    });

    it('should delegate to DomSanitizer for HTML context', () => {
      service.sanitizeText('hello <script>alert(1)</script>');
      expect(sanitizerSpy.sanitize).toHaveBeenCalledWith(
        SecurityContext.HTML,
        'hello <script>alert(1)</script>',
      );
    });

    it('should strip out any remaining HTML tags', () => {
      sanitizerSpy.sanitize.mockReturnValueOnce('hello <b>world</b>');
      expect(service.sanitizeText('hello <b>world</b>')).toBe('hello world');
    });

    it('should properly sanitize and strip tags combined', () => {
      sanitizerSpy.sanitize.mockReturnValueOnce('hello ');
      expect(service.sanitizeText('hello <script>alert(1)</script>')).toBe('hello ');
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize both text and SQL contexts', () => {
      const result = service.sanitizeInput('  hello <b>world</b>  ', 'both');
      expect(result).toBe('hello world');
    });
  });

  describe('validateName', () => {
    it('should return true for valid names', () => {
      sanitizerSpy.sanitize.mockReturnValueOnce('John Doe');
      expect(service.validateName('John Doe')).toBe(true);
    });

    it('should return false for empty names', () => {
      sanitizerSpy.sanitize.mockReturnValueOnce('');
      expect(service.validateName('')).toBe(false);
    });
  });
});
