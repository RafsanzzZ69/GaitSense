import test from 'node:test';
import assert from 'node:assert/strict';
import { EVALUATION, referenceAngle, parseValidationManifest, summarizeParticipants,
  computeMetrics, clusterUncertainty, decideMetrics, evaluateSyntheticManifest,
  weightedQuantile } from '../src/validation/knee-comparison.ts';

let serial = 0;
const hash = () => (++serial).toString(16).padStart(64, '0');
const points = degrees => [[60, 50], [50, 50],
  [50 + 10 * Math.cos((180 - degrees) * Math.PI / 180), 50 + 10 * Math.sin((180 - degrees) * Math.PI / 180)]];
function attempt(pid, trial, take = 0, error = 0) {
  const aid = `${pid}-t${trial}-a${take}`, source = hash();
  return { id: aid, trialId: `${pid}-t${trial}`, status: 'recorded', reason: null,
    capture: { view: 'side_left', device: 'SYNTHETIC-NO-DEVICE', protocolVersion: 'synthetic-capture-1',
      timestampMethod: 'requested-100ms-nearest-decoded-frame' },
    slots: Array.from({ length: 20 }, (_, i) => {
      const imageId = `${aid}-image${i}`;
      return { id: `${aid}-slot${i}`, ordinal: i, requestedTimestampMs: i * 100,
        image: { id: imageId, sourceSha256: source, frameId: `f${i}`, bitmapSha256: hash(),
          width: 100, height: 100, actualPtsMs: null },
        reference: { status: 'available', angleDegrees: 60, imageId, reason: null,
          annotations: ['one', 'two'].map(observer => ({ id: `${aid}-slot${i}-${observer}`, observerId: observer,
            toolVersion: 'synthetic-independent-atan2', imageId, points: points(60), reason: null })), adjudication: null },
        model: { status: 'available', angleDegrees: 60 + (typeof error === 'function' ? error(i) : error), imageId, reason: null } };
    }) };
}
function fixture(errors = [0], count = 1) {
  return { schemaVersion: 'knee-validation-manifest-1', evidenceKind: 'synthetic', units: 'degrees',
    evaluationVersion: 'knee-comparison-1', algorithmVersion: 'projected-knee-1', configurationVersion: 'knee-quality-1',
    simulatedPrerequisites: { approvals: false, software: true, referenceReadiness: false },
    participants: errors.map((error, n) => { const id = `SYNTHETIC-P${n}`;
      return { id, partition: 'evaluation', plannedTrialIds: [0, 1, 2].map(t => `${id}-t${t}`),
        attempts: Array.from({ length: count }, (_, t) => attempt(id, t, 0, error)) }; }) };
}
const metrics = m => computeMetrics(summarizeParticipants(parseValidationManifest(m)));
const unavailable = slot => { slot.model = { status: 'unavailable', angleDegrees: null, imageId: slot.image?.id ?? null, reason: 'low_presence' }; };
const missing = slot => { slot.reference = { status: 'missing', angleDegrees: null, imageId: slot.image?.id ?? null,
  reason: 'unannotatable', annotations: [], adjudication: null }; };
