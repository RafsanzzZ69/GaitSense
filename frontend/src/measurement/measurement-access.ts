import type { ReactNode } from 'react';
import type { CapturePhase, Session, SideView } from '../offline/contract';
import type { SavedAnalysisPresentation } from '../offline/analysis-presentation';

// Presentation access to the existing controller. No second capture state owner.
export type MeasurementAccess = {
  phase: CapturePhase; consent: boolean; ready: boolean; nativeAvailable: boolean;
  view: SideView; direction: 1 | -1 | null; upright: boolean;
  uri: string | null; countdown: number; seconds: number; error: string;
  completed: Session | null; selectedSession: Session | null; analysis: SavedAnalysisPresentation | null;
  canLeave: () => boolean; canContinue: () => boolean; canRecord: boolean;
  setup: ReactNode; camera: ReactNode; preview: ReactNode; history: ReactNode;
  technical: ReactNode; processing: ReactNode;
  prepareCamera: () => void; record: () => void; discard: () => void; process: () => void;
  cancelCountdown: () => void; stop: () => void;
};
