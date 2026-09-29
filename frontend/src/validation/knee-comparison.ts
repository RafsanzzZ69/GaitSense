/** Offline, synthetic-only implementation of GS-KNEE-2D-0.1-draft.
 * No media IO, inference, clinical interpretation or real-evidence approval path.
 */
export const EVALUATION = Object.freeze({
  version: 'knee-comparison-1', protocol: 'GS-KNEE-2D-0.1-draft',
  protocolCommit: 'c8fcfec2282702e9ab0bd9e819306d49241a641a',
  algorithm: 'projected-knee-1', featureConfiguration: 'knee-quality-1',
  slotsPerAttempt: 20, completeMatches: 15, participants: 10, trialsPerParticipant: 3,
  bootstrapDraws: 2000, seed: 20260929, randomGenerator: 'mulberry32-v1',
  mae: 5, bias: 3, p95: 10, Y: .9, E: .75, C: .8, F: .8,
});
type Side = 'side_left' | 'side_right';
type Point = [number, number];
export type Annotation = {
  id: string; observerId: string; toolVersion: string; imageId: string;
  points: [Point, Point, Point] | null; reason: string | null;
};
export type ImageIdentity = {
  id: string; sourceSha256: string; frameId: string; bitmapSha256: string;
  width: number; height: number; actualPtsMs: number | null;
};
export type ValidationSlot = {
  id: string; ordinal: number; requestedTimestampMs: number | null;
  image: ImageIdentity | null;
  reference: {
    status: 'available' | 'missing' | 'excluded'; angleDegrees: number | null;
    imageId: string | null; reason: string | null;
    annotations: Annotation[]; adjudication: Annotation | null;
  };
  model: {
    status: 'available' | 'unavailable'; angleDegrees: number | null;
    imageId: string | null; reason: string | null;
  };
};
export type ValidationAttempt = {
  id: string; trialId: string; status: 'recorded' | 'failed'; reason: string | null;
  capture: { view: Side; device: string; protocolVersion: string; timestampMethod: 'requested-100ms-nearest-decoded-frame' };
  slots: ValidationSlot[];
};
export type ValidationParticipant = {
  id: string; partition: 'pilot' | 'evaluation'; plannedTrialIds: string[];
  attempts: ValidationAttempt[];
};
export type ValidationManifest = {
  schemaVersion: 'knee-validation-manifest-1'; evidenceKind: 'synthetic'; units: 'degrees';
  evaluationVersion: 'knee-comparison-1'; algorithmVersion: 'projected-knee-1';
  configurationVersion: 'knee-quality-1';
  /** Scenario inputs only: never assertions about actual approval/reference readiness. */
  simulatedPrerequisites: { approvals: boolean; software: boolean; referenceReadiness: boolean };
  participants: ValidationParticipant[];
};