const close = (a, b) => assert.ok(typeof a === 'number' && Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('independent reference angle and inverse weighted CDF have analytic answers', () => {
  for (const angle of [0, 30, 60, 90, 150, 180]) close(referenceAngle(points(angle)), angle);
  assert.equal(referenceAngle([[0, 0], [0, 0], [1, 1]]), null);
  assert.equal(weightedQuantile([{ value: 1, weight: 19 }, { value: 10, weight: 1 }], .95), 1);
});
test('perfect agreement, known signed errors, MAE and P95', () => {
  assert.deepEqual(metrics(fixture()), { mae: 0, bias: 0, p95: 0, Y: 1, E: 1, C: 1, F: 1 });
  for (const sign of [-1, 1]) {
    const m = metrics(fixture([i => sign * (i + 1)]));
    close(m.mae, 10.5); close(m.bias, sign * 10.5); assert.equal(m.p95, 19);
  }
});
test('participant, attempt and frame weighting are distinct with unequal counts', () => {
  const f = fixture([0, 10]);
  const p = f.participants[0]; p.attempts.push(attempt(p.id, 1, 0, 2), attempt(p.id, 2, 0, 4));
  // P0 mean trial errors=(0+2+4)/3=2; P1=10, so primary=6, pooled frames=4.
  close(metrics(f).mae, 6); close(metrics(f).bias, 6); assert.equal(metrics(f).p95, 10);
  p.attempts[0].slots.slice(1).forEach(unavailable);
  close(metrics(f).mae, 6); // reducing matches must not change equal trial weighting
});
test('missing and unavailable slots stay in denominators; C=E/Y', () => {
  const f = fixture(), a = f.participants[0].attempts[0];
  a.slots.slice(0, 2).forEach(missing); a.slots.slice(2, 6).forEach(unavailable);
  const m = metrics(f); close(m.Y, .9); close(m.E, .7); close(m.C, 14 / 18); close(m.Y * m.C, m.E);
  const summary = summarizeParticipants(f)[0].attempts[0];
  assert.deepEqual([summary.S, summary.R, summary.M, summary.referenceMissing, summary.modelUnavailable], [20, 18, 14, 2, 4]);
  assert.equal(summary.reasons['model:low_presence'], 4); assert.equal(m.F, 0);
});
test('failed attempts retain twenty opportunities; participants without attempts make primary coverage null', () => {
  const f = fixture([0, 0]), a = f.participants[0].attempts[0];
  a.status = 'failed'; a.reason = 'synthetic-camera-failure';
  a.slots.forEach(s => { s.image = null; s.requestedTimestampMs = null; missing(s); unavailable(s); });
  const m = metrics(f); close(m.Y, .5); close(m.E, .5); close(m.C, 1); close(m.F, .5);
  f.participants[0].attempts = [];
  assert.equal(metrics(f).Y, null); assert.equal(metrics(f).C, null);
});
test('explicit repeated exact frame retains S and is counted once for R/M', () => {
  const f = fixture(), slots = f.participants[0].attempts[0].slots;
  slots[1].image = structuredClone(slots[0].image);
  slots[1].reference.imageId = slots[0].image.id; slots[1].model.imageId = slots[0].image.id;
  slots[1].reference.annotations.forEach(a => a.imageId = slots[0].image.id);
  const a = summarizeParticipants(parseValidationManifest(f))[0].attempts[0];
  assert.deepEqual([a.S, a.R, a.M, a.duplicateImages], [20, 19, 19, 1]);
});
test('malformed, duplicate and mismatched identity, units, views and versions reject', () => {
  const changes = [f => f.units = 'radians', f => f.evidenceKind = 'real',
    f => f.participants[0].attempts[0].capture.view = 'front',
    f => f.participants.push(structuredClone(f.participants[0])),
    f => f.participants[0].attempts[0].slots[1].id = f.participants[0].attempts[0].slots[0].id,
    f => f.participants[0].attempts[0].slots[0].model.imageId = 'different-image',
    f => f.participants[0].attempts[0].slots[0].reference.angleDegrees = 70,
    f => f.participants[0].attempts[0].slots[0].model.angleDegrees = NaN,
    f => f.participants[0].attempts[0].slots.pop(),
    f => f.extra = true, f => f.algorithmVersion = 'other',
    f => f.participants[0].attempts[0].slots[0].reference.annotations[1].observerId = 'one'];
  for (const change of changes) { const f = fixture(); change(f); assert.throws(() => parseValidationManifest(f)); }
  for (const invalid of [null, {}, [], 'bad']) assert.throws(() => parseValidationManifest(invalid));
});
test('content sharing across participant partitions rejects', () => {
  const f = fixture([0, 0]); f.participants[0].partition = 'pilot';
  f.participants[1].attempts[0].slots[0].image.sourceSha256 = f.participants[0].attempts[0].slots[0].image.sourceSha256;
  assert.throws(() => parseValidationManifest(f), /content crosses/);
});
test('adjudication required above five degrees; third independent angle determines reference', () => {
  const f = fixture(), r = f.participants[0].attempts[0].slots[0].reference;
  r.annotations[1].points = points(70);
  assert.throws(() => parseValidationManifest(f), /adjudication rule/);
  r.adjudication = { ...structuredClone(r.annotations[0]), id: 'third-annotation', observerId: 'three', points: points(63) };
  r.angleDegrees = 63; parseValidationManifest(f);
});
test('decision boundaries are inclusive; uncertainty and prerequisite gates remain separate', () => {
  const m = { mae: 5, bias: -3, p95: 10, Y: .9, E: .75, C: .75 / .9, F: .8 };
  const ci = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { interval: { lower: v, upper: v }, undefinedDraws: 0 }]));
  assert.equal(decideMetrics(m, ci, true, true).overall, 'PASS');
  assert.equal(decideMetrics(m, ci, false, true).overall, 'INCONCLUSIVE');
  ci.mae.interval.upper = 5.01;
  assert.equal(decideMetrics(m, ci, true, true).gates.mae, 'INCONCLUSIVE');
  assert.equal(decideMetrics({ ...m, bias: 3.001 }, ci, true, true).overall, 'NOT_MET');
  assert.equal(decideMetrics(m, ci, true, false).overall, 'NOT_EVALUATED');
  assert.equal(decideMetrics({ ...m, C: .8 }, ci, true, true).gates.C, 'PASS');
});
test('cluster bootstrap resamples whole participants with reproducible known endpoints', () => {
  const people = summarizeParticipants(parseValidationManifest(fixture([0, 10])));
  const a = clusterUncertainty(people), b = clusterUncertainty(people);
  assert.deepEqual(a, b);
  assert.deepEqual(a.mae.interval, { lower: 0, upper: 10 });
  assert.deepEqual(a.Y.interval, { lower: 1, upper: 1 });
  assert.equal(a.mae.undefinedDraws, 0);
});
test('undefined cluster draws are counted, never discarded; all-unavailable and empty cases explicit', () => {
  const f = fixture([0, 0]); f.participants[0].attempts[0].slots.forEach(s => { missing(s); unavailable(s); });
  const u = clusterUncertainty(summarizeParticipants(parseValidationManifest(f)));
  assert.equal(u.mae.interval, null); assert.ok(u.mae.undefinedDraws > 0); assert.equal(u.Y.undefinedDraws, 0);
  f.participants[1].attempts[0].slots.forEach(s => { missing(s); unavailable(s); });
  assert.deepEqual(metrics(f), { mae: null, bias: null, p95: null, Y: 0, E: 0, C: null, F: 0 });
  const empty = evaluateSyntheticManifest(fixture([]));
  assert.equal(empty.simulatedDecision.overall, 'NOT_EVALUATED');
  assert.equal(empty.metrics.C, null); assert.equal(empty.uncertainty.mae.undefinedDraws, 2000);
});
test('full synthetic cohort may simulate PASS but can never report scientific validation', () => {
  const f = fixture(Array(10).fill(0), 3);
  f.simulatedPrerequisites = { approvals: true, software: true, referenceReadiness: true };
  const report = evaluateSyntheticManifest(f);
  assert.equal(report.simulatedDecision.overall, 'PASS');
  assert.equal(report.scientificDecision, 'NOT_EVALUATED');
  assert.equal(report.scientificValidation, 'not-validated');
  assert.equal(report.evidenceKind, 'synthetic');
  assert.deepEqual([report.pooledSecondary.S, report.pooledSecondary.R, report.pooledSecondary.M], [600, 600, 600]);
  assert.equal(report.configuration.bootstrapDraws, 2000);
  assert.equal(EVALUATION.protocolCommit, 'c8fcfec2282702e9ab0bd9e819306d49241a641a');
});

