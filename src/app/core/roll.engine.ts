import { DIE_TYPES, getDieSides, type DieType, type ThrowConfig } from './dice.model';
import { normalizeThrowConfig } from './throw.validators';

export interface ThrowRollResult {
  readonly config: ThrowConfig;
  readonly rollsByType: Record<DieType, number[]>;
  readonly total: number;
}

function rollDie(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollThrow(config: ThrowConfig, rng: () => number = Math.random): ThrowRollResult {
  const normalizedConfig = normalizeThrowConfig(config);

  const rollsByType = {
    d4: [],
    d6: [],
    d8: [],
    d10: [],
    d12: [],
    d20: [],
  } as Record<DieType, number[]>;

  let total = 0;

  for (const dieType of DIE_TYPES) {
    const sides = getDieSides(dieType);
    const count = normalizedConfig[dieType];

    for (let index = 0; index < count; index += 1) {
      const value = rollDie(sides, rng);
      rollsByType[dieType].push(value);
      total += value;
    }
  }

  return {
    config: normalizedConfig,
    rollsByType,
    total,
  };
}
