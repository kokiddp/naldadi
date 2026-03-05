import { DIE_TYPES, getDieSides, type ThrowConfig } from './dice.model';
import { normalizeThrowConfig } from './throw.validators';

export interface DistributionPoint {
  readonly total: number;
  readonly frequency: number;
  readonly probability: number;
  readonly cumulativeProbability: number;
}

export interface SimulationStats {
  readonly iterations: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly stdDev: number;
}

export interface SimulationResult {
  readonly stats: SimulationStats;
  readonly distribution: DistributionPoint[];
}

function getMedianFromDistribution(histogram: Map<number, number>, iterations: number): number {
  const sortedTotals = [...histogram.entries()].sort((a, b) => a[0] - b[0]);
  const lowerTarget = Math.floor((iterations + 1) / 2);
  const upperTarget = Math.floor((iterations + 2) / 2);

  let running = 0;
  let lowerValue = 0;
  let upperValue = 0;

  for (const [total, frequency] of sortedTotals) {
    const start = running + 1;
    const end = running + frequency;

    if (lowerValue === 0 && lowerTarget >= start && lowerTarget <= end) {
      lowerValue = total;
    }

    if (upperValue === 0 && upperTarget >= start && upperTarget <= end) {
      upperValue = total;
      break;
    }

    running = end;
  }

  return (lowerValue + upperValue) / 2;
}

export function runSimulation(
  config: ThrowConfig,
  iterations: number,
  rng: () => number = Math.random,
): SimulationResult {
  const normalizedConfig = normalizeThrowConfig(config);
  const diceSidesPool: number[] = [];

  for (const dieType of DIE_TYPES) {
    const sides = getDieSides(dieType);
    const count = normalizedConfig[dieType];

    for (let index = 0; index < count; index += 1) {
      diceSidesPool.push(sides);
    }
  }

  const histogram = new Map<number, number>();
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let sumSquares = 0;

  for (let simulationIndex = 0; simulationIndex < iterations; simulationIndex += 1) {
    let total = 0;

    for (const sides of diceSidesPool) {
      total += Math.floor(rng() * sides) + 1;
    }

    histogram.set(total, (histogram.get(total) ?? 0) + 1);
    min = Math.min(min, total);
    max = Math.max(max, total);
    sum += total;
    sumSquares += total * total;
  }

  const mean = sum / iterations;
  const variance = Math.max(0, sumSquares / iterations - mean * mean);
  const stdDev = Math.sqrt(variance);

  const distributionEntries = [...histogram.entries()].sort((a, b) => a[0] - b[0]);
  let runningFrequency = 0;

  const distribution: DistributionPoint[] = distributionEntries.map(([total, frequency]) => {
    runningFrequency += frequency;
    return {
      total,
      frequency,
      probability: frequency / iterations,
      cumulativeProbability: runningFrequency / iterations,
    };
  });

  return {
    stats: {
      iterations,
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
      mean,
      median: getMedianFromDistribution(histogram, iterations),
      stdDev,
    },
    distribution,
  };
}