test('conflicting image metadata, duplicate bitmap aliases and recording reuse are rejected', () => {
  for (const change of [
    slots => slots[1].image.id = slots[0].image.id,
    slots => slots[1].image.frameId = slots[0].image.frameId,
    slots => slots[1].image.bitmapSha256 = slots[0].image.bitmapSha256,
  ]) {
    const f = fixture(); change(f.participants[0].attempts[0].slots);
    assert.throws(() => parseValidationManifest(f));
  }
  const f = fixture([0], 2), [a, b] = f.participants[0].attempts;
  b.slots[0].image.sourceSha256 = a.slots[0].image.sourceSha256;
  assert.throws(() => parseValidationManifest(f), /content crosses/);
});

test('excluded references and zero-reference participants remain visible in balanced yields', () => {
  const f = fixture([0, 0]), p = f.participants[0];
  p.attempts.push(attempt(p.id, 1), attempt(p.id, 2));
  for (const a of p.attempts) for (const s of a.slots) {
    missing(s); s.reference.status = 'excluded'; s.reference.reason = 'synthetic-blur';
  }
  // 3 empty-reference trials for P0, one full trial for P1: balanced Y=.5, pooled Y=.25.
  const report = evaluateSyntheticManifest(f);
  close(report.metrics.Y, .5); close(report.metrics.E, .5); close(report.metrics.C, 1);
  close(report.pooledSecondary.referenceYield, .25);
  assert.equal(report.counts.referenceExcluded, 60);
  assert.equal(report.counts.participantsWithoutMatches, 1);
  assert.equal(report.simulatedDecision.overall, 'NOT_MET');
});

test('all threshold boundaries and outside values have prespecified decision categories', () => {
  const m = { mae: 5, bias: 3, p95: 10, Y: .9, E: .75, C: .8, F: .8 };
  const intervals = () => Object.fromEntries(Object.entries(m).map(([key, value]) => [key,
    { interval: { lower: value, upper: value }, undefinedDraws: 0 }]));
  for (const key of Object.keys(m)) {
    const outside = m[key] + (['mae', 'bias', 'p95'].includes(key) ? .001 : -.001);
    assert.equal(decideMetrics({ ...m, [key]: outside }, intervals(), true, true).gates[key], 'NOT_MET');
    const ci = intervals(); ci[key].interval = null; ci[key].undefinedDraws = 1;
    assert.equal(decideMetrics(m, ci, true, true).gates[key], 'INCONCLUSIVE');
    assert.equal(decideMetrics({ ...m, [key]: null }, ci, true, true).gates[key], 'NOT_EVALUATED');
  }
});

test('bootstrap repeated cluster copies preserve multiplicity and full trial weighting', () => {
  const people = summarizeParticipants(parseValidationManifest(fixture([0, 12])));
  close(computeMetrics([people[0], people[0], people[1]]).mae, 4);
  close(computeMetrics([people[0], people[1], people[1]]).mae, 8);
  assert.equal(referenceAngle(Array(3)), null);
  assert.throws(() => weightedQuantile([{ value: 1, weight: -1 }], .95));
});

test('one recording attempt cannot mix source recordings', () => {
  const f = fixture();
  f.participants[0].attempts[0].slots[1].image.sourceSha256 = hash();
  assert.throws(() => parseValidationManifest(f), /multiple source recordings/);
});
