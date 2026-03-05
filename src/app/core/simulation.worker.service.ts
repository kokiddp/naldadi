import { Injectable } from '@angular/core';

import type { ThrowConfig } from './dice.model';
import {
  SimulationCancelledError,
  runSimulationProgressive,
  type ProgressiveSimulationOptions,
  type SimulationResult,
} from './simulation.engine';
import type {
  WorkerEvent,
  WorkerRequest,
} from './simulation.worker.protocol';

@Injectable({ providedIn: 'root' })
export class SimulationWorkerService {
  private readonly workerIterationThreshold = 100000;

  runSimulationProgressive(
    config: ThrowConfig,
    iterations: number,
    options: ProgressiveSimulationOptions = {},
  ): Promise<SimulationResult> {
    if (!this.canUseWorker(iterations, options)) {
      return runSimulationProgressive(config, iterations, options);
    }

    return this.runInWorker(config, iterations, options);
  }

  private canUseWorker(iterations: number, options: ProgressiveSimulationOptions): boolean {
    return typeof Worker !== 'undefined' && options.rng === undefined && iterations >= this.workerIterationThreshold;
  }

  private runInWorker(
    config: ThrowConfig,
    iterations: number,
    options: ProgressiveSimulationOptions,
  ): Promise<SimulationResult> {
    return new Promise<SimulationResult>((resolve, reject) => {
      const worker = new Worker(new URL('./simulation.worker', import.meta.url), {
        type: 'module',
      });

      let cancelInterval: ReturnType<typeof setInterval> | null = null;
      let cancelSent = false;

      const cleanup = (): void => {
        if (cancelInterval !== null) {
          clearInterval(cancelInterval);
          cancelInterval = null;
        }
        worker.terminate();
      };

      worker.onmessage = ({ data }: MessageEvent<WorkerEvent>) => {
        if (data.type === 'progress') {
          options.onProgress?.(data.progress);
          return;
        }

        cleanup();

        if (data.type === 'result') {
          resolve(data.result);
          return;
        }

        if (data.type === 'cancelled') {
          reject(new SimulationCancelledError());
          return;
        }

        reject(new Error(data.message));
      };

      worker.onerror = (event: ErrorEvent) => {
        cleanup();
        reject(new Error(event.message || 'Simulation worker encountered an error.'));
      };

      if (options.shouldCancel !== undefined) {
        cancelInterval = setInterval(() => {
          if (!cancelSent && options.shouldCancel?.()) {
            cancelSent = true;
            const cancelRequest: WorkerRequest = { type: 'cancel' };
            worker.postMessage(cancelRequest);
          }
        }, 50);
      }

      const request: WorkerRequest = {
        type: 'start',
        config,
        iterations,
        chunkSize: options.chunkSize,
      };
      worker.postMessage(request);
    });
  }
}
