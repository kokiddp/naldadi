import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { createEmptyThrowConfig, type ThrowConfig } from '../../../../core/dice.model';
import { runSimulation, type SimulationResult } from '../../../../core/simulation.engine';
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

  protected run(): void {
    if (!this.canRun()) {
      return;
    }

    this.isRunning.set(true);
    this.statusMessage.set('Simulation in progress...');

    // Yield once so status paint is visible before a large synchronous run starts.
    setTimeout(() => {
      const nextSimulation = runSimulation(this.config(), this.iterations());
      this.simulation.set(nextSimulation);
      this.statusMessage.set(`Simulation complete for ${nextSimulation.stats.iterations.toLocaleString()} runs.`);
      this.isRunning.set(false);
    }, 0);
  }
}
