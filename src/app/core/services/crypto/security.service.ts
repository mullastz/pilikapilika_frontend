import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  private readonly ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u'];
  private readonly MAX_MESSAGE_LENGTH = 2000;

  validateInput(input: string): { valid: boolean; error?: string } {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Invalid input' };
    }

    if (input.length > this.MAX_MESSAGE_LENGTH) {
      return { valid: false, error: 'Message too long' };
    }

    // Check for potential XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(input)) {
        return { valid: false, error: 'Invalid content detected' };
      }
    }

    return { valid: true };
  }

  sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, this.MAX_MESSAGE_LENGTH);
  }

  sanitizeForDisplay(input: string): string {
    if (!input) return '';

    // Basic HTML escaping
    const escaped = input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // Simple line break support
    return escaped.replace(/\n/g, '<br>');
  }

  generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  rateLimitCheck(lastAction: number, cooldownMs: number = 1000): boolean {
    return Date.now() - lastAction >= cooldownMs;
  }
}
