import { parseSession } from './contract.ts';
import type { Landmark, PoseFrame, Session, SideView } from './contract.ts';

/** Computational estimates only; no anatomical/clinical validation is implied. */
export const KNEE_CONFIGURATION = Object.freeze({
  version: 'knee-quality-1', minVisibility: 0.6, minPresence: 0.6,
  maxGapMs: 100, minimumVectorLength: 1e-12, interpolation: 'none' as const,
});
export type KneeReason = 'invalid_session' | 'invalid_frames' | 'unsupported_view'
  | 'unsupported_timestamp_method' | 'invalid_timestamp' | 'duplicate_timestamp'
  | 'decreasing_timestamp' | 'frame_count_mismatch' | 'no_observations'
  | 'missing_geometry' | 'non_finite_coordinate' | 'invalid_confidence'
  | 'low_visibility' | 'low_presence' | 'out_of_frame' | 'degenerate_geometry'
  | 'missing_observations' | 'timestamp_gap' | 'irregular_sampling';
export type TimeRange = { startMs: number; endMs: number };
export type ExplicitKneeGeometry = {
  inferenceWidth: number; inferenceHeight: number;
  source: 'caller-asserted-inference-dimensions';
  assumption: 'constant-inference-dimensions-within-session';
};
export type KneeGeometry = (ExplicitKneeGeometry & {aspectRatio: number}) | {
  decodedWidth: number; decodedHeight: number; decodedAspectRatio: number;
  inferenceWidth: number; inferenceHeight: number; aspectRatio: number;
  source: 'android-pose-0.1.1-diagnostics';
  assumption: 'constant-decoded-dimensions-within-session';
};
export type LandmarkQuality = { index: number; valid: boolean; reasons: KneeReason[] };
export type KneeObservation = {
  timestampMs: number; deltaFromPreviousMs: number | null;
  value: number | null; status: 'available' | 'unavailable'; reasons: KneeReason[];
  landmarkQuality: LandmarkQuality[];
};
export type KneeResult = {
  feature: 'selected-side-2d-projected-knee-flexion'; units: 'degrees';
  algorithmVersion: 'projected-knee-1'; configuration: typeof KNEE_CONFIGURATION;
  scientificValidation: 'not-validated';
  status: 'available' | 'partial' | 'unavailable'; reasons: KneeReason[];
  view: SideView | null; side: 'left' | 'right' | null;
  timestampProvenance: {
    method: string | null; actualDecodedFrameTimes: false;
    nominalIntervalMs: 100; usesStoredDifferences: true;
  };
  geometry: KneeGeometry | null;
  observations: KneeObservation[];
  segments: (TimeRange & { observationIndices: number[] })[];
  gaps: { afterMs: number; beforeMs: number; elapsedMs: number }[];
  timeRange: TimeRange | null; contributingTimeRange: TimeRange | null;
  quality: {
    expectedObservationCount: number | null; observedCount: number;
    contributingObservationCount: number; missingObservationCount: number | null;
    validObservedFraction: number | null; validExpectedFraction: number | null;
  };
};
const METHOD = 'requested-100ms-nearest-decoded-frame';
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const unique = (reasons: KneeReason[]) => [...new Set(reasons)];

/** Fail closed for other versions, absent/duplicate fields or invalid dimensions.
 * Decoded dimensions are already oriented. Do not rotate them using encoded metadata.
 * Reproduce native resize including integer truncation: landmarks use the resized bitmap.
 * Legacy diagnostics record only the last decoded size, not per-frame geometry.
 */
export function legacyKneeGeometry(session: Pick<Session, 'extractorVersion' | 'diagnostics'>): KneeGeometry | null {
  if (session.extractorVersion !== 'android-pose-0.1.1' || typeof session.diagnostics !== 'string') return null;
  if ((session.diagnostics.match(/\bdecoded\b/gi) ?? []).length !== 1) return null;
  const field = session.diagnostics.split(';').map(s => s.trim()).find(s => /^decoded\b/.test(s));
  const match = field?.match(/^decoded=([1-9]\d*)x([1-9]\d*)$/);
  if (!match) return null;
  const decodedWidth = Number(match[1]), decodedHeight = Number(match[2]);
  if (![decodedWidth, decodedHeight].every(Number.isSafeInteger)) return null;
  const scale = Math.min(1, 768 / Math.max(decodedWidth, decodedHeight));
  const inferenceWidth = Math.trunc(decodedWidth * scale);
  const inferenceHeight = Math.trunc(decodedHeight * scale);
  if (inferenceWidth < 1 || inferenceHeight < 1) return null;
  return { decodedWidth, decodedHeight, decodedAspectRatio: decodedWidth / decodedHeight,
    inferenceWidth, inferenceHeight, aspectRatio: inferenceWidth / inferenceHeight,
    source: 'android-pose-0.1.1-diagnostics', assumption: 'constant-decoded-dimensions-within-session' };
}

