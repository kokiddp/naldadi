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

export interface SimulationProgress {
  readonly completedIterations: number;
  readonly totalIterations: number;
  readonly progressPercent: number;
}

export interface ProgressiveSimulationOptions {
  readonly rng?: () => number;
  readonly chunkSize?: number;
  readonly onProgress?: (progress: SimulationProgress) => void;
  readonly yieldToMainThread?: () => Promise<void>;
  readonly shouldCancel?: () => boolean;
}

export class SimulationCancelledError extends Error {
  constructor() {
    super('Simulation cancelled by user.');
    this.name = 'SimulationCancelledError';
  }
}

interface SimulationAccumulator {
  readonly histogram: Map<number, number>;
  min: number;
  max: number;
  sum: number;
  sumSquares: number;
}

interface DiceGroup {
  readonly sides: number;
  readonly count: number;
}

function createDiceGroups(config: ThrowConfig): DiceGroup[] {
  const normalizedConfig = normalizeThrowConfig(config);
  const groups: DiceGroup[] = [];

  for (const dieType of DIE_TYPES) {
    const sides = getDieSides(dieType);
    const count = normalizedConfig[dieType];

    if (count > 0) {
      groups.push({ sides, count });
    }
  }

  return groups;
}

function createAccumulator(): SimulationAccumulator {
  return {
    histogram: new Map<number, number>(),
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    sum: 0,
    sumSquares: 0,
  };
}

function runIterationBatch(
  accumulator: SimulationAccumulator,
  diceGroups: DiceGroup[],
  batchIterations: number,
  rng: () => number,
): void {
  for (let simulationIndex = 0; simulationIndex < batchIterations; simulationIndex += 1) {
    let total = 0;

    for (const group of diceGroups) {
      for (let dieIndex = 0; dieIndex < group.count; dieIndex += 1) {
        total += Math.floor(rng() * group.sides) + 1;
      }
    }

    accumulator.histogram.set(total, (accumulator.histogram.get(total) ?? 0) + 1);
    accumulator.min = Math.min(accumulator.min, total);
    accumulator.max = Math.max(accumulator.max, total);
    accumulator.sum += total;
    accumulator.sumSquares += total * total;
  }
}

function buildSimulationResult(accumulator: SimulationAccumulator, iterations: number): SimulationResult {
  const mean = accumulator.sum / iterations;
  const variance = Math.max(0, accumulator.sumSquares / iterations - mean * mean);
  const stdDev = Math.sqrt(variance);

  const distributionEntries = [...accumulator.histogram.entries()].sort((a, b) => a[0] - b[0]);
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
      min: Number.isFinite(accumulator.min) ? accumulator.min : 0,
      max: Number.isFinite(accumulator.max) ? accumulator.max : 0,
      mean,
      median: getMedianFromDistribution(accumulator.histogram, iterations),
      stdDev,
    },
    distribution,
  };
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
  const diceGroups = createDiceGroups(config);
  const accumulator = createAccumulator();

  runIterationBatch(accumulator, diceGroups, iterations, rng);

  return buildSimulationResult(accumulator, iterations);
}

export async function runSimulationProgressive(
  config: ThrowConfig,
  iterations: number,
  options: ProgressiveSimulationOptions = {},
): Promise<SimulationResult> {
  const rng = options.rng ?? Math.random;
  const chunkSize = Math.max(1, Math.trunc(options.chunkSize ?? 25000));
  const onProgress = options.onProgress;
  const shouldCancel = options.shouldCancel;
  const yieldToMainThread = options.yieldToMainThread ?? (() => new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  }));

  const diceGroups = createDiceGroups(config);
  const accumulator = createAccumulator();

  let completedIterations = 0;
  onProgress?.({ completedIterations: 0, totalIterations: iterations, progressPercent: 0 });

  while (completedIterations < iterations) {
    if (shouldCancel?.()) {
      throw new SimulationCancelledError();
    }

    const remaining = iterations - completedIterations;
    const currentBatchSize = Math.min(chunkSize, remaining);

    runIterationBatch(accumulator, diceGroups, currentBatchSize, rng);
    completedIterations += currentBatchSize;

    onProgress?.({
      completedIterations,
      totalIterations: iterations,
      progressPercent: (completedIterations / iterations) * 100,
    });

    if (completedIterations < iterations) {
      await yieldToMainThread();
    }
  }

  return buildSimulationResult(accumulator, iterations);
}