function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid synthetic validation manifest: ${message}`);
}
function record(value: unknown, keys: string[], label: string): asserts value is Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), label);
  requireValue(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), `${label} fields`);
}
const id = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 500;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const angle = (v: unknown) => finite(v) && v >= 0 && v <= 180;
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const time = (v: unknown) => v === null || (finite(v) && v >= 0);

/** Independent reference geometry in isotropic image pixels; not the engine formula. */
export function referenceAngle(points: [Point, Point, Point]): number | null {
  if (!Array.isArray(points) || points.length !== 3 ||
      !Array.from(points).every(p => Array.isArray(p) && p.length === 2 && Array.from(p).every(finite))) return null;
  const [h, k, a] = points;
  if (Math.hypot(h[0] - k[0], h[1] - k[1]) <= 1e-12 ||
      Math.hypot(a[0] - k[0], a[1] - k[1]) <= 1e-12) return null;
  const delta = Math.atan2(h[1] - k[1], h[0] - k[0]) - Math.atan2(a[1] - k[1], a[0] - k[0]);
  return 180 - Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) * 180 / Math.PI;
}

/** Strict shape validation, globally unique record IDs and exact image joins.
 * Repeated source frames are allowed only with identical identity metadata and
 * explicitly remain scheduled slots; computation excludes later duplicates from R/M.
 */
export function parseValidationManifest(input: unknown): ValidationManifest {
  record(input, ['schemaVersion', 'evidenceKind', 'units', 'evaluationVersion', 'algorithmVersion',
    'configurationVersion', 'simulatedPrerequisites', 'participants'], 'manifest');
  requireValue(input.schemaVersion === 'knee-validation-manifest-1' && input.evidenceKind === 'synthetic' &&
    input.units === 'degrees' && input.evaluationVersion === EVALUATION.version &&
    input.algorithmVersion === EVALUATION.algorithm && input.configurationVersion === EVALUATION.featureConfiguration, 'versions/units/evidenceKind');
  record(input.simulatedPrerequisites, ['approvals', 'software', 'referenceReadiness'], 'simulatedPrerequisites');
  requireValue(Object.values(input.simulatedPrerequisites).every(v => typeof v === 'boolean'), 'prerequisites');
  requireValue(Array.isArray(input.participants), 'participants');
  const ids = new Set<string>();
  const uniqueId = (v: unknown) => { requireValue(id(v) && !ids.has(v as string), `duplicate or malformed id ${String(v)}`); ids.add(v as string); };
  const images = new Map<string, string>(), frameIds = new Map<string, string>();
  const bitmapIdentities = new Map<string, string>();
  const sourceOwners = new Map<string, string>(), bitmapOwners = new Map<string, string>();
  for (const participant of input.participants) {
    record(participant, ['id', 'partition', 'plannedTrialIds', 'attempts'], 'participant');
    uniqueId(participant.id);
    requireValue(['pilot', 'evaluation'].includes(participant.partition as string), 'partition');
    requireValue(Array.isArray(participant.plannedTrialIds) && participant.plannedTrialIds.length === 3, 'three planned trial records required');
    participant.plannedTrialIds.forEach(uniqueId);
    requireValue(Array.isArray(participant.attempts), 'attempts');
    const takes = new Map<string, number>();
    let participantSide: string | undefined;
    for (const attempt of participant.attempts) {
      record(attempt, ['id', 'trialId', 'status', 'reason', 'capture', 'slots'], 'attempt'); uniqueId(attempt.id);
      requireValue(participant.plannedTrialIds.includes(attempt.trialId), 'unplanned trial');
      const takeCount = (takes.get(attempt.trialId as string) ?? 0) + 1;
      takes.set(attempt.trialId as string, takeCount); requireValue(takeCount <= 2, 'more than one replacement');
      requireValue(attempt.status === 'recorded' || attempt.status === 'failed', 'attempt status');
      requireValue(attempt.status === 'failed' ? text(attempt.reason) : attempt.reason === null, 'attempt reason');
      record(attempt.capture, ['view', 'device', 'protocolVersion', 'timestampMethod'], 'capture');
      requireValue(['side_left', 'side_right'].includes(attempt.capture.view as string), 'unsupported view');
      requireValue(participantSide === undefined || participantSide === attempt.capture.view, 'participant side changed');
      participantSide = attempt.capture.view as string;
      requireValue(text(attempt.capture.device) && text(attempt.capture.protocolVersion) &&
        attempt.capture.timestampMethod === 'requested-100ms-nearest-decoded-frame', 'capture provenance');
      requireValue(Array.isArray(attempt.slots) && attempt.slots.length === 20, 'exactly 20 planned slots required');
      let previousTime = -1;
      let attemptSource: string | undefined;
      for (let n = 0; n < attempt.slots.length; n++) {
        const slot = attempt.slots[n];
        record(slot, ['id', 'ordinal', 'requestedTimestampMs', 'image', 'reference', 'model'], 'slot'); uniqueId(slot.id);
        requireValue(slot.ordinal === n && time(slot.requestedTimestampMs), 'slot order/time');
        if (slot.requestedTimestampMs !== null) {
          requireValue((slot.requestedTimestampMs as number) > previousTime, 'nonincreasing requested time');
          previousTime = slot.requestedTimestampMs as number;
        }
        if (slot.image !== null) {
          record(slot.image, ['id', 'sourceSha256', 'frameId', 'bitmapSha256', 'width', 'height', 'actualPtsMs'], 'image');
          const im = slot.image;
          requireValue(id(im.id) && id(im.frameId) && hash(im.sourceSha256) && hash(im.bitmapSha256) &&
            Number.isSafeInteger(im.width) && (im.width as number) > 0 &&
            Number.isSafeInteger(im.height) && (im.height as number) > 0 && time(im.actualPtsMs), 'image identity/geometry');
          requireValue(slot.requestedTimestampMs !== null, 'image without requested time');
          requireValue(attemptSource === undefined || attemptSource === im.sourceSha256, 'multiple source recordings in one attempt');
          attemptSource = im.sourceSha256 as string;
          for (const [map, key] of [[sourceOwners, im.sourceSha256], [bitmapOwners, im.bitmapSha256]] as const) {
            requireValue(!map.has(key as string) || map.get(key as string) === attempt.id, 'content crosses participant/partition/attempt');
            map.set(key as string, attempt.id as string);
          }
          const signature = JSON.stringify([im.sourceSha256, im.frameId, im.bitmapSha256, im.width, im.height, im.actualPtsMs]);
          requireValue(!images.has(im.id as string) || images.get(im.id as string) === signature, 'ambiguous image id');
          images.set(im.id as string, signature);
          const frameKey = `${im.sourceSha256}:${im.frameId}`;
          requireValue(!frameIds.has(frameKey) || frameIds.get(frameKey) === im.id, 'source frame has conflicting image ids');
          frameIds.set(frameKey, im.id as string);
          requireValue(!bitmapIdentities.has(im.bitmapSha256 as string) || bitmapIdentities.get(im.bitmapSha256 as string) === im.id,
            'identical bitmap has ambiguous frame identity');
          bitmapIdentities.set(im.bitmapSha256 as string, im.id as string);
        }
        record(slot.reference, ['status', 'angleDegrees', 'imageId', 'reason', 'annotations', 'adjudication'], 'reference');
        record(slot.model, ['status', 'angleDegrees', 'imageId', 'reason'], 'model');
        const r = slot.reference, m = slot.model;
        requireValue(['available', 'missing', 'excluded'].includes(r.status as string) &&
          ['available', 'unavailable'].includes(m.status as string), 'measurement status');
        for (const value of [r, m]) {
          requireValue(value.imageId === null || (slot.image !== null && value.imageId === slot.image.id), 'exact image mismatch');
          requireValue(value.status === 'available'
            ? angle(value.angleDegrees) && value.reason === null && slot.image !== null && value.imageId === slot.image.id
            : value.angleDegrees === null && text(value.reason), 'value/status contradiction');
        }
        requireValue(Array.isArray(r.annotations) && (r.annotations.length === 0 || r.annotations.length === 2), 'dual annotation required');
        const observerIds = new Set<string>();
        const annotatedAngles: (number | null)[] = [];
        for (const annotation of [...r.annotations, ...(r.adjudication === null ? [] : [r.adjudication])]) {
          record(annotation, ['id', 'observerId', 'toolVersion', 'imageId', 'points', 'reason'], 'annotation'); uniqueId(annotation.id);
          requireValue(id(annotation.observerId) && !observerIds.has(annotation.observerId as string) && text(annotation.toolVersion), 'independent observers');
          observerIds.add(annotation.observerId as string);
          requireValue(slot.image !== null && annotation.imageId === slot.image.id, 'annotation image mismatch');
          if (annotation.points === null) { requireValue(text(annotation.reason), 'annotation missing reason'); annotatedAngles.push(null); }
          else {
            const points = annotation.points as [Point, Point, Point];
            const value = referenceAngle(points);
            const image = slot.image as unknown as ImageIdentity;
            requireValue(value !== null && annotation.reason === null && points.every(p =>
              p[0] >= 0 && p[0] < image.width && p[1] >= 0 && p[1] < image.height), 'annotation geometry');
            annotatedAngles.push(value);
          }
        }
        requireValue(r.adjudication === null || r.annotations.length === 2, 'adjudication without independent pair');
        if (r.status === 'available') {
          requireValue(r.annotations.length === 2, 'available reference without dual annotation');
          const [a, b, adjudicated] = annotatedAngles;
          const needsReview = a === null || b === null || Math.abs(a - b) > 5;
          requireValue(needsReview ? r.adjudication !== null && adjudicated !== null : r.adjudication === null, 'adjudication rule');
          const expected = needsReview ? adjudicated : ((a as number) + (b as number)) / 2;
          requireValue(expected !== undefined && expected !== null && Math.abs((r.angleDegrees as number) - expected) <= 1e-6, 'reference angle disagrees with annotations');
        }
        if (attempt.status === 'failed') requireValue(slot.image === null && slot.requestedTimestampMs === null &&
          r.status !== 'available' && m.status === 'unavailable' && r.annotations.length === 0 && r.adjudication === null, 'failed take cannot contain fabricated observations');
      }
    }
  }
  return input as unknown as ValidationManifest;
}

export type Decision = 'PASS' | 'NOT_MET' | 'INCONCLUSIVE' | 'NOT_EVALUATED';
export type MetricKey = 'mae' | 'bias' | 'p95' | 'Y' | 'E' | 'C' | 'F';
export type Metrics = Record<MetricKey, number | null>;
export type AttemptSummary = {
  id: string; S: number; R: number; M: number; errors: { slotId: string; signed: number; absolute: number }[];
  reasons: Record<string, number>; referenceMissing: number; referenceExcluded: number;
  modelUnavailable: number; duplicateImages: number;
  metrics: { mae: number | null; bias: number | null; p95: number | null;
    referenceYield: number | null; endToEndYield: number | null; modelCoverage: number | null;
    conditionalUnavailableRate: number | null };
};
export type ParticipantSummary = { id: string; attempts: AttemptSummary[]; plannedComplete: boolean };
const divide = (a: number, b: number) => b === 0 ? null : a / b;
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** Inverse weighted empirical CDF. Weights need not sum to one. */
export function weightedQuantile(rows: { value: number; weight: number }[], q: number): number | null {
  requireValue(finite(q) && q >= 0 && q <= 1 && rows.every(r => finite(r.value) && finite(r.weight) && r.weight > 0), 'quantile inputs');
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  const target = q * sorted.reduce((sum, r) => sum + r.weight, 0);
  let cumulative = 0;
  for (const row of sorted) { cumulative += row.weight; if (cumulative >= target) return row.value; }
  return sorted[sorted.length - 1].value;
}

/** Signed error = model - reference; positive means greater estimated flexion. */
export function summarizeParticipants(manifest: ValidationManifest): ParticipantSummary[] {
  return manifest.participants.filter(p => p.partition === 'evaluation').map(p => ({
    id: p.id, plannedComplete: p.plannedTrialIds.every(id => p.attempts.some(a => a.trialId === id)),
    attempts: p.attempts.map(a => {
      const out: AttemptSummary = { id: a.id, S: 20, R: 0, M: 0, errors: [], reasons: {},
        referenceMissing: 0, referenceExcluded: 0, modelUnavailable: 0, duplicateImages: 0,
        metrics: { mae: null, bias: null, p95: null, referenceYield: null, endToEndYield: null,
          modelCoverage: null, conditionalUnavailableRate: null } };
      const seen = new Set<string>();
      const reason = (key: string) => { out.reasons[key] = (out.reasons[key] ?? 0) + 1; };
      if (a.status === 'failed') reason(`attempt:${a.reason}`);
      for (const slot of a.slots) {
        const r = slot.reference, m = slot.model;
        if (r.status === 'missing') { out.referenceMissing++; reason(`reference:${r.reason}`); }
        if (r.status === 'excluded') { out.referenceExcluded++; reason(`reference:${r.reason}`); }
        if (m.status === 'unavailable') { out.modelUnavailable++; reason(`model:${m.reason}`); }
        if (slot.image) {
          if (seen.has(slot.image.id)) { out.duplicateImages++; reason('duplicate_source_image'); continue; }
          seen.add(slot.image.id);
        }
        if (r.status !== 'available') continue;
        out.R++;
        if (m.status !== 'available') continue;
        out.M++;
        const signed = m.angleDegrees! - r.angleDegrees!;
        out.errors.push({ slotId: slot.id, signed, absolute: Math.abs(signed) });
      }
      out.metrics = { mae: mean(out.errors.map(e => e.absolute)), bias: mean(out.errors.map(e => e.signed)),
        p95: weightedQuantile(out.errors.map(e => ({ value: e.absolute, weight: 1 })), .95),
        referenceYield: divide(out.R, out.S), endToEndYield: divide(out.M, out.S),
        modelCoverage: divide(out.M, out.R), conditionalUnavailableRate: divide(out.R - out.M, out.R) };
      return out;
    }),
  }));
}

/** Already validated summaries only. Full clusters, including empty participants. */
export function computeMetrics(people: ParticipantSummary[]): Metrics {
  const attempts = people.flatMap(p => p.attempts);
  const matched = people.map(p => p.attempts.filter(a => a.M > 0)).filter(a => a.length);
  const errorMean = (absolute: boolean) => mean(matched.map(as => mean(as.map(a =>
    mean(a.errors.map(e => absolute ? e.absolute : e.signed))!))!));
  const distribution = matched.flatMap(as => as.flatMap(a => a.errors.map(e => ({
    value: e.absolute, weight: 1 / (matched.length * as.length * a.M),
  }))));
  const coverageEstimable = people.length > 0 && people.every(p => p.attempts.length > 0);
  const rate = (key: 'R' | 'M') => coverageEstimable ? mean(people.map(p =>
    p.attempts.reduce((sum, a) => sum + a[key], 0) / (20 * p.attempts.length))) : null;
  const Y = rate('R'), E = rate('M');
  return { mae: errorMean(true), bias: errorMean(false), p95: weightedQuantile(distribution, .95),
    Y, E, C: Y === null || E === null ? null : divide(E, Y),
    F: divide(attempts.filter(a => a.M >= 15).length, attempts.length) };
}

export type Interval = { lower: number; upper: number };
export type Uncertainty = Record<MetricKey, { interval: Interval | null; undefinedDraws: number }>;
const KEYS: MetricKey[] = ['mae', 'bias', 'p95', 'Y', 'E', 'C', 'F'];
/** Entire participants sampled with replacement. No deletion/redraw of undefined replicates. */
export function clusterUncertainty(people: ParticipantSummary[]): Uncertainty {
  const values = Object.fromEntries(KEYS.map(k => [k, [] as number[]])) as Record<MetricKey, number[]>;
  let seed: number = EVALUATION.seed;
  const random = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  for (let i = 0; i < EVALUATION.bootstrapDraws; i++) {
    const draw = Array.from({ length: people.length }, () => people[Math.floor(random() * people.length)]);
    const metrics = computeMetrics(draw);
    for (const key of KEYS) if (metrics[key] !== null) values[key].push(metrics[key]);
  }
  return Object.fromEntries(KEYS.map(key => {
    const xs = values[key].map(value => ({ value, weight: 1 }));
    const undefinedDraws = EVALUATION.bootstrapDraws - xs.length;
    return [key, { undefinedDraws, interval: undefinedDraws ? null : {
      lower: weightedQuantile(xs, .025)!, upper: weightedQuantile(xs, .975)!,
    } }];
  })) as Uncertainty;
}

/** Separate decision logic: never equates numerical attainment with scientific validation. */
export function decideMetrics(metrics: Metrics, uncertainty: Uncertainty,
  prerequisitesComplete: boolean, hasAttempts: boolean) {
  const gates = Object.fromEntries(KEYS.map(key => {
    const point = metrics[key], ci = uncertainty[key].interval, limit = EVALUATION[key];
    let decision: Decision;
    const passes = (v: number) => key === 'bias' ? Math.abs(v) <= limit :
      ['mae', 'p95'].includes(key) ? v <= limit : v >= limit;
    if (point === null) decision = 'NOT_EVALUATED';
    else if (!passes(point)) decision = 'NOT_MET';
    else if (!ci || !passes(ci.lower) || !passes(ci.upper)) decision = 'INCONCLUSIVE';
    else decision = 'PASS';
    return [key, decision];
  })) as Record<MetricKey, Decision>;
  const overall: Decision = !hasAttempts ? 'NOT_EVALUATED' : Object.values(gates).includes('NOT_MET') ? 'NOT_MET' :
    prerequisitesComplete && Object.values(gates).every(v => v === 'PASS') ? 'PASS' : 'INCONCLUSIVE';
  return { gates, overall };
}

export function evaluateSyntheticManifest(input: unknown) {
  const manifest = parseValidationManifest(input);
  const participants = summarizeParticipants(manifest), metrics = computeMetrics(participants);
  const uncertainty = clusterUncertainty(participants);
  const attempts = participants.flatMap(p => p.attempts);
  const S = attempts.reduce((s, a) => s + a.S, 0), R = attempts.reduce((s, a) => s + a.R, 0), M = attempts.reduce((s, a) => s + a.M, 0);
  const pending: string[] = [];
  if (participants.length !== 10 || participants.some(p => !p.plannedComplete)) pending.push('protocol_cohort_incomplete');
  for (const [key, complete] of Object.entries(manifest.simulatedPrerequisites)) if (!complete) pending.push(`simulated_${key}_pending`);
  const descriptivePeople = participants.filter(p => p.attempts.length > 0);
  const descriptive = computeMetrics(descriptivePeople);
  return {
    evidenceKind: 'synthetic' as const, scientificValidation: 'not-validated' as const,
    scientificDecision: 'NOT_EVALUATED' as const, configuration: EVALUATION,
    realStudyPrerequisites: 'pending-supervisor-ethics-reference-readiness-and-exact-frame-evidence' as const,
    signConvention: 'model-minus-independent-2d-reference-degrees',
    participants, metrics, uncertainty, pending,
    simulatedDecision: decideMetrics(metrics, uncertainty, pending.length === 0, attempts.length > 0),
    availableParticipantCoverageDescriptive: {
      denominatorParticipants: descriptivePeople.length,
      Y: descriptive.Y, E: descriptive.E, C: descriptive.C,
    },
    counts: {
      attempts: attempts.length, participants: participants.length,
      participantsWithoutMatches: participants.filter(p => p.attempts.every(a => a.M === 0)).length,
      referenceMissing: attempts.reduce((sum, a) => sum + a.referenceMissing, 0),
      referenceExcluded: attempts.reduce((sum, a) => sum + a.referenceExcluded, 0),
      modelUnavailable: attempts.reduce((sum, a) => sum + a.modelUnavailable, 0),
      duplicateImages: attempts.reduce((sum, a) => sum + a.duplicateImages, 0),
    },
    pooledSecondary: { S, R, M, referenceYield: divide(R, S), endToEndYield: divide(M, S), modelCoverage: divide(M, R) },
  };
}
