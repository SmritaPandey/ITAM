import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Sanitization pipe — strips XSS vectors from string inputs.
 * Applied globally to sanitize all incoming request data.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (typeof value === 'string') {
      return this.sanitize(value);
    }
    if (typeof value === 'object' && value !== null) {
      return this.sanitizeObject(value);
    }
    return value;
  }

  private sanitize(str: string): string {
    // HTML-escaping a URL corrupts it (e.g. "/" → "&#x2F;"), breaking webhook
    // URLs, SSO endpoints, etc. Valid http(s) URLs are stored verbatim; output
    // encoding is the renderer's responsibility.
    if (/^https?:\/\/\S+$/i.test(str)) {
      try {
        const url = new URL(str);
        if (url.protocol === 'http:' || url.protocol === 'https:') return str;
      } catch {
        // not a parseable URL — fall through to escaping
      }
    }
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  }

  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => {
        if (typeof item === 'string') return this.sanitize(item);
        if (typeof item === 'object' && item !== null) return this.sanitizeObject(item);
        return item;
      });
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitize(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
