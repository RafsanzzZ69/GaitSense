import {parseSession} from './contract.ts';
import type {Session, PoseFrame} from './contract.ts';
import type {ExplicitKneeGeometry} from './knee-flexion.ts';
import {analyzeSavedSession} from './session-analysis.ts';

export const SAVED_PAYLOAD_ADAPTER_VERSION = 'saved-payload-analysis-1';
export type BoundSavedRead = {sessionId: string} & (
  {status: 'loaded'; payload: string} | {status: 'failed'; reason: string});
export type SavedAnalysisSetup = {
  geometry?: ExplicitKneeGeometry | null;
  direction?: 1 | -1 | null;
  upright?: boolean;
  participantId?: string | null;
  attemptId?: string | null;
  continuity?: 'detector-segments' | 'unknown';
};
export type SavedPayloadRequest = {
  selectedSessionId: string;
  sessionRead: BoundSavedRead;
  framesRead: BoundSavedRead;
  setup?: SavedAnalysisSetup;
};
// Resource bounds on JSON text, in UTF-16 code units; native frame limit is 160.
export const SAVED_PAYLOAD_LIMITS = Object.freeze({sessionText: 16384, frameText: 2097152, frames: 160});
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const owner = (v: unknown) => v === undefined || v === null || typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);

/** Pure boundary for native JSON reads. Binding is caller evidence, not authentication.
 * Does not sort, repair, interpolate, reconstruct missing frames or interpret diagnostics.
 */
export function analyzeSavedPayload(request: unknown) {
  let session: Session | null = null;
  let loadedCount: number | null = null;
  const base = {adapterVersion: SAVED_PAYLOAD_ADAPTER_VERSION, scientificStatus: 'NOT_EVALUATED' as const};
  const fail = (status: 'incompatible' | 'load-failed', reason: string, detail: string | null = null) => ({
    ...base, status, reasons: [reason], detail, session, loadedCount, analysis: null,
  });
  if (!object(request) || typeof request.selectedSessionId !== 'string' || !request.selectedSessionId)
    return fail('incompatible', 'invalid_request');
  for (const [name, limit] of [['session', SAVED_PAYLOAD_LIMITS.sessionText], ['frames', SAVED_PAYLOAD_LIMITS.frameText]] as const) {
    const read = request[`${name}Read`];
    if (!object(read)) return fail('incompatible', `invalid_${name}_read`);
    if (read.sessionId !== request.selectedSessionId) return fail('incompatible', 'session_identity_mismatch');
    if (read.status === 'failed' && typeof read.reason === 'string' && read.reason.trim())
      return fail('load-failed', `${name}_load_failed`, read.reason);
    if (read.status !== 'loaded' || typeof read.payload !== 'string') return fail('incompatible', `invalid_${name}_read`);
    if (read.payload.length > limit) return fail('incompatible', `${name}_payload_too_large`);
  }
  const sessionRead = request.sessionRead as BoundSavedRead & {payload: string};
  const framesRead = request.framesRead as BoundSavedRead & {payload: string};
  try { session = parseSession(sessionRead.payload); } catch { return fail('incompatible', 'invalid_session'); }
  if (session.id !== request.selectedSessionId) return fail('incompatible', 'session_identity_mismatch');
  if (!Number.isSafeInteger(session.createdAt) || session.createdAt < 0 || !Number.isSafeInteger(session.durationMs) ||
      typeof session.modelSha256 !== 'string' || !session.extractorVersion.trim() ||
      session.sampledFrames !== Math.ceil(session.durationMs / 100)) return fail('incompatible', 'invalid_session_counts_or_metadata');
  let frames: unknown;
  try { frames = JSON.parse(framesRead.payload); } catch { return fail('incompatible', 'malformed_frames_json'); }
  if (!Array.isArray(frames) || frames.length > SAVED_PAYLOAD_LIMITS.frames) return fail('incompatible', 'invalid_frames');
  loadedCount = frames.length;
  if (loadedCount !== session.poseFrames) return fail('incompatible', 'frame_count_mismatch');
  let previous = -1;
  const seen = new Set<number>();
  for (const frame of frames) {
    if (!object(frame)) return fail('incompatible', 'invalid_frame');
    const t = frame.timestampMs;
    if (typeof t !== 'number' || !Number.isSafeInteger(t) || t < 0 || t >= session.durationMs)
      return fail('incompatible', 'invalid_timestamp');
    if (seen.has(t)) return fail('incompatible', 'duplicate_timestamp');
    if (t < previous) return fail('incompatible', 'decreasing_timestamp');
    seen.add(t); previous = t;
    if (!Array.isArray(frame.landmarks) || frame.landmarks.length !== 33) return fail('incompatible', 'invalid_landmarks');
    for (let i = 0; i < 33; i++) {
      const p: unknown = frame.landmarks[i];
      if (!object(p) || p.index !== i || !['x', 'y', 'z', 'visibility', 'presence'].every(k => typeof p[k] === 'number' && Number.isFinite(p[k])))
        return fail('incompatible', 'invalid_landmark_record');
      if ((p.visibility as number) < 0 || (p.visibility as number) > 1 || (p.presence as number) < 0 || (p.presence as number) > 1)
        return fail('incompatible', 'invalid_landmark_confidence');
    }
  }
  const setup = request.setup === undefined ? {} : request.setup;
  if (!object(setup) || !owner(setup.participantId) || !owner(setup.attemptId) ||
      (setup.direction !== undefined && setup.direction !== null && setup.direction !== 1 && setup.direction !== -1) ||
      (setup.upright !== undefined && typeof setup.upright !== 'boolean') ||
      (setup.continuity !== undefined && setup.continuity !== 'unknown' && setup.continuity !== 'detector-segments'))
    return fail('incompatible', 'invalid_setup');
  // Geometry is validated by the knee engine and never falls back to diagnostics.
  // Copy only recognized geometry fields; arbitrary extras cannot establish evidence.
  const g = setup.geometry;
  const geometry = object(g) ? {inferenceWidth: g.inferenceWidth, inferenceHeight: g.inferenceHeight,
    source: g.source, assumption: g.assumption} as ExplicitKneeGeometry : null;
  const typedSetup = setup as SavedAnalysisSetup;
  const analysis = analyzeSavedSession({session, frames: frames as PoseFrame[], geometry,
    context: {sessionId: session.id, view: session.view, side: session.view === 'side_left' ? 'left' : 'right',
      participantId: typedSetup.participantId ?? null, attemptId: typedSetup.attemptId ?? null,
      direction: typedSetup.direction ?? null, upright: typedSetup.upright === true,
      continuity: typedSetup.continuity ?? 'unknown'},
    processing: {status: 'completed', reason: null}});
  return {...base, status: analysis.status, reasons: analysis.reasons, detail: null, session, loadedCount, analysis,
    binding: {selectedSessionId: request.selectedSessionId, sessionReadId: sessionRead.sessionId,
      framesReadId: framesRead.sessionId, verification: 'caller-bound-ids-only' as const},
    counts: {sampled: session.sampledFrames, declaredPoses: session.poseFrames, loaded: loadedCount,
      omittedAtExtraction: session.sampledFrames - loadedCount},
    setupProvenance: {geometry: geometry ? 'caller-supplied' : 'not-supplied',
      direction: typedSetup.direction == null ? 'not-supplied' : 'caller-asserted',
      upright: typedSetup.upright === true ? 'caller-asserted' : 'not-confirmed',
      ownership: 'caller-supplied-or-null', continuity: typedSetup.continuity ?? 'unknown'},
  };
}
