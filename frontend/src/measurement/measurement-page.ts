import type { CapturePhase } from '../offline/contract';

export type MeasurementPage = 'setup' | 'camera' | 'processing' | 'results' | 'history';
export function measurementPage(requested: string, phase: CapturePhase, cameraEntered: boolean, attemptEntered: boolean, hasResult: boolean): MeasurementPage {
  // URL changes cannot hide/unmount a live camera or retained recording.
  if (phase === 'countdown' || phase === 'recording') return 'camera';
  if (phase === 'preview' || phase === 'processing') return 'processing';
  if (requested === 'processing' && hasResult) return 'results';
  if (requested === 'camera' && cameraEntered) return 'camera';
  if (requested === 'processing' && attemptEntered) return 'processing';
  if (requested === 'results' && hasResult) return 'results';
  if (requested === 'history') return 'history';
  return 'setup';
}
