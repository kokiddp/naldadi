import { describe, expect, it } from 'vitest';

import { createEmptyThrowConfig } from './dice.model';
import {
  runSimulation,
  runSimulationProgressive,
  SimulationCancelledError,
} from './simulation.engine';

function createCyclicRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}

describe('simulation.engine', () => {
  it('keeps totals in inclusive min/max bounds', () => {
    const config = {
      ...createEmptyThrowConfig(),
      d4: 1,
      d6: 1,
    };

    const result = runSimulation(config, 2000);

    expect(result.stats.min).toBeGreaterThanOrEqual(2);
    expect(result.stats.max).toBeLessThanOrEqual(10);
    expect(result.stats.range).toBe(result.stats.max - result.stats.min);
  });

  it('produces deterministic stats with deterministic rng stream', () => {
    const config = {
      ...createEmptyThrowConfig(),
      d6: 1,
    };

    const rng = createCyclicRng([0 / 6, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]);
    const result = runSimulation(config, 600, rng);

    expect(result.stats.min).toBe(1);
    expect(result.stats.max).toBe(6);
    expect(result.stats.mean).toBeCloseTo(3.5, 10);
    expect(result.stats.median).toBeCloseTo(3.5, 10);
    expect(result.stats.theoreticalMean).toBeCloseTo(3.5, 10);
    expect(result.distribution).toHaveLength(6);
    expect(result.distribution.every((point) => point.frequency === 100)).toBe(true);
  });

  it('tracks all-dice-equal exact match class', () => {
    const config = {
      ...createEmptyThrowConfig(),
      d6: 2,
    };

    const rng = () => 0;
    const iterations = 120;
    const result = runSimulation(config, iterations, rng);
    const doubles = result.stats.exactMatchCounts.find((entry) => entry.matchSize === 2);

    expect(doubles).toBeDefined();
    expect(doubles?.count).toBe(iterations);
    expect(doubles?.probability).toBe(1);
  });

  it('progressive simulation supports cancellation', async () => {
    const config = {
      ...createEmptyThrowConfig(),
      d6: 2,
    };

    await expect(
      runSimulationProgressive(config, 1000, {
        shouldCancel: () => true,
      }),
    ).rejects.toBeInstanceOf(SimulationCancelledError);
  });
});
