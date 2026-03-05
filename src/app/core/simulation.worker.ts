/// <reference lib="webworker" />

import {
  SimulationCancelledError,
  runSimulationProgressive,
} from './simulation.engine';
import type {
  WorkerEvent,
  WorkerRequest,
} from './simulation.worker.protocol';

let cancelRequested = false;

function postWorkerEvent(event: WorkerEvent): void {
  postMessage(event);
}

addEventListener('message', ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === 'cancel') {
    cancelRequested = true;
    return;
  }

  cancelRequested = false;

  void (async () => {
    try {
      const result = await runSimulationProgressive(data.config, data.iterations, {
        chunkSize: data.chunkSize,
        shouldCancel: () => cancelRequested,
        onProgress: (progress) => {
          postWorkerEvent({ type: 'progress', progress });
        },
      });

      postWorkerEvent({ type: 'result', result });
    } catch (error: unknown) {
      if (error instanceof SimulationCancelledError) {
        postWorkerEvent({ type: 'cancelled' });
        return;
      }

      postWorkerEvent({
        type: 'error',
        message: error instanceof Error ? error.message : 'Simulation worker failed.',
      });
    }
  })();
});
