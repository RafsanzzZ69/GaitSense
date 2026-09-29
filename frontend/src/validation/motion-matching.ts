/** Synthetic numerical matching only; no detector invocation, media IO or contact labels. */
export const MATCHING = Object.freeze({ algorithmVersion: 'motion-matching-1',
  configurationVersion: 'motion-match-100ms-1', toleranceMs: 100, plannedSlots: 30,
  protocol: 'GS-MOTION-REF-0.1-draft', protocolCommit: 'eecad8e79eb336746009d1b8c5be2379609a212f' });
type Polarity = 'maximum' | 'minimum';
type Side = 'left' | 'right';
export type ReferenceRegion = { id: string; startMs: number; endMs: number;
  status: 'evaluable' | 'ambiguous' | 'unavailable'; reason: string | null };
export type MatchingEvent = { id: string; participantId: string; attemptId: string; regionId: string;
  side: Side; polarity: Polarity; requestedMs: number; actualPtsMs: number | null;
  ptsMethod: 'unknown' | 'decoder'; imageId: string;
  status: 'scorable' | 'ambiguous' | 'unavailable'; reason: string | null };
export type MatchingAttempt = { id: string; participantId: string; view: 'side_left' | 'side_right'; side: Side;
  status: 'recorded' | 'failed'; reason: string | null; scoringStartMs: number | null;
  timestampMethod: 'requested-100ms-nearest-decoded-frame'; correspondence: 'asserted-exact-image';
  modelStatus: 'available' | 'partial' | 'insufficient_evidence' | 'unavailable';
  modelReason: string | null;
  regions: ReferenceRegion[];
  slots: { requestedMs: number | null; model: 'valid' | 'missing' | 'invalid'; reason: string | null }[];
  references: MatchingEvent[]; candidates: MatchingEvent[] };
export type MatchingManifest = { schemaVersion: 'synthetic-motion-matching-1'; evidenceKind: 'synthetic';
  algorithmVersion: 'motion-matching-1'; configurationVersion: 'motion-match-100ms-1'; attempts: MatchingAttempt[] };
export type MatchReason = 'invalid_shape' | 'unsupported_version' | 'invalid_id' | 'duplicate_id'
  | 'invalid_timestamp' | 'invalid_provenance' | 'unsupported_view' | 'side_mismatch'
  | 'ownership_mismatch' | 'invalid_region' | 'region_mismatch' | 'invalid_state'
  | 'invalid_slots' | 'duplicate_event' | 'identity_conflict' | 'unsupported_polarity';
export class MatchingInputError extends Error {
  code: MatchReason; path: string;
  constructor(code: MatchReason, path: string) { super(`${code}: ${path}`); this.code = code; this.path = path; }
}
function requireValue(ok: unknown, code: MatchReason, path: string): asserts ok {
  if (!ok) throw new MatchingInputError(code, path);
}
function shape(v: unknown, keys: string[], path: string): asserts v is Record<string, unknown> {
  requireValue(v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length &&
    keys.every(k => Object.hasOwn(v, k)), 'invalid_shape', path);
}
const id = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const time = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 16000;
const reason = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 500;
const lex = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const eventOrder = (a: MatchingEvent, b: MatchingEvent) => a.requestedMs - b.requestedMs || lex(a.id, b.id);

