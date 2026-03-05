export const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const;

export type DieType = (typeof DIE_TYPES)[number];

export type ThrowConfig = Record<DieType, number>;

export const DEFAULT_THROW_CONFIG: ThrowConfig = {
  d4: 0,
  d6: 0,
  d8: 0,
  d10: 0,
  d12: 0,
  d20: 0,
};

export function createEmptyThrowConfig(): ThrowConfig {
  return { ...DEFAULT_THROW_CONFIG };
}

export function getDieSides(dieType: DieType): number {
  return Number.parseInt(dieType.slice(1), 10);
}
