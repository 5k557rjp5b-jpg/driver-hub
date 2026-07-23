import { describe, expect, it } from 'vitest';

import { isValidEmail } from './email';

describe('isValidEmail', () => {
  it('accepts multi-part UK TLDs and longer TLDs', () => {
    expect(isValidEmail('driver@example.co.uk')).toBe(true);
    expect(isValidEmail('driver@example.org.uk')).toBe(true);
    expect(isValidEmail('driver@agency.gov.uk')).toBe(true);
    expect(isValidEmail('driver@something.email')).toBe(true);
    expect(isValidEmail('driver@example.com')).toBe(true);
  });

  it('rejects empty and clearly invalid values', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing-domain@')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});
