import { describe, it, expect } from 'vitest';
import { generateConfirmationNo, calculateNights } from '../../src/utils/booking';

describe('generateConfirmationNo', () => {
  it('should start with RP-', () => {
    expect(generateConfirmationNo()).toMatch(/^RP-/);
  });

  it('should be unique on each call', () => {
    const a = generateConfirmationNo();
    const b = generateConfirmationNo();
    expect(a).not.toBe(b);
  });

  it('should have correct format RP-XXXX-XXXXXXXX', () => {
    expect(generateConfirmationNo()).toMatch(/^RP-[A-Z0-9]{4}-[A-Z0-9]{8}$/);
  });
});

describe('calculateNights', () => {
  it('should calculate nights correctly', () => {
    const checkIn = new Date('2024-01-01');
    const checkOut = new Date('2024-01-05');
    expect(calculateNights(checkIn, checkOut)).toBe(4);
  });

  it('should handle same day check-in/out as 1 night', () => {
    const checkIn = new Date('2024-01-01T14:00:00');
    const checkOut = new Date('2024-01-02T11:00:00');
    expect(calculateNights(checkIn, checkOut)).toBe(1);
  });

  it('should return 1 for single night stay', () => {
    const checkIn = new Date('2024-06-15');
    const checkOut = new Date('2024-06-16');
    expect(calculateNights(checkIn, checkOut)).toBe(1);
  });
});