export function parseMatchingManifest(input: unknown): MatchingManifest {
  shape(input, ['schemaVersion', 'evidenceKind', 'algorithmVersion', 'configurationVersion', 'attempts'], 'manifest');
  requireValue(input.schemaVersion === 'synthetic-motion-matching-1' && input.evidenceKind === 'synthetic' &&
    input.algorithmVersion === MATCHING.algorithmVersion && input.configurationVersion === MATCHING.configurationVersion,
  'unsupported_version', 'manifest');
  requireValue(Array.isArray(input.attempts), 'invalid_shape', 'attempts');
  const ids = new Set<string>(), images = new Map<string, string>();
  function unique(v: unknown, path: string) {
    requireValue(id(v), 'invalid_id', path); requireValue(!ids.has(v as string), 'duplicate_id', path); ids.add(v as string);
  }
  for (let n = 0; n < input.attempts.length; n++) {
    const v: unknown = input.attempts[n], p = `attempts[${n}]`;
    shape(v, ['id', 'participantId', 'view', 'side', 'status', 'reason', 'scoringStartMs', 'timestampMethod',
      'correspondence', 'modelStatus', 'modelReason', 'regions', 'slots', 'references', 'candidates'], p);
    unique(v.id, `${p}.id`); requireValue(id(v.participantId), 'invalid_id', `${p}.participantId`);
    requireValue(['side_left', 'side_right'].includes(v.view as string), 'unsupported_view', p);
    requireValue(v.side === (v.view === 'side_left' ? 'left' : 'right'), 'side_mismatch', p);
    requireValue(v.timestampMethod === 'requested-100ms-nearest-decoded-frame' && v.correspondence === 'asserted-exact-image', 'invalid_provenance', p);
    requireValue(['recorded', 'failed'].includes(v.status as string) &&
      (v.status === 'failed' ? reason(v.reason) && v.scoringStartMs === null : v.reason === null && time(v.scoringStartMs) && v.scoringStartMs <= 13000 && v.scoringStartMs % 100 === 0), 'invalid_state', p);
    requireValue(['available', 'partial', 'insufficient_evidence', 'unavailable'].includes(v.modelStatus as string) &&
      (v.modelStatus === 'available' ? v.modelReason === null : reason(v.modelReason)), 'invalid_state', `${p}.modelStatus`);
    requireValue(Array.isArray(v.regions) && Array.isArray(v.slots) && Array.isArray(v.references) && Array.isArray(v.candidates), 'invalid_shape', p);
    const a = v as unknown as MatchingAttempt;
    requireValue(a.slots.length === MATCHING.plannedSlots, 'invalid_slots', `${p}.slots`);
    for (let s = 0; s < a.slots.length; s++) {
      const slot = a.slots[s]; shape(slot, ['requestedMs', 'model', 'reason'], `${p}.slots[${s}]`);
      requireValue(slot.requestedMs === (a.status === 'failed' ? null : a.scoringStartMs! + s * 100) &&
        ['valid', 'missing', 'invalid'].includes(slot.model) && (slot.model === 'valid' ? slot.reason === null : reason(slot.reason)), 'invalid_slots', `${p}.slots[${s}]`);
    }
    for (let r = 0; r < a.regions.length; r++) {
      const region = a.regions[r], path = `${p}.regions[${r}]`;
      shape(region, ['id', 'startMs', 'endMs', 'status', 'reason'], path); unique(region.id, path);
      requireValue(time(region.startMs) && time(region.endMs) && region.endMs > region.startMs &&
        ['evaluable', 'ambiguous', 'unavailable'].includes(region.status) &&
        (region.status === 'evaluable' ? region.reason === null : reason(region.reason)), 'invalid_region', path);
    }
    const regions = [...a.regions].sort((x, y) => x.startMs - y.startMs);
    if (a.status === 'recorded') requireValue(regions.length > 0 && regions[0].startMs === a.scoringStartMs &&
      regions.at(-1)!.endMs === a.scoringStartMs! + 3000 && regions.every((r, i) => !i || r.startMs === regions[i - 1].endMs), 'invalid_region', `${p}.regions`);
    else requireValue(!regions.length && !a.references.length && !a.candidates.length &&
      a.slots.every(s => s.model !== 'valid') && a.modelStatus === 'unavailable', 'invalid_state', p);
    if (a.modelStatus === 'unavailable') requireValue(!a.candidates.length, 'invalid_state', `${p}.candidates`);
    if (a.modelStatus === 'available') requireValue(a.slots.every(s => s.model === 'valid'), 'invalid_state', `${p}.slots`);
    for (const role of ['references', 'candidates'] as const) {
      requireValue(a[role].length <= 160, 'invalid_shape', `${p}.${role}`);
      const times = new Set<string>();
      for (let e = 0; e < a[role].length; e++) {
        const event = a[role][e], path = `${p}.${role}[${e}]`;
        shape(event, ['id', 'participantId', 'attemptId', 'regionId', 'side', 'polarity', 'requestedMs', 'actualPtsMs', 'ptsMethod', 'imageId', 'status', 'reason'], path);
        unique(event.id, path);
        requireValue(event.participantId === a.participantId && event.attemptId === a.id, 'ownership_mismatch', path);
        requireValue(event.side === a.side, 'side_mismatch', path);
        requireValue(['maximum', 'minimum'].includes(event.polarity), 'unsupported_polarity', path);
        requireValue(time(event.requestedMs), 'invalid_timestamp', path);
        if (role === 'candidates') {
          const center = a.slots.find(s => s.requestedMs === event.requestedMs);
          requireValue(!center || center.model === 'valid', 'invalid_state', path);
        }
        requireValue((event.actualPtsMs === null && event.ptsMethod === 'unknown') ||
          (typeof event.actualPtsMs === 'number' && Number.isFinite(event.actualPtsMs) && event.actualPtsMs >= 0 && event.ptsMethod === 'decoder'), 'invalid_provenance', path);
        requireValue(id(event.imageId), 'invalid_id', path);
        const imageSignature = JSON.stringify([a.participantId, a.id, event.actualPtsMs, event.ptsMethod]);
        requireValue(!images.has(event.imageId) || images.get(event.imageId) === imageSignature, 'identity_conflict', path); images.set(event.imageId, imageSignature);
        const region = regions.find(r => r.id === event.regionId);
        requireValue(region && event.requestedMs >= region.startMs && event.requestedMs < region.endMs, 'region_mismatch', path);
        requireValue(event.status === (region.status === 'evaluable' ? 'scorable' : region.status) &&
          (event.status === 'scorable' ? event.reason === null : reason(event.reason)), 'invalid_state', path);
        const key = `${event.polarity}:${event.requestedMs}`;
        requireValue(!times.has(key), 'duplicate_event', path); times.add(key);
      }
    }
  }
  return input as unknown as MatchingManifest;
}

