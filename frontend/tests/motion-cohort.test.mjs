import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSyntheticMotionCohort as evaluate, CohortInputError } from '../src/validation/motion-cohort.ts';
function attempt(p, id, refs = [500], candidates = [500]) {
  const event = (role, t, i) => ({ id: `${id}-${role}${i}`, participantId: p, attemptId: id, regionId: `${id}-region`,
    side: 'left', polarity: 'maximum', requestedMs: t, actualPtsMs: null, ptsMethod: 'unknown', imageId: `${id}-${role}-image${i}`, status: 'scorable', reason: null });
  return { id, participantId: p, view: 'side_left', side: 'left', status: 'recorded', reason: null, scoringStartMs: 0,
    timestampMethod: 'requested-100ms-nearest-decoded-frame', correspondence: 'asserted-exact-image', modelStatus: 'available', modelReason: null,
    regions: [{ id: `${id}-region`, startMs: 0, endMs: 3000, status: 'evaluable', reason: null }],
    slots: Array.from({ length: 30 }, (_, i) => ({ requestedMs: 100 * i, model: 'valid', reason: null })),
    references: refs.map((t, i) => event('r', t, i)), candidates: candidates.map((t, i) => event('c', t, i)) };
}
function fixture(groups = [[attempt('p', 'a')]]) {
  return { schemaVersion: 'synthetic-motion-cohort-1', evidenceKind: 'synthetic',
    participants: groups.map((as, i) => ({ id: as[0]?.participantId ?? `empty${i}`, partition: 'evaluation',
      trials: as.length ? as.map(a => ({ id: `trial-${a.id}`, status: a.status === 'failed' ? 'failed' : 'completed', reason: a.reason,
        attempts: [{ id: a.id, replaces: null, approval: null }] })) : [{ id: `unattempted${i}`, status: 'unattempted', reason: 'not collected', attempts: [] }] })),
    matching: { schemaVersion: 'synthetic-motion-matching-1', evidenceKind: 'synthetic', algorithmVersion: 'motion-matching-1', configurationVersion: 'motion-match-100ms-1', attempts: groups.flat() } };
}
const evaluation = f => evaluate(f).partitions[1];
const metric = f => evaluation(f).polarities[0];
function failed(p, id) {
  const a = attempt(p, id, [], []);
  return { ...a, status: 'failed', reason: 'capture failed', scoringStartMs: null, modelStatus: 'unavailable', modelReason: 'no evidence', regions: [],
    slots: a.slots.map(() => ({ requestedMs: null, model: 'missing', reason: 'capture failed' })) };
}
function rejects(f, code) { assert.throws(() => evaluate(f), e => e.code === code && !!e.path); }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
test('complete cohort exact counts, metrics, boundaries and bootstrap', () => {
  const f = fixture([[attempt('p', 'a', [500, 1500], [550, 2300])], [attempt('q', 'b', [500], [480])]]);
  const m = metric(f);
  assert.deepEqual(m.counts, { S: 60, Q: 60, V: 60, R: 3, D: 3, T: 2, misses: 1, extras: 1 });
  assert.equal(m.recall, 2/3); assert.equal(m.precision, 2/3);
  assert.deepEqual(m.coverage, { reference: 1, jointSignal: 1, conditionalSignal: 1 });
  assert.deepEqual(m.timing, { maeMs: 35, biasMs: 15, medianAbsoluteMs: 20, p95AbsoluteMs: 50, maximumAbsoluteMs: 50 });
  assert.deepEqual(m.uncertainty.recall, { undefinedDraws: 0, interval: { lower: .5, upper: 1 } });
  assert.deepEqual(m.uncertainty.maeMs.interval, { lower: 20, upper: 50 });
  assert.equal(evaluation(f).collectionStatus, 'complete');
});
test('zero-attempt enrolled person nulls full cohort rates but not descriptive rates', () => {
  const f = fixture([[attempt('p', 'a')], []]), m = metric(f);
  assert.equal(m.recall, null); assert.equal(m.precision, null);
  assert.deepEqual(m.attemptedParticipantDescriptive, { participants: 1, recall: 1, precision: 1 });
  assert.deepEqual(m.coverage, { reference: null, jointSignal: null, conditionalSignal: null });
  assert.equal(m.counts.S, 30); assert.equal(m.counts.R, 1); assert.equal(m.counts.misses, 0);
  assert.equal(m.uncertainty.recall.interval, null); assert.ok(m.uncertainty.recall.undefinedDraws > 0);
  assert.equal(evaluation(f).collectionStatus, 'incomplete');
});
test('failed actual attempt has 30 opportunities without fabricated events', () => {
  const m = metric(fixture([[attempt('p', 'a')], [failed('q', 'b')]]));
  assert.equal(m.recall, 1); assert.equal(m.precision, 1); assert.equal(m.counts.S, 60);
  assert.equal(m.coverage.reference, .5); assert.equal(m.coverage.conditionalSignal, 1);
  assert.equal(m.attemptsWithoutMatches, 1); assert.equal(m.participantsWithoutAttempts, 0);
});
test('one unattempted trial is retained without changing actual-attempt denominators', () => {
  const f = fixture(); f.participants[0].trials.push({ id: 'pending', status: 'unattempted', reason: 'pending', attempts: [] });
  const r = evaluation(f); assert.equal(r.collectionStatus, 'incomplete'); assert.equal(r.polarities[0].counts.S, 30);
  assert.equal(r.polarities[0].recall, 1); assert.equal(r.participants[0].unattemptedTrials, 1);
});
test('unequal attempt counts balance people rather than pooling events', () => {
  const m = metric(fixture([[attempt('p', 'a'), attempt('p', 'b')], [attempt('q', 'c', [500], [])]]));
  assert.equal(m.recall, .5); assert.equal(m.pooledDescriptive.recall, 2/3); assert.equal(m.precision, 1);
});
test('timing hierarchy and weighted empirical quantiles', () => {
  const m = metric(fixture([[attempt('p', 'a', [500, 1000], [500, 1020]), attempt('p', 'b', [500], [600])], [attempt('q', 'c', [500], [460])]]));
  close(m.timing.maeMs, 47.5); close(m.timing.biasMs, 7.5);
  assert.equal(m.timing.medianAbsoluteMs, 40); assert.equal(m.timing.p95AbsoluteMs, 100);
});
for (const [refs, candidates, recall, precision] of [[[], [], null, null], [[], [500], null, 0], [[500], [], 0, null]])
  test(`zero denominators R${refs.length} D${candidates.length}`, () => {
    const m = metric(fixture([[attempt('p', 'a', refs, candidates)]]));
    assert.equal(m.recall, recall); assert.equal(m.precision, precision); assert.equal(m.timing.maeMs, null);
    assert.equal(m.coverage.reference, 1); assert.equal(m.participantsWithoutAttempts, 0);
  });
