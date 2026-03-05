import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DIE_TYPES, getDieSides, type DieType, type ThrowConfig, createEmptyThrowConfig } from '../../../../core/dice.model';
import {
  SimulationCancelledError,
  runSimulationProgressive,
  type DistributionPoint,
  type SimulationResult,
} from '../../../../core/simulation.engine';
import {
  getTotalDice,
  validateIterations,
  validateThrowConfig,
} from '../../../../core/throw.validators';
import { DistributionChart } from '../../../../shared/components/distribution-chart/distribution-chart';
import { ThrowComposer } from '../../../../shared/components/throw-composer/throw-composer';

interface CompositionRow {
  readonly dieType: DieType;
  readonly sides: number;
  readonly count: number;
  readonly multiplicityLabel: string;
}

interface MultiplicityGroup {
  readonly size: number;
  readonly label: string;
  readonly dieTypeCount: number;
  readonly totalDice: number;
}

@Component({
  selector: 'app-dice-analysis-page',
  imports: [CommonModule, FormsModule, ThrowComposer, DistributionChart],
  templateUrl: './dice-analysis-page.html',
  styleUrl: './dice-analysis-page.scss',
})
export class DiceAnalysisPage {
  protected readonly dieTypes = DIE_TYPES;
  protected readonly config = signal<ThrowConfig>(createEmptyThrowConfig());
  protected readonly iterations = signal(10000);
  protected readonly simulation = signal<SimulationResult | null>(null);
  protected readonly isRunning = signal(false);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly progressPercent = signal(0);
  protected readonly completedIterations = signal(0);
  protected readonly cancelRequested = signal(false);
  protected readonly statHelp = {
    iterations: 'How many simulated throws were executed in this run.',
    duration: 'How long the simulation took from start to finish in milliseconds.',
    throughput: 'How many simulated throws were processed per second on your current device.',
    minMax: 'The smallest and largest total values seen across all simulated throws.',
    range: 'Difference between the maximum and minimum total (max minus min).',
    mean: 'The average total value across all throws.',
    theoreticalMean: 'The mathematically expected average total for the selected dice setup.',
    meanDelta: 'How far the observed mean is from the theoretical mean.',
    median: 'The middle total when all results are sorted from lowest to highest.',
    mode: 'The most frequently occurring total.',
    stdDev: 'Typical distance of results from the mean. Higher means more spread.',
    theoreticalStdDev: 'The mathematically expected spread for this dice setup.',
    variance: 'Spread measure equal to standard deviation squared.',
    coeffVariation: 'Relative spread: standard deviation divided by mean, shown as a percentage.',
    q1Q3: 'Q1 is the 25th percentile and Q3 is the 75th percentile of totals.',
    iqr: 'Interquartile range (Q3 minus Q1), showing the width of the middle 50 percent.',
    percentiles: 'P05, P95, and P99 are totals below which 5 percent, 95 percent, and 99 percent of outcomes fall.',
    skewness: 'Shows if results lean left or right. Near zero means roughly symmetric.',
    excessKurtosis: 'Shows tail heaviness vs a normal shape. Positive means heavier tails, negative means lighter tails.',
    entropy: 'Information/uncertainty in the distribution. Higher entropy means outcomes are more spread out.',
    uniqueTotals: 'How many distinct total values actually appeared in this simulation.',
    withinSigma: 'Probability that totals fall within one standard deviation of the mean.',
    belowAboveMean: 'Probability split for totals below the mean versus at or above the mean.',
  } as const;
  protected readonly multiplicityHelp = {
    perDieType:
      'Shows each selected die type and how many of that die are included in one throw (single, double, triple, etc.).',
    combined:
      'Groups the throw by multiplicity size. For example, how many die types are doubles, triples, and so on, plus combined dice count.',
  } as const;

  protected readonly validationError = computed(() => {
    const throwError = validateThrowConfig(this.config())[0] ?? null;
    if (throwError !== null) {
      return throwError;
    }

    return validateIterations(this.iterations());
  });

  protected readonly canRun = computed(
    () => getTotalDice(this.config()) > 0 && this.validationError() === null && !this.isRunning(),
  );

  protected readonly compositionRows = computed<CompositionRow[]>(() => {
    const currentConfig = this.config();
    return DIE_TYPES.map((dieType) => {
      const count = currentConfig[dieType];
      return {
        dieType,
        sides: getDieSides(dieType),
        count,
        multiplicityLabel: this.multiplicityLabel(count),
      };
    });
  });

  protected readonly activeCompositionRows = computed(() =>
    this.compositionRows().filter((row) => row.count > 0),
  );

