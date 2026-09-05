import { describe, expect, it } from 'vitest';

import { parseTimestamp } from './time';

describe('parseTimestamp', () => {
  it('should parse MM:SS correctly', () => {
    expect(parseTimestamp('1:30')).toBe(90);
    expect(parseTimestamp('01:30')).toBe(90);
    expect(parseTimestamp('15:00')).toBe(900);
  });

  it('should parse HH:MM:SS correctly', () => {
    expect(parseTimestamp('1:01:30')).toBe(3690);
    expect(parseTimestamp('01:01:30')).toBe(3690);
    expect(parseTimestamp('2:00:00')).toBe(7200);
  });

  it('should return 0 for invalid formats', () => {
    expect(parseTimestamp('invalid')).toBe(0);
    expect(parseTimestamp('1')).toBe(0);
    expect(parseTimestamp('1:xx')).toBe(0);
    expect(parseTimestamp('1:2:3:4')).toBe(0);
    expect(parseTimestamp('1:60')).toBe(0);
    expect(parseTimestamp('1:60:00')).toBe(0);
  });
});
