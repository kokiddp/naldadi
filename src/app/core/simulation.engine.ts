import { DIE_TYPES, getDieSides, type ThrowConfig } from './dice.model';
import { defaultSimulationRandomFloat, rollDieWithRng } from './random';
import { normalizeThrowConfig } from './throw.validators';

export interface DistributionPoint {
  readonly total: number;
  readonly frequency: number;
  readonly probability: number;
  readonly cumulativeProbability: number;
}

export interface SimulationStats {
  readonly iterations: number;
  readonly totalDice: number;
  readonly min: number;
  readonly max: number;
  readonly range: number;
  readonly theoreticalMin: number;
  readonly theoreticalMax: number;
  readonly theoreticalRange: number;
  readonly mean: number;
  readonly median: number;
  readonly mode: number;
  readonly modeFrequency: number;
  readonly modeProbability: number;
  readonly variance: number;
  readonly stdDev: number;
  readonly coeffVariation: number;
  readonly q1: number;
  readonly q3: number;
  readonly iqr: number;
  readonly p05: number;
  readonly p95: number;
  readonly p99: number;
  readonly skewness: number;
  readonly excessKurtosis: number;
  readonly entropyBits: number;
  readonly uniqueTotals: number;
  readonly durationMs: number;
  readonly throwsPerSecond: number;
  readonly theoreticalMean: number;
  readonly theoreticalStdDev: number;
  readonly meanDelta: number;
  readonly exactMatchCounts: ReadonlyArray<{
    readonly matchSize: number;
    readonly count: number;
    readonly probability: number;
  }>;
}

export interface SimulationResult {
  readonly config: ThrowConfig;
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
  readonly exactMatchCounts: number[];
  readonly valueCounts: Uint16Array;
  readonly touchedValueIndexes: number[];
  min: number;
  max: number;
  sum: number;
  sumSquares: number;
}

