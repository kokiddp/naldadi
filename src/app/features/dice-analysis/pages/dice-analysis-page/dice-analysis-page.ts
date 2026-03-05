import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DIE_TYPES, getDieSides, type DieType, type ThrowConfig, createEmptyThrowConfig } from '../../../../core/dice.model';
import { I18nService } from '../../../../core/i18n.service';
import {
  SimulationCancelledError,
  runSimulationProgressive,
  type DistributionPoint,
  type SimulationResult,
} from '../../../../core/simulation.engine';
import {
  getTotalDice,
  type IterationValidationError,
  type ThrowValidationError,
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

interface ExactMatchStat {
  readonly matchSize: number;
  readonly label: string;
  readonly count: number;
  readonly probability: number;
}

interface ProbabilityBucketStat {
  readonly fromPercent: number;
  readonly toPercent: number;
  readonly points: ReadonlyArray<DistributionPoint>;
}

@Component({
  selector: 'app-dice-analysis-page',
  imports: [CommonModule, FormsModule, ThrowComposer, DistributionChart],
  templateUrl: './dice-analysis-page.html',
  styleUrl: './dice-analysis-page.scss',
})
export class DiceAnalysisPage {
  private readonly i18n = inject(I18nService);
  protected readonly dieTypes = DIE_TYPES;
  protected readonly config = signal<ThrowConfig>(createEmptyThrowConfig());
  protected readonly iterations = signal(10000);
  protected readonly simulation = signal<SimulationResult | null>(null);
  protected readonly isRunning = signal(false);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly progressPercent = signal(0);
  protected readonly completedIterations = signal(0);
  protected readonly cancelRequested = signal(false);
  protected readonly validationError = computed(() => {
    const throwError: ThrowValidationError | null = validateThrowConfig(this.config())[0] ?? null;
    if (throwError !== null) {
      return this.translateThrowValidationError(throwError);
    }

    const iterationError: IterationValidationError | null = validateIterations(this.iterations());
    return iterationError === null ? null : this.translateIterationValidationError(iterationError);
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

  protected readonly exactMatchStats = computed<ExactMatchStat[]>(() => {
    const sim = this.simulation();
    if (sim === null || sim.stats.totalDice <= 1) {
      return [];
    }

    return sim.stats.exactMatchCounts.map((entry) => ({
      matchSize: entry.matchSize,
      label: this.multiplicityLabel(entry.matchSize),
      count: entry.count,
      probability: entry.probability,
    }));
  });

  protected readonly probabilityBuckets = computed<ProbabilityBucketStat[]>(() => {
    const sim = this.simulation();
    if (sim === null || sim.distribution.length === 0) {
      return [];
    }

    const rows: ProbabilityBucketStat[] = [];

    for (let toPercent = 5; toPercent <= 100; toPercent += 5) {
      const fromPercent = toPercent - 5;
      const points = sim.distribution.filter((point) => {
        const probabilityPercent = point.probability * 100;

        if (fromPercent === 0) {
          return probabilityPercent < toPercent;
        }

        if (toPercent === 100) {
          return probabilityPercent >= fromPercent && probabilityPercent <= toPercent;
        }

        return probabilityPercent >= fromPercent && probabilityPercent < toPercent;
      });

      rows.push({
        fromPercent,
        toPercent,
        points,
      });
    }

    return rows.filter((row) => row.points.length > 0);
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
    this.statusMessage.set(this.i18n.t('analysis.status.inProgress'));

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
      this.statusMessage.set(
        this.i18n.t('analysis.status.complete', {
          iterations: nextSimulation.stats.iterations.toLocaleString(),
        }),
      );
    } catch (error: unknown) {
      if (error instanceof SimulationCancelledError) {
        this.statusMessage.set(
          this.i18n.t('analysis.status.cancelled', {
            completed: this.completedIterations().toLocaleString(),
            iterations: iterationCount.toLocaleString(),
          }),
        );
      } else {
        this.statusMessage.set(this.i18n.t('analysis.status.failed'));
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
    this.statusMessage.set(this.i18n.t('analysis.status.cancelling'));
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
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

  protected trackByMatchSize(_: number, entry: ExactMatchStat): number {
    return entry.matchSize;
  }

  protected trackByProbabilityBucket(_: number, row: ProbabilityBucketStat): number {
    return row.toPercent;
  }

  protected formatProbabilityBucketLabel(row: ProbabilityBucketStat): string {
    if (row.fromPercent === 0) {
      return this.i18n.t('analysis.probabilityBuckets.label.lessThan', { to: row.toPercent });
    }

    if (row.toPercent === 100) {
      return this.i18n.t('analysis.probabilityBuckets.label.finalRange', {
        from: row.fromPercent,
        to: row.toPercent,
      });
    }

    return this.i18n.t('analysis.probabilityBuckets.label.range', {
      from: row.fromPercent,
      to: row.toPercent,
    });
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
      0: this.i18n.t('label.none'),
      1: this.i18n.t('label.single'),
      2: this.i18n.t('label.double'),
      3: this.i18n.t('label.triple'),
      4: this.i18n.t('label.quadruple'),
      5: this.i18n.t('label.quintuple'),
      6: this.i18n.t('label.sextuple'),
      7: this.i18n.t('label.septuple'),
      8: this.i18n.t('label.octuple'),
    };

    return labels[count] ?? this.i18n.t('label.multiple', { count });
  }

  private translateThrowValidationError(error: ThrowValidationError): string {
    if (error.key === 'invalidDieCount') {
      return this.i18n.t('validator.invalidDieCount', { dieType: error.dieType ?? '' });
    }

    return this.i18n.t('validator.noDiceSelected');
  }

  private translateIterationValidationError(_: IterationValidationError): string {
    return this.i18n.t('validator.invalidIterations');
  }
}
