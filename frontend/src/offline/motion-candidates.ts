import { parseSession } from './contract.ts';
import type { PoseFrame, Session } from './contract.ts';

export const MOTION_CONFIGURATION = Object.freeze({ version: 'ankle-motion-quality-1',
  confidence: .6, maxGapMs: 100, supportMs: 200, minimumProminence: .02,
  minimumSeparationMs: 400, interpolation: 'none' as const });
export type MotionReason = 'invalid_session' | 'invalid_frames' | 'unsupported_view'
  | 'direction_required' | 'upright_required' | 'unsupported_timestamp_method'
  | 'invalid_timestamp' | 'duplicate_timestamp' | 'decreasing_timestamp'
  | 'frame_count_mismatch' | 'no_observations' | 'non_finite_coordinate'
  | 'invalid_confidence' | 'low_visibility' | 'low_presence' | 'out_of_frame'
  | 'missing_observations' | 'timestamp_gap' | 'irregular_sampling'
  | 'boundary_support' | 'ambiguous_plateau' | 'low_prominence' | 'separation'
  | 'insufficient_repetition';
export type MotionObservation = { timestampMs: number; deltaMs: number | null;
  value: number | null; reasons: MotionReason[];
  landmarkQuality: { index: number; reasons: MotionReason[] }[] };
export type MotionCandidate = { timestampMs: number; observationIndex: number; segmentIndex: number;
  side: 'left' | 'right'; kind: 'maximum' | 'minimum'; signalPosition: number;
  prominence: number; supportStartMs: number; supportEndMs: number; minimumConfidence: number };
export type MotionResult = {
  algorithmVersion: 'ankle-motion-extrema-1'; configuration: typeof MOTION_CONFIGURATION;
  scientificValidation: 'not-validated'; eventMeaning: 'candidate-motion-extremum';
  status: 'available' | 'partial' | 'insufficient_evidence' | 'unavailable';
  side: 'left' | 'right' | null; direction: 1 | -1 | null; units: 'normalized-image-width';
  timestampProvenance: { method: string | null; actualDecodedFrameTimes: false; usesStoredDifferences: true };
  reasons: MotionReason[]; observations: MotionObservation[]; candidates: MotionCandidate[];
  exclusions: { observationIndex: number; reason: MotionReason }[];
  segments: number[][]; gaps: { afterMs: number; beforeMs: number }[];
  quality: { expectedCount: number | null; observedCount: number; validCount: number;
    missingCount: number | null; validObservedFraction: number | null; validExpectedFraction: number | null };
};
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const unique = <T,>(values: T[]) => [...new Set(values)];

/** Direction +1 means increasing image x; -1 decreasing x. Caller must establish
 * upright geometry and one travel direction for the analyzed recording; side is NOT direction. */
