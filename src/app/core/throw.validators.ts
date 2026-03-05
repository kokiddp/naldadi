import { DIE_TYPES, type DieType, type ThrowConfig } from './dice.model';

export function sanitizeDieCount(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export function normalizeThrowConfig(config: Partial<ThrowConfig>): ThrowConfig {
  const normalizedEntries = DIE_TYPES.map((dieType) => [
    dieType,
    sanitizeDieCount(config[dieType]),
  ] as const);

  return Object.fromEntries(normalizedEntries) as ThrowConfig;
}

export function getTotalDice(config: ThrowConfig): number {
  return DIE_TYPES.reduce((sum, dieType) => sum + sanitizeDieCount(config[dieType]), 0);
}

export function validateThrowConfig(config: ThrowConfig): string[] {
  const errors: string[] = [];

  for (const dieType of DIE_TYPES) {
    const count = config[dieType];
    if (!Number.isInteger(count) || count < 0) {
      errors.push(`${dieType} count must be a non-negative integer.`);
    }
  }

  if (getTotalDice(config) === 0) {
    errors.push('At least one die must be selected.');
  }

  return errors;
}

export function validateIterations(value: number): string | null {
  if (!Number.isInteger(value) || value < 1) {
    return 'Simulation count must be an integer greater than zero.';
  }

  return null;
}

export function incrementDie(config: ThrowConfig, dieType: DieType): ThrowConfig {
  return {
    ...config,
    [dieType]: sanitizeDieCount(config[dieType]) + 1,
  };
}

export function decrementDie(config: ThrowConfig, dieType: DieType): ThrowConfig {
  return {
    ...config,
    [dieType]: Math.max(0, sanitizeDieCount(config[dieType]) - 1),
  };
}