interface DiceGroup {
  readonly dieType: (typeof DIE_TYPES)[number];
  readonly sides: number;
  readonly count: number;
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function createDiceGroups(config: ThrowConfig): { normalizedConfig: ThrowConfig; groups: DiceGroup[] } {
  const normalizedConfig = normalizeThrowConfig(config);
  const groups: DiceGroup[] = [];

  for (const dieType of DIE_TYPES) {
    const sides = getDieSides(dieType);
    const count = normalizedConfig[dieType];

    if (count > 0) {
      groups.push({ dieType, sides, count });
    }
  }

  return { normalizedConfig, groups };
}

function createAccumulator(): SimulationAccumulator {
  return {
    histogram: new Map<number, number>(),
    exactMatchCounts: [],
    valueCounts: new Uint16Array(21),
    touchedValueIndexes: [],
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
    let maxExactMatch = 1;

    for (const group of diceGroups) {
      for (let dieIndex = 0; dieIndex < group.count; dieIndex += 1) {
        const value = rollDieWithRng(group.sides, rng);
        total += value;

        const previousCount = accumulator.valueCounts[value] ?? 0;
        if (previousCount === 0) {
          accumulator.touchedValueIndexes.push(value);
        }

        const nextCount = previousCount + 1;
        accumulator.valueCounts[value] = nextCount;
        if (nextCount > maxExactMatch) {
          maxExactMatch = nextCount;
        }
      }
    }

    if (maxExactMatch >= 2) {
      accumulator.exactMatchCounts[maxExactMatch] =
        (accumulator.exactMatchCounts[maxExactMatch] ?? 0) + 1;
    }

    for (const valueIndex of accumulator.touchedValueIndexes) {
      accumulator.valueCounts[valueIndex] = 0;
    }
    accumulator.touchedValueIndexes.length = 0;

    accumulator.histogram.set(total, (accumulator.histogram.get(total) ?? 0) + 1);
    accumulator.min = Math.min(accumulator.min, total);
    accumulator.max = Math.max(accumulator.max, total);
    accumulator.sum += total;
    accumulator.sumSquares += total * total;
  }
}

function getQuantileFromDistribution(histogram: Map<number, number>, iterations: number, quantile: number): number {
  const sortedTotals = [...histogram.entries()].sort((a, b) => a[0] - b[0]);
  const target = Math.max(1, Math.ceil(quantile * iterations));
  let running = 0;

  for (const [total, frequency] of sortedTotals) {
    running += frequency;
    if (running >= target) {
      return total;
    }
  }

  return sortedTotals[sortedTotals.length - 1]?.[0] ?? 0;
}

function getMedianFromDistribution(histogram: Map<number, number>, iterations: number): number {
  const lowerTarget = Math.floor((iterations + 1) / 2);
  const upperTarget = Math.floor((iterations + 2) / 2);

  const lower = getQuantileFromDistribution(histogram, iterations, lowerTarget / iterations);
  const upper = getQuantileFromDistribution(histogram, iterations, upperTarget / iterations);

  return (lower + upper) / 2;
}

function computeTheoreticalStats(
  diceGroups: DiceGroup[],
): { mean: number; stdDev: number; min: number; max: number; range: number } {
  let mean = 0;
  let variance = 0;
  let min = 0;
  let max = 0;

  for (const group of diceGroups) {
    const dieMean = (group.sides + 1) / 2;
    const dieVariance = (group.sides * group.sides - 1) / 12;
    mean += group.count * dieMean;
    variance += group.count * dieVariance;
    min += group.count;
    max += group.count * group.sides;
  }

  return {
    mean,
    stdDev: Math.sqrt(Math.max(0, variance)),
    min,
    max,
    range: max - min,
  };
}

function buildSimulationResult(
  normalizedConfig: ThrowConfig,
  diceGroups: DiceGroup[],
  accumulator: SimulationAccumulator,
  iterations: number,
  durationMs: number,
): SimulationResult {
  const totalDice = diceGroups.reduce((sum, group) => sum + group.count, 0);
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

  let mode = 0;
  let modeFrequency = 0;
  let entropyBits = 0;
  let centeredMoment3 = 0;
  let centeredMoment4 = 0;

  for (const point of distribution) {
    if (point.frequency > modeFrequency) {
      modeFrequency = point.frequency;
      mode = point.total;
    }

    if (point.probability > 0) {
      entropyBits -= point.probability * Math.log2(point.probability);
    }

    const delta = point.total - mean;
    centeredMoment3 += point.probability * delta * delta * delta;
    centeredMoment4 += point.probability * delta * delta * delta * delta;
  }

  const skewness = stdDev > 0 ? centeredMoment3 / (stdDev * stdDev * stdDev) : 0;
  const excessKurtosis = stdDev > 0 ? centeredMoment4 / (stdDev * stdDev * stdDev * stdDev) - 3 : 0;

  const q1 = getQuantileFromDistribution(accumulator.histogram, iterations, 0.25);
  const q3 = getQuantileFromDistribution(accumulator.histogram, iterations, 0.75);
  const p05 = getQuantileFromDistribution(accumulator.histogram, iterations, 0.05);
  const p95 = getQuantileFromDistribution(accumulator.histogram, iterations, 0.95);
  const p99 = getQuantileFromDistribution(accumulator.histogram, iterations, 0.99);

  const theoretical = computeTheoreticalStats(diceGroups);
  const exactMatchCounts = Array.from({ length: Math.max(0, totalDice - 1) }, (_, index) => {
    const matchSize = index + 2;
    const count = accumulator.exactMatchCounts[matchSize] ?? 0;

    return {
      matchSize,
      count,
      probability: count / iterations,
    };
  });

  return {
    config: normalizedConfig,
    stats: {
      iterations,
      totalDice,
      min: Number.isFinite(accumulator.min) ? accumulator.min : 0,
      max: Number.isFinite(accumulator.max) ? accumulator.max : 0,
      range: Number.isFinite(accumulator.min) && Number.isFinite(accumulator.max)
        ? accumulator.max - accumulator.min
        : 0,
      theoreticalMin: theoretical.min,
      theoreticalMax: theoretical.max,
      theoreticalRange: theoretical.range,
      mean,
      median: getMedianFromDistribution(accumulator.histogram, iterations),
      mode,
      modeFrequency,
      modeProbability: modeFrequency / iterations,
      variance,
      stdDev,
      coeffVariation: mean !== 0 ? stdDev / Math.abs(mean) : 0,
      q1,
      q3,
      iqr: q3 - q1,
      p05,
      p95,
      p99,
      skewness,
      excessKurtosis,
      entropyBits,
      uniqueTotals: distribution.length,
      durationMs,
      throwsPerSecond: durationMs > 0 ? iterations / (durationMs / 1000) : 0,
      theoreticalMean: theoretical.mean,
      theoreticalStdDev: theoretical.stdDev,
      meanDelta: mean - theoretical.mean,
      exactMatchCounts,
    },
    distribution,
  };
}

export function runSimulation(
  config: ThrowConfig,
  iterations: number,
  rng?: () => number,
): SimulationResult {
  const startMs = nowMs();
  const { normalizedConfig, groups } = createDiceGroups(config);
  const accumulator = createAccumulator();

  runIterationBatch(accumulator, groups, iterations, rng ?? defaultSimulationRandomFloat);

  return buildSimulationResult(normalizedConfig, groups, accumulator, iterations, nowMs() - startMs);
}

export async function runSimulationProgressive(
  config: ThrowConfig,
  iterations: number,
  options: ProgressiveSimulationOptions = {},
): Promise<SimulationResult> {
  const startMs = nowMs();
  const rng = options.rng ?? defaultSimulationRandomFloat;
  const chunkSize = Math.max(1, Math.trunc(options.chunkSize ?? 25000));
  const onProgress = options.onProgress;
  const shouldCancel = options.shouldCancel;
  const yieldToMainThread = options.yieldToMainThread ?? (() => new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  }));

  const { normalizedConfig, groups } = createDiceGroups(config);
  const accumulator = createAccumulator();

  let completedIterations = 0;
  onProgress?.({ completedIterations: 0, totalIterations: iterations, progressPercent: 0 });

  while (completedIterations < iterations) {
    if (shouldCancel?.()) {
      throw new SimulationCancelledError();
    }

    const remaining = iterations - completedIterations;
    const currentBatchSize = Math.min(chunkSize, remaining);

    runIterationBatch(accumulator, groups, currentBatchSize, rng);
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

  return buildSimulationResult(normalizedConfig, groups, accumulator, iterations, nowMs() - startMs);
}
