import type {SavedSessionLoadState} from './saved-session-loader.ts';

export const ANALYSIS_PRESENTATION_VERSION = 'saved-analysis-presentation-2';
export type PresentationStatus = 'unselected' | 'loading' | 'load-failed' | 'invalid-data'
  | 'processing-failed' | 'unavailable' | 'partial' | 'calculated';
export type ReadonlyDeep<T> = T extends readonly (infer U)[] ? readonly ReadonlyDeep<U>[] :
  T extends object ? {readonly [K in keyof T]: ReadonlyDeep<T[K]>} : T;

// Copy only the selected, bounded analysis fields below, never arbitrary session extras
// or diagnostic text. Freeze a detached snapshot so neither consumer nor later input
// mutation can rewrite a presented result. Null and legitimate numeric zero stay distinct.
function snapshot<T>(value: T): ReadonlyDeep<T> {
  if (Array.isArray(value)) return Object.freeze(value.map(v => snapshot(v))) as ReadonlyDeep<T>;
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) copy[key] = snapshot(field);
    return Object.freeze(copy) as ReadonlyDeep<T>;
  }
  return value as ReadonlyDeep<T>;
}

/** Projection of a trusted production loader state, not a second payload validator.
 * No IO, aggregation, rounding, diagnostic parsing or new scientific calculations.
 */
export function presentSavedAnalysis(state: SavedSessionLoadState) {
  const result = state.result;
  const analysis = result?.analysis ?? null;
  // A loading/unselected state must never display previous measurements.
  const current = state.status !== 'loading' && state.selectedSessionId !== null ? analysis : null;
  const context = current?.context;
  const components = current?.components;
  const knee = components?.knee.result ?? null;
  const motion = components?.motion.result ?? null;
  const intervals = components?.intervals.result ?? null;
  let status: PresentationStatus;
  if (state.status === 'loading') status = 'loading';
  else if (state.status === 'failed') status = result?.status === 'load-failed' ? 'load-failed' :
    current?.status === 'failed' ? 'processing-failed' : 'invalid-data';
  else if (state.selectedSessionId === null && state.reasons.includes('no_selection')) status = 'unselected';
  else if (!current || current.status === 'unavailable') status = 'unavailable';
  else status = current.status === 'available' ? 'calculated' : 'partial';
  const dataStatus = status === 'loading' ? 'loading' : status === 'load-failed' ? 'failed' :
    status === 'invalid-data' ? 'rejected' : current ? 'loaded' : 'not-loaded';
  const assessed = !!current && current.processing?.status === 'completed';
  const geometrySupplied = knee?.geometry?.source === 'caller-asserted-inference-dimensions';
  const geometryPersisted = knee?.geometry?.source === 'native-inference-bitmap';
  const labels = {
    unselected: 'No session selected', loading: 'Loading saved session',
    'load-failed': 'Saved-session read failed', 'invalid-data': 'Saved data or setup could not be accepted',
    'processing-failed': 'Processing failed', unavailable: 'Analysis unavailable',
    partial: 'Partial analysis', calculated: 'Calculated outputs (not scientifically evaluated)',
  } as const;
  return snapshot({
    contractVersion: ANALYSIS_PRESENTATION_VERSION,
    scientificStatus: 'NOT_EVALUATED' as const,
    selection: {sessionId: state.selectedSessionId, generation: state.generation},
    status, label: labels[status], dataStatus, loaderStatus: state.status,
    reasons: state.reasons,
    failureDetail: state.status === 'failed' ? result?.detail ?? current?.processing?.reason ?? null : null,
    analysisStatus: current?.status ?? null,
    processing: current?.processing ?? null,
    components: {
      knee: {label: 'Projected 2D knee flexion', units: 'degrees',
        status: components?.knee.status ?? 'not-analyzed', reasons: components?.knee.reasons ?? [], details: knee},
      motion: {label: 'Candidate ankle-motion extrema', units: 'normalized-image-width',
        status: components?.motion.status ?? 'not-analyzed', reasons: components?.motion.reasons ?? [], details: motion},
      intervals: {label: 'Candidate-to-candidate temporal intervals', units: 'milliseconds',
        status: components?.intervals.status ?? 'not-analyzed', reasons: components?.intervals.reasons ?? [], details: intervals},
    },
    setup: {
      geometry: {affects: ['knee'], status: !assessed ? 'not-assessed' : geometryPersisted ? 'persisted-native' : geometrySupplied ? 'caller-asserted' : 'required',
        requirement: 'Explicit inference dimensions valid throughout this session',
        value: geometrySupplied || geometryPersisted ? knee?.geometry ?? null : null},
      direction: {affects: ['motion', 'intervals'], status: !assessed ? 'not-assessed' :
        context?.direction === 1 || context?.direction === -1 ? 'caller-asserted' : 'required',
        requirement: 'One travel direction in image x', value: context?.direction ?? null},
      upright: {affects: ['motion', 'intervals'], status: !assessed ? 'not-assessed' : context?.upright === true ? 'caller-asserted' : 'required',
        requirement: 'Explicit upright orientation confirmation', value: context?.upright ?? null},
      continuity: {affects: ['intervals'], status: !assessed ? 'not-assessed' :
        context?.continuity === 'detector-segments' ? 'requested' : 'required',
        requirement: 'Request checked detector segments; physical-cycle completeness remains unknown',
        requested: context?.continuity ?? null, used: intervals?.continuity ?? null},
      ownership: {participantId: context?.participantId ?? null, attemptId: context?.attemptId ?? null,
        source: 'caller-supplied-or-unknown'},
    },
    provenance: {
      adapterVersion: result?.adapterVersion ?? null, analysisVersion: current?.contractVersion ?? null,
      extractorVersion: current?.session?.extractorVersion ?? null, modelSha256: current?.session?.modelSha256 ?? null,
      timestampMethod: current?.session?.timestampMethod ?? null,
      actualDecodedFramePts: 'not-available', exactImageCorrespondence: 'not-established', sourceImages: 'not-supplied',
      frameOwnership: 'not-independently-authenticated',
      binding: current && result && 'binding' in result ? result.binding : null,
      candidateIdentity: 'analysis-local-index-not-persistent',
    },
    limitations: ['scientific-status-not-evaluated', 'projected-2d-knee-not-anatomical-validation',
      'motion-extrema-not-contacts', 'intervals-not-step-or-stride-time', 'physical-cycle-completeness-unknown',
      'native-reads-noncancellable-and-nonatomic', 'summary-list-limited-to-100-not-a-database-existence-check'],
  });
}
export type SavedAnalysisPresentation = ReturnType<typeof presentSavedAnalysis>;