test('ambiguous references/candidates remain unscorable, not misses/extras', () => {
  const a = attempt('p', 'a'); a.regions[0].status = 'ambiguous'; a.regions[0].reason = 'plateau';
  for (const e of [...a.references, ...a.candidates]) { e.status = 'ambiguous'; e.reason = 'plateau'; }
  const m = metric(fixture([[a]])); assert.equal(m.unscorableRegions, 1); assert.equal(m.unscorableReferences, 1);
  assert.equal(m.unscorableCandidates, 1); assert.equal(m.counts.misses, 0); assert.equal(m.counts.extras, 0);
  assert.equal(m.coverage.reference, 0); assert.equal(m.coverage.conditionalSignal, null);
});
test('model missingness lowers joint coverage without erasing references', () => {
  const a = attempt('p', 'a', [500], []); a.modelStatus = 'partial'; a.modelReason = 'missing';
  a.slots[5] = { requestedMs: 500, model: 'missing', reason: 'missing' };
  const m = metric(fixture([[a]])); assert.equal(m.coverage.jointSignal, 29/30); assert.equal(m.counts.misses, 1);
});
test('empty cohort explicit null and 2000 undefined bootstrap draws', () => {
  const m = metric(fixture([])); assert.equal(m.recall, null); assert.equal(m.coverage.reference, null);
  assert.deepEqual(m.uncertainty.recall, { undefinedDraws: 2000, interval: null });
});
test('pilot is separate from evaluation', () => {
  const f = fixture([[attempt('p', 'a')], [attempt('q', 'b', [500], [])]]); f.participants[1].partition = 'pilot';
  const r = evaluate(f); assert.equal(r.partitions[1].polarities[0].recall, 1);
  assert.equal(r.partitions[0].polarities[0].recall, 0); assert.equal(r.partitions[0].polarities[0].uncertainty, null);
});
test('approved replacement retains failed original in coverage', () => {
  const f = fixture([[failed('p', 'a'), attempt('p', 'b')]]);
  f.participants[0].trials = [{ id: 'trial', status: 'completed', reason: null, attempts: [
    { id: 'a', replaces: null, approval: null }, { id: 'b', replaces: 'a', approval: 'synthetic-approval' }] }];
  const m = metric(f); assert.equal(m.counts.S, 60); assert.equal(m.coverage.reference, .5); assert.equal(m.recall, 1);
  f.participants[0].trials[0].attempts[1].approval = null; rejects(f, 'invalid_replacement');
});
for (const [name, mutate, code] of [
  ['duplicate participant', f => f.participants.push(structuredClone(f.participants[0])), 'duplicate_id'],
  ['duplicate trial', f => f.participants[0].trials.push(structuredClone(f.participants[0].trials[0])), 'duplicate_id'],
  ['duplicate link', f => f.participants[0].trials[0].attempts.push({ id: 'a', replaces: 'a', approval: 'yes' }), 'duplicate_attempt'],
  ['ownership', f => f.participants[0].id = 'other', 'ownership_mismatch'],
  ['status', f => f.participants[0].trials[0].status = 'unattempted', 'contradictory_status'],
  ['missing report', f => f.participants[0].trials[0].attempts[0].id = 'missing', 'missing_report'],
  ['orphan report', f => f.participants = [], 'unlinked_attempt'],
  ['configuration', f => f.matching.configurationVersion = 'wrong', 'unsupported_version'],
  ['schema', f => f.schemaVersion = 'wrong', 'unsupported_version'],
  ['real evidence', f => f.evidenceKind = 'real', 'unsupported_version'],
]) test(`reject ${name}`, () => { const f = fixture(); mutate(f); rejects(f, code); });
test('ordering, reproducibility and input immutability', () => {
  const f = fixture([[attempt('p', 'a'), attempt('p', 'b')], [attempt('q', 'c', [500], [])], []]);
  const original = structuredClone(f), expected = evaluate(f); assert.deepEqual(f, original);
  f.participants.reverse(); f.matching.attempts.reverse();
  f.participants.forEach(p => p.trials.reverse());
  assert.deepEqual(evaluate(f), expected);
});
test('scientific boundary is constant even with perfect matches', () => {
  const r = evaluate(fixture()); assert.equal(r.scientificDecision, 'NOT_EVALUATED');
  assert.equal(r.scientificValidation, 'not-validated'); assert.equal(r.authenticity, 'not-established');
  assert.equal(r.timestampProvenance.actualPtsUsedForMatching, false);
});
test('polarity-specific counts, timing and uncertainty never mix', () => {
  const a = attempt('p', 'a', [500], [550]);
  const b = attempt('p', 'b', [500, 1500], [480]);
  for (const e of [...b.references, ...b.candidates]) e.polarity = 'minimum';
  const f = fixture([[a, b]]), r = evaluation(f);
  const [max, min] = r.polarities;
  assert.equal(max.polarity, 'maximum'); assert.equal(min.polarity, 'minimum');
  assert.equal(max.recall, 1); assert.equal(min.recall, .5);
  assert.equal(max.counts.T, 1); assert.equal(min.counts.T, 1);
  assert.equal(max.counts.misses, 0); assert.equal(min.counts.misses, 1);
  assert.equal(max.timing.biasMs, 50); assert.equal(min.timing.biasMs, -20);
  assert.deepEqual(max.uncertainty.biasMs.interval, { lower: 50, upper: 50 });
  assert.deepEqual(min.uncertainty.biasMs.interval, { lower: -20, upper: -20 });
  assert.deepEqual(r.participants[0].polarities.map(p => p.polarity), ['maximum', 'minimum']);
  f.matching.attempts.reverse(); assert.deepEqual(evaluation(f), r);
});
test('opposite polarity events at identical times cannot rescue each other', () => {
  const a = attempt('p', 'a'); a.candidates[0].polarity = 'minimum';
  const [max, min] = evaluation(fixture([[a]])).polarities;
  assert.equal(max.counts.misses, 1); assert.equal(min.counts.extras, 1);
  assert.equal(max.counts.T, 0); assert.equal(min.counts.T, 0);
  assert.equal(max.recall, 0); assert.equal(max.precision, null);
  assert.equal(min.recall, null); assert.equal(min.precision, 0);
  assert.equal(max.timing.maeMs, null); assert.equal(min.timing.maeMs, null);
});
test('inverse empirical median includes exact half mass with twelve pairs', () => {
  const refs = Array.from({ length: 12 }, (_, i) => 100 + 200*i);
  const m = metric(fixture([[attempt('p', 'a', refs, refs.map((t, i) => t + (i < 6 ? 0 : 100)))]]));
  assert.equal(m.timing.medianAbsoluteMs, 0);
});
test('balanced counts differ from average personal ratios and pooled counts', () => {
  const m = metric(fixture([[attempt('p', 'a'), failed('p', 'b')], [attempt('q', 'c', [500, 1000, 1500], [])]]));
  // Mean counts: p T=1/2,R=1/2; q T=0,R=3. Ratio=1/7, not mean ratios=1/2 or pooled=1/4.
  assert.equal(m.recall, 1/7); assert.equal(m.pooledDescriptive.recall, 1/4);
  assert.equal(m.coverage.reference, .75);
});
// Independent unsigned BigInt formulation of the documented PRNG, not production aggregation.
function clusterDraws() {
  let state = 20260929n;
  const u32 = x => BigInt.asUintN(32, x);
  function index() {
    state = u32(state + 0x6D2B79F5n);
    let x = u32((state ^ (state >> 15n)) * (state | 1n));
    x ^= u32(x + u32((x ^ (x >> 7n)) * (x | 61n)));
    return Number(u32(x ^ (x >> 14n)) * 3n / 4294967296n);
  }
  return Array.from({ length: 2000 }, () => {
    const counts = [0, 0, 0]; for (let i = 0; i < 3; i++) counts[index()]++;
    return counts;
  });
}
test('bootstrap equals independent cluster-multiplicity formulas, including undefined draws', () => {
  const f = fixture([[attempt('p', 'a', [500], [520]), failed('p', 'b')],
    [attempt('q', 'c', [500, 1000, 1500], [])], [attempt('r', 'd', [500, 1500], [580])]]);
  const m = metric(f), draws = clusterDraws();
  assert.ok(draws.some(([p,q,r]) => p===2 && q===1 && r===0));
  const expected = draws.map(([p,q,r]) => ({
    recall: (.5*p+r)/(.5*p+3*q+2*r), precision: p+r ? 1 : null,
    referenceCoverage: (.5*p+q+r)/3, jointSignalCoverage: (.5*p+q+r)/3,
    maeMs: p+r ? (20*p+80*r)/(p+r) : null,
    biasMs: p+r ? (20*p+80*r)/(p+r) : null,
    p95AbsoluteMs: p+r ? (r ? 80 : 20) : null,
  }));
  for (const key of Object.keys(expected[0])) {
    const values = expected.map(e => e[key]), missing = values.filter(v => v === null).length;
    const actual = m.uncertainty[key]; assert.equal(actual.undefinedDraws, missing, key);
    if (missing) assert.equal(actual.interval, null, key);
    else {
      values.sort((a,b) => a-b);
      close(actual.interval.lower, values[49]); close(actual.interval.upper, values[1949]);
    }
  }
  // Changing q from a recorded no-event-output trial into no attempts affects full-cohort rates,
  // but never the conditional timing distribution of p/r or its undefined cluster draws.
  f.matching.attempts = f.matching.attempts.filter(a => a.id !== 'c');
  f.participants[1].trials = [{ id:'q-pending',status:'unattempted',reason:'pending',attempts:[] }];
  const zero = metric(f);
  assert.equal(zero.uncertainty.recall.undefinedDraws, draws.filter(([,q]) => q>0).length);
  assert.deepEqual(zero.uncertainty.maeMs, m.uncertainty.maeMs);
});
test('P95 includes exact 19/20 mass and crosses just below it', () => {
  // Separate one-pair attempts avoid event-spacing interactions. Rational masses are exact.
  for (const [n, expected] of [[20, 0], [19, 100]]) {
    const as = Array.from({ length:n }, (_,i) => attempt('p', `a${i}`, [500], [i === n-1 ? 600 : 500]));
    assert.equal(metric(fixture([as])).timing.p95AbsoluteMs, expected);
  }
});
