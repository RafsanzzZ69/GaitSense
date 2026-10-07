import type {SideView} from './contract.ts';

export const RECORDING_SETUP_VERSION = 'recording-analysis-setup-1';
export type RecordingAnalysisSetup = Readonly<{view: SideView; direction: 1|-1|null; upright: true|null}>;
/** One immutable attempt snapshot, created before countdown. No scientific inference. */
export function snapshotRecordingSetup(view: SideView, direction: 1|-1|null, upright: boolean): RecordingAnalysisSetup {
  if (!['side_left','side_right'].includes(view) || ![null,1,-1].includes(direction) || typeof upright !== 'boolean')
    throw new Error('Invalid recording analysis setup');
  return Object.freeze({view,direction,upright:upright ? true : null});
}
export function serializeRecordingSetup(setup: RecordingAnalysisSetup): string {
  return JSON.stringify({contractVersion:RECORDING_SETUP_VERSION,direction:setup.direction,upright:setup.upright});
}
export function createRecordingSetupBinding() {
  let active:RecordingAnalysisSetup|null=null;
  return {
    start(view:SideView,direction:1|-1|null,upright:boolean) {
      if(active) throw new Error('A recording setup snapshot is already active');
      active=snapshotRecordingSetup(view,direction,upright); return active;
    },
    get(){return active;},
    clear(){active=null;},
  };
}
