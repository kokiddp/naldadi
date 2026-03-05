import { describe, expect, it } from 'vitest';

import { createEmptyThrowConfig } from './dice.model';
import {
  decrementDie,
  getTotalDice,
  incrementDie,
  normalizeThrowConfig,
  sanitizeDieCount,
  validateIterations,
  validateThrowConfig,
} from './throw.validators';

describe('throw.validators', () => {
  it('sanitizeDieCount normalizes invalid numbers to zero', () => {
    expect(sanitizeDieCount(NaN)).toBe(0);
    expect(sanitizeDieCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitizeDieCount('4')).toBe(0);
    expect(sanitizeDieCount(-2.8)).toBe(0);
  });

  it('normalizeThrowConfig sanitizes and fills missing dice', () => {
    const normalized = normalizeThrowConfig({ d6: 3.9, d8: -1, d20: 2 });

    expect(normalized.d6).toBe(3);
    expect(normalized.d8).toBe(0);
    expect(normalized.d20).toBe(2);
    expect(normalized.d4).toBe(0);
    expect(normalized.d10).toBe(0);
    expect(normalized.d12).toBe(0);
  });

  it('validateThrowConfig reports invalid counts and empty selection', () => {
    const config = createEmptyThrowConfig();
    const errors = validateThrowConfig(config);

    expect(errors).toContainEqual({ key: 'noDiceSelected' });

    const badConfig = {
      ...createEmptyThrowConfig(),
      d6: -1,
    };

    expect(validateThrowConfig(badConfig)).toContainEqual({
      key: 'invalidDieCount',
      dieType: 'd6',
    });
  });

  it('incrementDie/decrementDie and total dice behave consistently', () => {
    const config = createEmptyThrowConfig();
    const plusOne = incrementDie(config, 'd10');
    const backToZero = decrementDie(plusOne, 'd10');

    expect(plusOne.d10).toBe(1);
    expect(backToZero.d10).toBe(0);
    expect(getTotalDice(backToZero)).toBe(0);
  });

  it('validateIterations requires positive integers', () => {
    expect(validateIterations(0)).toBe('invalidIterations');
    expect(validateIterations(10.5)).toBe('invalidIterations');
    expect(validateIterations(1)).toBeNull();
  });
});
