import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { createEmptyThrowConfig, type ThrowConfig } from '../../../../core/dice.model';
import {
  SimulationCancelledError,
  runSimulationProgressive,
  type SimulationResult,
} from '../../../../core/simulation.engine';
import {
  getTotalDice,
  validateIterations,
  validateThrowConfig,
} from '../../../../core/throw.validators';
import { DistributionChart } from '../../../../shared/components/distribution-chart/distribution-chart';
import { ThrowComposer } from '../../../../shared/components/throw-composer/throw-composer';

@Component({
  selector: 'app-dice-analysis-page',
  imports: [CommonModule, FormsModule, ThrowComposer, DistributionChart],
  templateUrl: './dice-analysis-page.html',
  styleUrl: './dice-analysis-page.scss',
})
export class DiceAnalysisPage {
  protected readonly config = signal<ThrowConfig>(createEmptyThrowConfig());
  protected readonly iterations = signal(10000);
  protected readonly simulation = signal<SimulationResult | null>(null);
  protected readonly isRunning = signal(false);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly progressPercent = signal(0);
  protected readonly completedIterations = signal(0);
  protected readonly cancelRequested = signal(false);

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
    this.progressPercent.set(0);
    this.completedIterations.set(0);
    this.statusMessage.set('Simulation in progress...');

    try {
      const nextSimulation = await runSimulationProgressive(this.config(), iterationCount, {
        chunkSize: this.pickChunkSize(iterationCount),
        onProgress: (progress) => {
          this.completedIterations.set(progress.completedIterations);
          this.progressPercent.set(progress.progressPercent);
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

  private pickChunkSize(iterationCount: number): number {
    if (iterationCount <= 50000) {
      return 5000;
    }

    if (iterationCount <= 500000) {
      return 20000;
    }

    return 50000;
  }
}
