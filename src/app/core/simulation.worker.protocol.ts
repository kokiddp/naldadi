import type { SimulationProgress, SimulationResult } from './simulation.engine';
import type { ThrowConfig } from './dice.model';

export interface WorkerStartRequest {
  readonly type: 'start';
  readonly config: ThrowConfig;
  readonly iterations: number;
  readonly chunkSize?: number;
}

export interface WorkerCancelRequest {
  readonly type: 'cancel';
}

export type WorkerRequest = WorkerStartRequest | WorkerCancelRequest;

export interface WorkerProgressEvent {
  readonly type: 'progress';
  readonly progress: SimulationProgress;
}

export interface WorkerResultEvent {
  readonly type: 'result';
  readonly result: SimulationResult;
}

export interface WorkerCancelledEvent {
  readonly type: 'cancelled';
}

export interface WorkerErrorEvent {
  readonly type: 'error';
  readonly message: string;
}

export type WorkerEvent =
  | WorkerProgressEvent
  | WorkerResultEvent
  | WorkerCancelledEvent
  | WorkerErrorEvent;
