import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DIE_TYPES, getDieSides, type DieType, type ThrowConfig, createEmptyThrowConfig } from '../../../core/dice.model';
import { I18nService } from '../../../core/i18n.service';
import {
  SimulationCancelledError,
  type DistributionPoint,
  type SimulationResult,
} from '../../../core/simulation.engine';
import { SimulationWorkerService } from '../../../core/simulation.worker.service';
import {
  getTotalDice,
  type IterationValidationError,
  type ThrowValidationError,
  validateIterations,
  validateThrowConfig,
} from '../../../core/throw.validators';
import { DistributionChart } from '../../../shared/components/distribution-chart/distribution-chart';
import { FeaturePanel } from '../../../shared/components/feature-panel/feature-panel';
import { ThrowComposer } from '../../../shared/components/throw-composer/throw-composer';
import {
  ProbabilityBuckets,
  type ProbabilityBucketItem,
} from '../components/probability-buckets/probability-buckets';
import {
  SavedAnalysisRuns,
  type SavedAnalysisRunView,
} from '../components/saved-analysis-runs/saved-analysis-runs';

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
  readonly expectedProbability: number | null;
}

interface SavedAnalysisItem {
  readonly id: number;
  readonly createdAt: number;
  readonly result: SimulationResult;
}

@Component({
  selector: 'app-dice-analysis-page',
  imports: [CommonModule, FormsModule, FeaturePanel, ThrowComposer, DistributionChart, ProbabilityBuckets, SavedAnalysisRuns],
  templateUrl: './page.html',
  styleUrl: './page.scss',
})
export class DiceAnalysisPage {
  private readonly savedRunsStorageKey = 'naldadi.analysis.savedRuns';
  private readonly maxSavedRuns = 200;
  private readonly pageSize = 20;
  private readonly i18n = inject(I18nService);
  private readonly simulationRunner = inject(SimulationWorkerService);
  protected readonly dieTypes = DIE_TYPES;
  protected readonly config = signal<ThrowConfig>(createEmptyThrowConfig());
  protected readonly iterations = signal(10000);
  protected readonly simulation = signal<SimulationResult | null>(null);
  protected readonly savedRuns = signal<SavedAnalysisItem[]>(this.loadSavedRuns());
  protected readonly savedRunsPage = signal(1);
  protected readonly activeSavedRunId = signal<number | null>(null);
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
  protected readonly totalSavedRunsPages = computed(() =>
    Math.max(1, Math.ceil(this.savedRuns().length / this.pageSize)),
  );
  protected readonly pagedSavedRuns = computed(() => {
    const page = Math.min(this.savedRunsPage(), this.totalSavedRunsPages());
    const start = (page - 1) * this.pageSize;
    return this.savedRuns().slice(start, start + this.pageSize);
  });
  protected readonly pagedSavedRunViews = computed<SavedAnalysisRunView[]>(() =>
    this.pagedSavedRuns().map((item) => ({
      id: item.id,
      title: this.formatSavedRunTitle(item),
      summary: this.formatSavedRunSummary(item),
    })),
  );
  protected readonly canGoToPreviousSavedRunsPage = computed(() => this.savedRunsPage() > 1);
  protected readonly canGoToNextSavedRunsPage = computed(
    () => this.savedRunsPage() < this.totalSavedRunsPages(),
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
      expectedProbability: entry.expectedProbability,
    }));
  });

  protected readonly probabilityBuckets = computed<ProbabilityBucketItem[]>(() => {
    const sim = this.simulation();
    if (sim === null || sim.distribution.length === 0) {
      return [];
    }

    const rows: ProbabilityBucketItem[] = [];

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

      const nextSimulation = await this.simulationRunner.runSimulationProgressive(this.config(), iterationCount, {
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
      this.saveRun(nextSimulation);
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

  protected formatProbabilityPercent(probability: number): string {
    const percent = probability * 100;
    if (percent >= 1) {
      return `${percent.toFixed(2)}%`;
    }

    if (percent >= 0.01) {
      return `${percent.toFixed(4)}%`;
    }

    if (percent > 0) {
      return `${percent.toFixed(6)}%`;
    }

    return '0.00%';
  }

  protected formatExpectedPercent(probability: number | null): string {
    return probability === null ? '-' : this.formatProbabilityPercent(probability);
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

  protected rehydrateSavedRun(item: SavedAnalysisItem): void {
    if (this.isRunning()) {
      return;
    }

    this.config.set(item.result.config);
    this.iterations.set(item.result.stats.iterations);
    this.simulation.set(item.result);
    this.activeSavedRunId.set(item.id);
    this.statusMessage.set(
      this.i18n.t('analysis.saved.status.loaded', {
        date: new Date(item.createdAt).toLocaleString(),
      }),
    );
  }

  protected loadSavedRun(itemId: number): void {
    const item = this.savedRuns().find((entry) => entry.id === itemId);
    if (item !== undefined) {
      this.rehydrateSavedRun(item);
    }
  }

  protected formatSavedRunTitle(item: SavedAnalysisItem): string {
    return this.i18n.t('analysis.saved.itemTitle', {
      iterations: item.result.stats.iterations.toLocaleString(),
      totalDice: item.result.stats.totalDice,
      diceTypes: this.formatSavedRunDiceTypes(item.result.config),
      date: new Date(item.createdAt).toLocaleString(),
    });
  }

  protected formatSavedRunSummary(item: SavedAnalysisItem): string {
    return this.i18n.t('analysis.saved.itemSummary', {
      min: item.result.stats.min,
      max: item.result.stats.max,
      mean: item.result.stats.mean.toFixed(2),
      stdDev: item.result.stats.stdDev.toFixed(2),
    });
  }

  protected deleteSavedRun(itemId: number): void {
    this.savedRuns.update((current) => {
      const next = current.filter((item) => item.id !== itemId);
      this.persistSavedRuns(next);
      return next;
    });
    if (this.activeSavedRunId() === itemId) {
      this.activeSavedRunId.set(null);
    }
    this.clampSavedRunsPage();
  }

  protected clearSavedRuns(): void {
    this.savedRuns.set([]);
    this.persistSavedRuns([]);
    this.savedRunsPage.set(1);
    this.activeSavedRunId.set(null);
  }

  protected previousSavedRunsPage(): void {
    if (!this.canGoToPreviousSavedRunsPage()) {
      return;
    }

    this.savedRunsPage.update((current) => Math.max(1, current - 1));
  }

  protected nextSavedRunsPage(): void {
    if (!this.canGoToNextSavedRunsPage()) {
      return;
    }

    this.savedRunsPage.update((current) => Math.min(this.totalSavedRunsPages(), current + 1));
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

  private saveRun(result: SimulationResult): void {
    const item: SavedAnalysisItem = {
      id: Date.now(),
      createdAt: Date.now(),
      result,
    };

    this.savedRuns.update((current) => {
      const next = [item, ...current].slice(0, this.maxSavedRuns);
      this.persistSavedRuns(next);
      return next;
    });
    this.activeSavedRunId.set(item.id);
    this.savedRunsPage.set(1);
  }

  private persistSavedRuns(items: SavedAnalysisItem[]): void {
    try {
      localStorage.setItem(this.savedRunsStorageKey, JSON.stringify(items));
    } catch {
      // Ignore persistence failures (private mode/quota issues).
    }
  }

  private loadSavedRuns(): SavedAnalysisItem[] {
    try {
      const raw = localStorage.getItem(this.savedRunsStorageKey);
      if (raw === null) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item): item is SavedAnalysisItem => this.isSavedAnalysisItem(item))
        .slice(0, this.maxSavedRuns);
    } catch {
      return [];
    }
  }

  private clampSavedRunsPage(): void {
    this.savedRunsPage.update((current) => Math.min(current, this.totalSavedRunsPages()));
  }

  private isSavedAnalysisItem(value: unknown): value is SavedAnalysisItem {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<SavedAnalysisItem>;
    return (
      typeof candidate.id === 'number' &&
      typeof candidate.createdAt === 'number' &&
      typeof candidate.result === 'object' &&
      candidate.result !== null &&
      Array.isArray((candidate.result as Partial<SimulationResult>).distribution) &&
      typeof (candidate.result as Partial<SimulationResult>).stats === 'object' &&
      (candidate.result as Partial<SimulationResult>).stats !== null &&
      typeof (candidate.result as Partial<SimulationResult>).config === 'object' &&
      (candidate.result as Partial<SimulationResult>).config !== null
    );
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

  private formatSavedRunDiceTypes(config: ThrowConfig): string {
    const parts = DIE_TYPES.flatMap((dieType) => {
      const count = config[dieType];
      return count > 0 ? [`${count}${dieType}`] : [];
    });

    return parts.join(' + ');
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