export function detectMotionCandidates(sessionInput: unknown, framesInput: unknown,
  setup: { direction: 1 | -1; upright: true }): MotionResult {
  const result: MotionResult = { algorithmVersion: 'ankle-motion-extrema-1', configuration: MOTION_CONFIGURATION,
    scientificValidation: 'not-validated', eventMeaning: 'candidate-motion-extremum', status: 'unavailable',
    side: null, direction: null, units: 'normalized-image-width',
    timestampProvenance: { method: null, actualDecodedFrameTimes: false, usesStoredDifferences: true },
    reasons: [], observations: [], candidates: [], exclusions: [], segments: [], gaps: [],
    quality: { expectedCount: null, observedCount: 0, validCount: 0, missingCount: null,
      validObservedFraction: null, validExpectedFraction: null } };
  const fail = (reason: MotionReason) => { result.reasons = [reason]; return result; };
  if (!object(sessionInput)) return fail('invalid_session');
  if (!['side_left', 'side_right'].includes(sessionInput.view as string)) return fail('unsupported_view');
  result.side = sessionInput.view === 'side_left' ? 'left' : 'right';
  if (!setup || ![1, -1].includes(setup.direction)) return fail('direction_required');
  if (setup.upright !== true) return fail('upright_required');
  result.direction = setup.direction;
  result.timestampProvenance.method = typeof sessionInput.timestampMethod === 'string' ? sessionInput.timestampMethod : null;
  if (sessionInput.timestampMethod !== 'requested-100ms-nearest-decoded-frame') return fail('unsupported_timestamp_method');
  let session: Session;
  try {
    session = parseSession(JSON.stringify(sessionInput));
    if (!Number.isSafeInteger(session.createdAt) || session.createdAt < 0 || !Number.isSafeInteger(session.durationMs) ||
      !session.extractorVersion.trim() || session.sampledFrames !== Math.ceil(session.durationMs / 100)) return fail('invalid_session');
  } catch { return fail('invalid_session'); }
  result.quality.expectedCount = session.sampledFrames;
  if (!Array.isArray(framesInput) || framesInput.length > 160) return fail('invalid_frames');
  if (!framesInput.length) return fail('no_observations');
  if (framesInput.length !== session.poseFrames) return fail('frame_count_mismatch');
  let previous = -1;
  for (let n = 0; n < framesInput.length; n++) {
    const f: unknown = framesInput[n];
    if (!object(f)) return fail('invalid_frames');
    const t = f.timestampMs;
    if (typeof t !== 'number' || !Number.isSafeInteger(t) || t < 0 || t >= session.durationMs) return fail('invalid_timestamp');
    if (t === previous) return fail('duplicate_timestamp');
    if (t < previous) return fail('decreasing_timestamp');
    previous = t;
    if (!Array.isArray(f.landmarks) || f.landmarks.length !== 33) return fail('invalid_frames');
    for (let i = 0; i < 33; i++) {
      const p: unknown = f.landmarks[i];
      if (!object(p) || p.index !== i || !['x', 'y', 'z', 'visibility', 'presence'].every(k => typeof p[k] === 'number')) return fail('invalid_frames');
    }
  }
  const frames = framesInput as PoseFrame[], cfg = MOTION_CONFIGURATION;
  const ankle = result.side === 'left' ? 27 : 28, required = [23, 24, ankle];
  let segment: number[] | undefined;
  frames.forEach((f, n) => {
    const delta = n ? f.timestampMs - frames[n - 1].timestampMs : null;
    if (f.timestampMs % 100 || (delta !== null && delta !== 100)) result.reasons.push('irregular_sampling');
    if (delta !== null && delta > cfg.maxGapMs) {
      result.gaps.push({ afterMs: frames[n - 1].timestampMs, beforeMs: f.timestampMs });
      result.reasons.push('timestamp_gap'); segment = undefined;
    }
    const landmarkQuality = required.map(index => {
      const p = f.landmarks[index], reasons: MotionReason[] = [];
      if (![p.x, p.y, p.z].every(Number.isFinite)) reasons.push('non_finite_coordinate');
      if (![p.visibility, p.presence].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) reasons.push('invalid_confidence');
      else { if (p.visibility < cfg.confidence) reasons.push('low_visibility'); if (p.presence < cfg.confidence) reasons.push('low_presence'); }
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) reasons.push('out_of_frame');
      return { index, reasons };
    });
    const reasons = unique(landmarkQuality.flatMap(q => q.reasons));
    const value = reasons.length ? null : setup.direction * (f.landmarks[ankle].x - (f.landmarks[23].x + f.landmarks[24].x) / 2);
    result.observations.push({ timestampMs: f.timestampMs, deltaMs: delta, value, reasons, landmarkQuality });
    result.reasons.push(...reasons);
    if (value === null) { segment = undefined; return; }
    result.quality.validCount++;
    if (!segment) { segment = []; result.segments.push(segment); }
    segment.push(n);
  });
  const obs = result.observations;
  result.segments.forEach((indices, segmentIndex) => {
    const possible: MotionCandidate[] = [];
    indices.forEach((index, position) => {
      const o = obs[index], t = o.timestampMs, value = o.value!;
      const exclude = (reason: MotionReason) => result.exclusions.push({ observationIndex: index, reason });
      if (position === 0 || position === indices.length - 1) { exclude('boundary_support'); return; }
      const before = obs[indices[position - 1]].value!, after = obs[indices[position + 1]].value!;
      if (value === before || value === after) { exclude('ambiguous_plateau'); return; }
      const kind = value > before && value > after ? 'maximum' : value < before && value < after ? 'minimum' : null;
      if (!kind) return;
      // Nearest samples at least supportMs away bound both sides. No interpolation.
      let left = position - 1, right = position + 1;
      while (left > 0 && t - obs[indices[left]].timestampMs < cfg.supportMs) left--;
      while (right < indices.length - 1 && obs[indices[right]].timestampMs - t < cfg.supportMs) right++;
      if (t - obs[indices[left]].timestampMs < cfg.supportMs || obs[indices[right]].timestampMs - t < cfg.supportMs) { exclude('boundary_support'); return; }
      const sign = kind === 'maximum' ? 1 : -1;
      const l = indices.slice(left, position).map(i => sign * obs[i].value!);
      const r = indices.slice(position + 1, right + 1).map(i => sign * obs[i].value!);
      const prominence = Math.min(sign * value - Math.min(...l), sign * value - Math.min(...r));
      if (prominence < cfg.minimumProminence) { exclude('low_prominence'); return; }
      const support = indices.slice(left, right + 1);
      possible.push({ timestampMs: t, observationIndex: index, segmentIndex, side: result.side!, kind,
        signalPosition: value, prominence, supportStartMs: obs[indices[left]].timestampMs,
        supportEndMs: obs[indices[right]].timestampMs,
        minimumConfidence: Math.min(...support.flatMap(i => required.flatMap(j => [frames[i].landmarks[j].visibility, frames[i].landmarks[j].presence]))) });
    });
    // Same-polarity suppression only: strongest local prominence first, earlier on ties.
    const kept: MotionCandidate[] = [];
    possible.sort((a, b) => b.prominence - a.prominence || a.timestampMs - b.timestampMs).forEach(c => {
      if (kept.some(k => k.kind === c.kind && Math.abs(k.timestampMs - c.timestampMs) < cfg.minimumSeparationMs))
        result.exclusions.push({ observationIndex: c.observationIndex, reason: 'separation' });
      else kept.push(c);
    });
    result.candidates.push(...kept);
  });
  result.candidates.sort((a, b) => a.timestampMs - b.timestampMs);
  result.quality.observedCount = frames.length;
  result.quality.missingCount = session.sampledFrames - frames.length;
  result.quality.validObservedFraction = result.quality.validCount / frames.length;
  result.quality.validExpectedFraction = result.quality.validCount / session.sampledFrames;
  if (result.quality.missingCount) result.reasons.push('missing_observations');
  const repeated = result.candidates.some(c => result.candidates.some(other => other !== c && other.segmentIndex === c.segmentIndex && other.kind === c.kind));
  if (!repeated) result.reasons.push('insufficient_repetition');
  result.reasons = unique(result.reasons);
  result.status = !result.quality.validCount ? 'unavailable' : !repeated ? 'insufficient_evidence' : result.reasons.length ? 'partial' : 'available';
  return result;
}