  protected readonly multiplicityGroups = computed<MultiplicityGroup[]>(() => {
    const groups = new Map<number, { dieTypeCount: number; totalDice: number }>();

    for (const row of this.activeCompositionRows()) {
      const bucket = groups.get(row.count) ?? { dieTypeCount: 0, totalDice: 0 };
      groups.set(row.count, {
        dieTypeCount: bucket.dieTypeCount + 1,
        totalDice: bucket.totalDice + row.count,
      });
    }

    return [...groups.entries()]
      .map(([size, value]) => ({
        size,
        label: this.multiplicityLabel(size),
        dieTypeCount: value.dieTypeCount,
        totalDice: value.totalDice,
      }))
      .sort((a, b) => a.size - b.size);
  });

  protected readonly topOutcomes = computed<DistributionPoint[]>(() => {
    const sim = this.simulation();
    if (sim === null) {
      return [];
    }

    return [...sim.distribution]
      .sort((a, b) => b.frequency - a.frequency || a.total - b.total)
      .slice(0, 12);
  });

  protected readonly centralBandProbability = computed(() => {
    const sim = this.simulation();
    if (sim === null) {
      return 0;
    }

    const lower = sim.stats.mean - sim.stats.stdDev;
    const upper = sim.stats.mean + sim.stats.stdDev;

    return sim.distribution
      .filter((point) => point.total >= lower && point.total <= upper)
      .reduce((sum, point) => sum + point.probability, 0);
  });

  protected readonly belowMeanProbability = computed(() => {
    const sim = this.simulation();
    if (sim === null) {
      return 0;
    }

    return sim.distribution
      .filter((point) => point.total < sim.stats.mean)
      .reduce((sum, point) => sum + point.probability, 0);
  });

  protected readonly atOrAboveMeanProbability = computed(() => {
    const sim = this.simulation();
    if (sim === null) {
      return 0;
    }

    return sim.distribution
      .filter((point) => point.total >= sim.stats.mean)
      .reduce((sum, point) => sum + point.probability, 0);
  });

  protected onConfigChange(updatedConfig: ThrowConfig): void {
    this.config.set(updatedConfig);
  }

  protected onIterationsChange(value: string): void {
    const parsed = Number.parseInt(value, 10);
    this.iterations.set(Number.isNaN(parsed) ? 0 : parsed);
  }

  protected async run(): Promise<void> {
    if (!this.canRun()) {
      return;
    }

    const iterationCount = this.iterations();

    this.isRunning.set(true);
    this.cancelRequested.set(false);
    this.simulation.set(null);
    this.progressPercent.set(0);
    this.completedIterations.set(0);
    this.statusMessage.set('Simulation in progress...');

    try {
      let lastProgressUpdateMs = 0;

      const nextSimulation = await runSimulationProgressive(this.config(), iterationCount, {
        chunkSize: this.pickChunkSize(iterationCount),
        onProgress: (progress) => {
          const nowMs =
            typeof performance !== 'undefined' && typeof performance.now === 'function'
              ? performance.now()
              : Date.now();

          if (
            progress.completedIterations === progress.totalIterations ||
            nowMs - lastProgressUpdateMs >= 80
          ) {
            this.completedIterations.set(progress.completedIterations);
            this.progressPercent.set(progress.progressPercent);
            lastProgressUpdateMs = nowMs;
          }
        },
        shouldCancel: () => this.cancelRequested(),
      });

      this.simulation.set(nextSimulation);
      this.statusMessage.set(`Simulation complete for ${nextSimulation.stats.iterations.toLocaleString()} runs.`);
    } catch (error: unknown) {
      if (error instanceof SimulationCancelledError) {
        this.statusMessage.set(
          `Simulation cancelled at ${this.completedIterations().toLocaleString()} / ${iterationCount.toLocaleString()} runs.`,
        );
      } else {
        this.statusMessage.set('Simulation failed unexpectedly. Please try again.');
      }
    } finally {
      this.isRunning.set(false);
    }
  }

  protected cancel(): void {
    if (!this.isRunning()) {
      return;
    }

    this.cancelRequested.set(true);
    this.statusMessage.set('Cancelling simulation...');
  }

  protected formatPercent(probability: number): string {
    return `${(probability * 100).toFixed(2)}%`;
  }

  protected trackByTotal(_: number, point: DistributionPoint): number {
    return point.total;
  }

  protected trackByDieType(_: number, row: CompositionRow): string {
    return row.dieType;
  }

  protected trackByMultiplicity(_: number, group: MultiplicityGroup): number {
    return group.size;
  }

  private pickChunkSize(iterationCount: number): number {
    if (iterationCount <= 50000) {
      return 5000;
    }

    if (iterationCount <= 500000) {
      return 20000;
    }

    return 50000;
  }

  private multiplicityLabel(count: number): string {
    const labels: Record<number, string> = {
      0: 'none',
      1: 'single',
      2: 'double',
      3: 'triple',
      4: 'quadruple',
      5: 'quintuple',
      6: 'sextuple',
      7: 'septuple',
      8: 'octuple',
    };

    return labels[count] ?? `${count}x`;
  }
}