function quality(p: Landmark): LandmarkQuality {
  const reasons: KneeReason[] = [];
  if (![p.x, p.y, p.z].every(Number.isFinite)) reasons.push('non_finite_coordinate');
  if (![p.visibility, p.presence].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) {
    reasons.push('invalid_confidence');
  } else {
    if (p.visibility < KNEE_CONFIGURATION.minVisibility) reasons.push('low_visibility');
    if (p.presence < KNEE_CONFIGURATION.minPresence) reasons.push('low_presence');
  }
  if (Number.isFinite(p.x) && Number.isFinite(p.y) && (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) reasons.push('out_of_frame');
  return { index: p.index, valid: reasons.length === 0, reasons };
}

function flexion(hip: Landmark, knee: Landmark, ankle: Landmark, aspect: number): number | null {
  const ax = (hip.x - knee.x) * aspect, ay = hip.y - knee.y;
  const bx = (ankle.x - knee.x) * aspect, by = ankle.y - knee.y;
  const a = Math.hypot(ax, ay), b = Math.hypot(bx, by);
  if (Math.min(a, b) <= KNEE_CONFIGURATION.minimumVectorLength) return null;
  const cosine = (ax / a) * (bx / b) + (ay / a) * (by / b);
  const value = 180 - Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
  return Number.isFinite(value) ? value : null;
}

/** Accept parsed stored values. Never mutates, sorts, interpolates or fills inputs.
 * Session parsing reuses the app contract. Frame shape/time validation is separate
 * from parseFrames intentionally: bad numeric samples must remain visible in masks
 * instead of rejecting all observations or poisoning the unselected side.
 * Structural corruption fails the whole request; numeric quality fails per sample.
 */
export function analyzeKneeFlexion(sessionInput: unknown, framesInput: unknown,
  geometryInput?: ExplicitKneeGeometry | null): KneeResult {
  const result: KneeResult = {
    feature: 'selected-side-2d-projected-knee-flexion', units: 'degrees',
    algorithmVersion: 'projected-knee-1', configuration: KNEE_CONFIGURATION,
    scientificValidation: 'not-validated', status: 'unavailable', reasons: [],
    view: null, side: null,
    timestampProvenance: { method: null, actualDecodedFrameTimes: false, nominalIntervalMs: 100, usesStoredDifferences: true },
    geometry: null, observations: [], segments: [], gaps: [], timeRange: null, contributingTimeRange: null,
    quality: { expectedObservationCount: null, observedCount: 0, contributingObservationCount: 0,
      missingObservationCount: null, validObservedFraction: null, validExpectedFraction: null },
  };
  const fail = (reason: KneeReason) => { result.reasons = [reason]; return result; };
  if (!object(sessionInput)) return fail('invalid_session');
  if (typeof sessionInput.view !== 'string') return fail('invalid_session');
  if (sessionInput.view !== 'side_left' && sessionInput.view !== 'side_right') return fail('unsupported_view');
  result.view = sessionInput.view;
  result.side = result.view === 'side_left' ? 'left' : 'right';
  if (typeof sessionInput.timestampMethod === 'string') result.timestampProvenance.method = sessionInput.timestampMethod;
  if (sessionInput.timestampMethod !== METHOD) return fail('unsupported_timestamp_method');
  let session: Session;
  try {
    session = parseSession(JSON.stringify(sessionInput));
    if (!Number.isSafeInteger(session.createdAt) || session.createdAt < 0 ||
        !Number.isSafeInteger(session.durationMs) || typeof sessionInput.modelSha256 !== 'string' ||
        !session.extractorVersion.trim() || session.sampledFrames !== Math.ceil(session.durationMs / 100)) return fail('invalid_session');
  } catch { return fail('invalid_session'); }
  result.quality.expectedObservationCount = session.sampledFrames;
  if (!Array.isArray(framesInput) || framesInput.length > 160) return fail('invalid_frames');
  if (!framesInput.length) return fail('no_observations');
  if (framesInput.length !== session.poseFrames) return fail('frame_count_mismatch');
  let previous = -1;
  // Use indexed loops so sparse arrays cannot bypass validation.
  for (let n = 0; n < framesInput.length; n++) {
    const frame: unknown = framesInput[n];
    if (!object(frame)) return fail('invalid_frames');
    const t = frame.timestampMs;
    if (typeof t !== 'number' || !Number.isSafeInteger(t) || t < 0 || t >= session.durationMs) return fail('invalid_timestamp');
    if (t === previous) return fail('duplicate_timestamp');
    if (t < previous) return fail('decreasing_timestamp');
    previous = t;
    if (!Array.isArray(frame.landmarks) || frame.landmarks.length !== 33) return fail('invalid_frames');
    for (let i = 0; i < 33; i++) {
      const p: unknown = frame.landmarks[i];
      if (!object(p) || p.index !== i || !['x', 'y', 'z', 'visibility', 'presence'].every(k => typeof p[k] === 'number')) return fail('invalid_frames');
    }
  }
  const frames = framesInput as PoseFrame[];
  // Undefined preserves the legacy API. Explicit null forbids diagnostic fallback.
  result.geometry = geometryInput === undefined ? legacyKneeGeometry(session) :
    object(geometryInput) && geometryInput.source === 'caller-asserted-inference-dimensions' &&
    geometryInput.assumption === 'constant-inference-dimensions-within-session' &&
    Number.isSafeInteger(geometryInput.inferenceWidth) && geometryInput.inferenceWidth > 0 &&
    Number.isSafeInteger(geometryInput.inferenceHeight) && geometryInput.inferenceHeight > 0
      ? {...geometryInput, aspectRatio: geometryInput.inferenceWidth / geometryInput.inferenceHeight} : null;
  result.quality.observedCount = frames.length;
  result.quality.missingObservationCount = session.sampledFrames - frames.length;
  result.timeRange = { startMs: frames[0].timestampMs, endMs: frames[frames.length - 1].timestampMs };
  const indices = session.view === 'side_left' ? [23, 25, 27] : [24, 26, 28];
  if (!result.geometry) result.reasons.push('missing_geometry');
  if (result.quality.missingObservationCount > 0) result.reasons.push('missing_observations');
  let segment: KneeResult['segments'][number] | undefined;
  frames.forEach((frame, n) => {
    const delta = n ? frame.timestampMs - frames[n - 1].timestampMs : null;
    if (frame.timestampMs % 100 !== 0) result.reasons.push('irregular_sampling');
    if (delta !== null && delta > KNEE_CONFIGURATION.maxGapMs) {
      result.gaps.push({ afterMs: frames[n - 1].timestampMs, beforeMs: frame.timestampMs, elapsedMs: delta });
      result.reasons.push('timestamp_gap'); segment = undefined;
    }
    const points = indices.map(i => frame.landmarks[i]);
    const landmarkQuality = points.map(quality);
    const reasons = unique(landmarkQuality.flatMap(q => q.reasons));
    let value: number | null = null;
    if (!result.geometry) reasons.push('missing_geometry');
    if (!reasons.length && result.geometry) {
      value = flexion(points[0], points[1], points[2], result.geometry.aspectRatio);
      if (value === null) reasons.push('degenerate_geometry');
    }
    result.observations.push({ timestampMs: frame.timestampMs, deltaFromPreviousMs: delta,
      value, status: value === null ? 'unavailable' : 'available', reasons, landmarkQuality });
    result.reasons.push(...reasons);
    if (value === null) { segment = undefined; return; }
    result.quality.contributingObservationCount++;
    if (!segment) {
      segment = { startMs: frame.timestampMs, endMs: frame.timestampMs, observationIndices: [] };
      result.segments.push(segment);
    }
    segment.endMs = frame.timestampMs; segment.observationIndices.push(n);
    if (!result.contributingTimeRange) result.contributingTimeRange = { startMs: frame.timestampMs, endMs: frame.timestampMs };
    result.contributingTimeRange.endMs = frame.timestampMs;
  });
  result.reasons = unique(result.reasons);
  const count = result.quality.contributingObservationCount;
  result.quality.validObservedFraction = count / frames.length;
  result.quality.validExpectedFraction = count / session.sampledFrames;
  result.status = count === 0 ? 'unavailable' : result.reasons.length ? 'partial' : 'available';
  return result;
}