export type EventPair = { referenceId: string; candidateId: string; referenceMs: number; candidateMs: number;
  signedErrorMs: number; absoluteErrorMs: number; regionId: string };
type Assignment = { pairs: EventPair[]; cost: number };
function better(a: Assignment, b: Assignment): Assignment {
  if (a.pairs.length !== b.pairs.length) return a.pairs.length > b.pairs.length ? a : b;
  if (a.cost !== b.cost) return a.cost < b.cost ? a : b;
  for (let i = 0; i < a.pairs.length; i++) {
    const x = a.pairs[i], y = b.pairs[i];
    const order = x.referenceMs - y.referenceMs || lex(x.referenceId, y.referenceId) ||
      x.candidateMs - y.candidateMs || lex(x.candidateId, y.candidateId);
    if (order) return order < 0 ? a : b;
  }
  return a;
}
function assign(references: MatchingEvent[], candidates: MatchingEvent[]): EventPair[] {
  const r = [...references].sort(eventOrder), c = [...candidates].sort(eventOrder);
  const dp: Assignment[][] = Array.from({ length: r.length + 1 }, () =>
    Array.from({ length: c.length + 1 }, () => ({ pairs: [], cost: 0 })));
  for (let i = r.length - 1; i >= 0; i--) for (let j = c.length - 1; j >= 0; j--) {
    let best = better(dp[i + 1][j], dp[i][j + 1]);
    const signed = c[j].requestedMs - r[i].requestedMs, absolute = Math.abs(signed);
    if (absolute <= MATCHING.toleranceMs) {
      const tail = dp[i + 1][j + 1];
      best = better(best, { cost: tail.cost + absolute, pairs: [{ referenceId: r[i].id, candidateId: c[j].id,
        referenceMs: r[i].requestedMs, candidateMs: c[j].requestedMs, signedErrorMs: signed,
        absoluteErrorMs: absolute, regionId: r[i].regionId }, ...tail.pairs] });
    }
    dp[i][j] = best;
  }
  return dp[0][0].pairs;
}
const ratio = (n: number, d: number) => d ? n / d : null;
export function matchSyntheticMotionEvents(input: unknown) {
  const manifest = parseMatchingManifest(input);
  const attempts = [...manifest.attempts].sort((a, b) => lex(a.participantId, b.participantId) || lex(a.id, b.id)).map(a => {
    const regionFor = (t: number) => a.regions.find(r => t >= r.startMs && t < r.endMs);
    const Q = a.slots.filter(s => s.requestedMs !== null && regionFor(s.requestedMs)?.status === 'evaluable').length;
    const V = a.slots.filter(s => s.model === 'valid' && s.requestedMs !== null && regionFor(s.requestedMs)?.status === 'evaluable').length;
    const polarities = (['maximum', 'minimum'] as const).map(polarity => {
      const references = a.references.filter(e => e.polarity === polarity).sort(eventOrder);
      const candidates = a.candidates.filter(e => e.polarity === polarity).sort(eventOrder);
      const r = references.filter(e => e.status === 'scorable'), c = candidates.filter(e => e.status === 'scorable');
      const pairs = [...a.regions].sort((x, y) => x.startMs - y.startMs).flatMap(region => region.status === 'evaluable'
        ? assign(r.filter(e => e.regionId === region.id), c.filter(e => e.regionId === region.id)) : []);
      const refIds = new Set(pairs.map(p => p.referenceId)), candIds = new Set(pairs.map(p => p.candidateId));
      const absolute = pairs.map(p => p.absoluteErrorMs).sort((x, y) => x - y);
      const T = pairs.length, R = r.length, D = c.length;
      return { polarity, status: Q === 0 ? 'unavailable' : T === 0 ? 'insufficient_evidence' : 'available',
        counts: { S: 30, Q, V, R, D, T, misses: R - T, extras: D - T },
        coverage: { reference: Q / 30, jointSignal: V / 30, conditionalSignal: ratio(V, Q) },
        recall: ratio(T, R), precision: ratio(T, D), pairs,
        missed: r.filter(e => !refIds.has(e.id)), extra: c.filter(e => !candIds.has(e.id)),
        unscorableReferences: references.filter(e => e.status !== 'scorable'),
        unscorableCandidates: candidates.filter(e => e.status !== 'scorable'),
        timing: { maeMs: T ? absolute.reduce((s, v) => s + v, 0) / T : null,
          biasMs: T ? pairs.reduce((s, p) => s + p.signedErrorMs, 0) / T : null,
          medianAbsoluteMs: T ? absolute[Math.ceil(T * .5) - 1] : null,
          p95AbsoluteMs: T ? absolute[Math.ceil(T * .95) - 1] : null, maximumAbsoluteMs: T ? absolute[T - 1] : null } };
    });
    return { participantId: a.participantId, attemptId: a.id, side: a.side, view: a.view,
      attemptStatus: a.status, reason: a.reason, modelStatus: a.modelStatus, modelReason: a.modelReason,
      regions: [...a.regions].sort((x, y) => x.startMs - y.startMs), slots: a.slots.map(s => ({ ...s })), polarities };
  });
  return { evidenceKind: 'synthetic' as const, configuration: MATCHING,
    scientificDecision: 'NOT_EVALUATED' as const, scientificValidation: 'not-validated' as const,
    authenticity: 'not-established' as const,
    timestampProvenance: { method: 'requested-100ms-nearest-decoded-frame', matchingClock: 'requested', actualPtsUsedForMatching: false }, attempts };
}
