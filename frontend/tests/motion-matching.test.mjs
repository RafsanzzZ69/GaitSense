import test from 'node:test';
import assert from 'node:assert/strict';
import { matchSyntheticMotionEvents, MatchingInputError } from '../src/validation/motion-matching.ts';
const event = (id, requestedMs, overrides = {}) => ({ id, participantId: 'p', attemptId: 'a', regionId: 'region',
  side: 'left', polarity: 'maximum', requestedMs, actualPtsMs: null, ptsMethod: 'unknown', imageId: `image-${id}`,
  status: 'scorable', reason: null, ...overrides });
function fixture(ref = [500], cand = [500]) {
  return { schemaVersion: 'synthetic-motion-matching-1', evidenceKind: 'synthetic', algorithmVersion: 'motion-matching-1',
    configurationVersion: 'motion-match-100ms-1', attempts: [{ id: 'a', participantId: 'p', view: 'side_left', side: 'left',
      status: 'recorded', reason: null, scoringStartMs: 0, timestampMethod: 'requested-100ms-nearest-decoded-frame',
      correspondence: 'asserted-exact-image', modelStatus: 'available', modelReason: null,
      regions: [{ id: 'region', startMs: 0, endMs: 3000, status: 'evaluable', reason: null }],
      slots: Array.from({ length: 30 }, (_, i) => ({ requestedMs: i * 100, model: 'valid', reason: null })),
      references: ref.map((t, i) => event(`r${i}`, t)), candidates: cand.map((t, i) => event(`c${i}`, t)) }] };
}
const result = f => matchSyntheticMotionEvents(f).attempts[0].polarities[0];
const pairs = r => r.pairs.map(p => [p.referenceId, p.candidateId, p.signedErrorMs]);
function rejects(f, code) { assert.throws(() => matchSyntheticMotionEvents(f), e => e instanceof MatchingInputError && e.code === code && !!e.path); }
test('perfect matches and counts use independent exact expectations', () => {
  const f = fixture([500, 1200], [500, 1200]), r = result(f);
  assert.deepEqual(pairs(r), [['r0', 'c0', 0], ['r1', 'c1', 0]]);
  assert.deepEqual(r.counts, { S: 30, Q: 30, V: 30, R: 2, D: 2, T: 2, misses: 0, extras: 0 });
  assert.deepEqual(r.coverage, { reference: 1, jointSignal: 1, conditionalSignal: 1 });
  assert.equal(r.precision, 1); assert.equal(r.recall, 1); assert.equal(r.timing.maeMs, 0);
  assert.equal(matchSyntheticMotionEvents(f).scientificDecision, 'NOT_EVALUATED');
});
test('positive and negative errors, bias and empirical quantiles', () => {
  const r = result(fixture([500, 1000, 1700], [550, 920, 1720]));
  assert.deepEqual(pairs(r), [['r0', 'c0', 50], ['r1', 'c1', -80], ['r2', 'c2', 20]]);
  assert.equal(r.timing.maeMs, 50); assert.equal(r.timing.biasMs, -10 / 3);
  assert.equal(r.timing.medianAbsoluteMs, 50); assert.equal(r.timing.p95AbsoluteMs, 80);
});
for (const delta of [-101, -100, 100, 101]) test(`inclusive tolerance ${delta}`, () => {
  const r = result(fixture([500], [500 + delta])); assert.equal(r.counts.T, Math.abs(delta) <= 100 ? 1 : 0);
});
test('missing reference event leaves extra candidate; missing detection leaves missed reference', () => {
  const r = result(fixture([500, 1500], [500, 2300]));
  assert.deepEqual(r.missed.map(e => e.id), ['r1']); assert.deepEqual(r.extra.map(e => e.id), ['c1']);
  assert.equal(r.recall, .5); assert.equal(r.precision, .5);
});
for (const [r, c, recall, precision] of [[[], [], null, null], [[500], [], 0, null], [[], [500], null, 0]])
  test(`empty sets R${r.length} D${c.length}`, () => {
    const out = result(fixture(r, c)); assert.equal(out.recall, recall); assert.equal(out.precision, precision);
    assert.equal(out.timing.maeMs, null); assert.equal(out.status, 'insufficient_evidence');
  });
test('optimal cardinality avoids nearest-first greedy failure', () => {
  // r0 would greedily take c1 (10ms), preventing r1 from matching c0 (180ms).
  const r = result(fixture([100, 200], [20, 110]));
  assert.deepEqual(pairs(r), [['r0', 'c0', -80], ['r1', 'c1', -90]]);
});
test('minimum total error takes precedence over lexicographic earliest', () => {
  assert.deepEqual(pairs(result(fixture([500], [420, 510]))), [['r0', 'c1', 10]]);
  assert.deepEqual(pairs(result(fixture([420, 510], [500]))), [['r1', 'c0', -10]]);
});
test('exact ties, input-order invariance and no mutation', () => {
  const f = fixture([500, 1500], [450, 550, 1450, 1550]); const original = JSON.stringify(f);
  const a = matchSyntheticMotionEvents(f);
  assert.deepEqual(pairs(a.attempts[0].polarities[0]), [['r0', 'c0', -50], ['r1', 'c2', -50]]);
  assert.equal(JSON.stringify(f), original);
  f.attempts[0].references.reverse(); f.attempts[0].candidates.reverse();
  assert.deepEqual(matchSyntheticMotionEvents(f), a);
});
test('irregular requested times are matched directly; PTS never substitutes', () => {
  const f = fixture([487, 1221], [523, 1208]);
  f.attempts[0].references[0].actualPtsMs = 700; f.attempts[0].references[0].ptsMethod = 'decoder';
  assert.deepEqual(pairs(result(f)), [['r0', 'c0', 36], ['r1', 'c1', -13]]);
});
test('ambiguous/unavailable regions retain observations and cannot create misses or extras', () => {
  const f = fixture([500, 1500, 2500], [500, 1500, 2500]), a = f.attempts[0];
  a.regions = [{ id: 'region', startMs: 0, endMs: 1000, status: 'evaluable', reason: null },
    { id: 'amb', startMs: 1000, endMs: 2000, status: 'ambiguous', reason: 'plateau' },
    { id: 'gap', startMs: 2000, endMs: 3000, status: 'unavailable', reason: 'missing_images' }];
  for (const events of [a.references, a.candidates]) {
    Object.assign(events[1], { regionId: 'amb', status: 'ambiguous', reason: 'plateau' });
    Object.assign(events[2], { regionId: 'gap', status: 'unavailable', reason: 'missing_images' });
  }
  const r = result(f); assert.deepEqual(r.counts, { S: 30, Q: 10, V: 10, R: 1, D: 1, T: 1, misses: 0, extras: 0 });
  assert.equal(r.unscorableReferences.length, 2); assert.equal(r.unscorableCandidates.length, 2);
});
test('no matching across reference gap even inside temporal tolerance', () => {
  const f = fixture([490], [510]), a = f.attempts[0];
  a.regions = [{ id: 'region', startMs: 0, endMs: 500, status: 'evaluable', reason: null },
    { id: 'gap', startMs: 500, endMs: 510, status: 'unavailable', reason: 'missing' },
    { id: 'right', startMs: 510, endMs: 3000, status: 'evaluable', reason: null }];
  a.candidates[0].regionId = 'right'; assert.equal(result(f).counts.T, 0);
});
test('opposite polarities never match; right anatomical side works', () => {
  const f = fixture(); f.attempts[0].candidates[0].polarity = 'minimum';
  const out = matchSyntheticMotionEvents(f).attempts[0].polarities;
  assert.equal(out[0].counts.misses, 1); assert.equal(out[1].counts.extras, 1);
  const g = fixture(), a = g.attempts[0]; a.view = 'side_right'; a.side = 'right';
  a.references[0].side = a.candidates[0].side = 'right'; assert.equal(result(g).counts.T, 1);
});
test('insufficient-evidence candidates are retained; missing model observations reduce coverage', () => {
  const f = fixture(), a = f.attempts[0]; a.modelStatus = 'insufficient_evidence'; a.modelReason = 'isolated_candidate';
  a.slots[0] = { requestedMs: 0, model: 'missing', reason: 'no_pose' };
  assert.equal(result(f).counts.T, 1); assert.equal(result(f).counts.V, 29);
});
test('failed attempts retain thirty opportunities and unavailable reference regions give null rates', () => {
  const f = fixture([], []), a = f.attempts[0]; Object.assign(a, { status: 'failed', reason: 'capture_failed',
    scoringStartMs: null, regions: [], modelStatus: 'unavailable', modelReason: 'no_capture' });
  a.slots.forEach(s => { s.requestedMs = null; s.model = 'missing'; s.reason = 'no_capture'; });
  const r = result(f); assert.equal(r.counts.S, 30); assert.equal(r.counts.Q, 0);
  assert.equal(r.coverage.conditionalSignal, null); assert.equal(r.status, 'unavailable');
});
for (const [name, mutate, code] of [
  ['version', f => f.schemaVersion = 'future', 'unsupported_version'],
  ['real evidence', f => f.evidenceKind = 'real', 'unsupported_version'],
  ['view', f => f.attempts[0].view = 'front', 'unsupported_view'],
  ['side', f => f.attempts[0].references[0].side = 'right', 'side_mismatch'],
  ['participant', f => f.attempts[0].candidates[0].participantId = 'other', 'ownership_mismatch'],
  ['attempt', f => f.attempts[0].candidates[0].attemptId = 'other', 'ownership_mismatch'],
  ['segment', f => f.attempts[0].candidates[0].regionId = 'other', 'region_mismatch'],
  ['duplicate ID', f => f.attempts[0].candidates[0].id = 'r0', 'duplicate_id'],
  ['duplicate event', f => f.attempts[0].candidates.push(event('another', 500)), 'duplicate_event'],
  ['negative timestamp', f => f.attempts[0].candidates[0].requestedMs = -1, 'invalid_timestamp'],
  ['PTS provenance', f => f.attempts[0].candidates[0].actualPtsMs = 5, 'invalid_provenance'],
  ['matching clock', f => f.attempts[0].timestampMethod = 'actual-pts', 'invalid_provenance'],
  ['approximate correspondence', f => f.attempts[0].correspondence = 'nearest-time', 'invalid_provenance'],
  ['slot missing', f => f.attempts[0].slots.pop(), 'invalid_slots'],
  ['region hole', f => f.attempts[0].regions[0].startMs = 1, 'invalid_region'],
  ['status contradiction', f => f.attempts[0].references[0].status = 'ambiguous', 'invalid_state'],
  ['polarity', f => f.attempts[0].candidates[0].polarity = 'heel_strike', 'unsupported_polarity'],
]) test(`reject ${name}`, () => { const f = fixture(); mutate(f); rejects(f, code); });
test('contradictory reused image identity rejects', () => {
  const f = fixture(); f.attempts[0].candidates[0].imageId = f.attempts[0].references[0].imageId;
  f.attempts[0].candidates[0].actualPtsMs = 123; f.attempts[0].candidates[0].ptsMethod = 'decoder';
  rejects(f, 'identity_conflict');
});
test('malformed or sparse inputs reject with explicit reason', () => {
  for (const f of [null, [], {}]) rejects(f, 'invalid_shape');
  const f = fixture(); delete f.attempts[0].references[0]; rejects(f, 'invalid_shape');
});
test('candidate cannot contradict a missing model center observation', () => {
  const f = fixture(), a = f.attempts[0]; a.modelStatus = 'partial'; a.modelReason = 'missing_observation';
  a.slots[5].model = 'missing'; a.slots[5].reason = 'no_pose'; rejects(f, 'invalid_state');
});
test('competing references with equal cost prefer earlier reference', () => {
  assert.deepEqual(pairs(result(fixture([450, 550], [500]))), [['r0', 'c0', 50]]);
});
test('distinct attempts and participants never exchange otherwise identical-time events', () => {
  const f = fixture([500], []), other = fixture([], [500]).attempts[0];
  other.id = 'b'; other.participantId = 'q'; other.regions[0].id = 'other-region';
  Object.assign(other.candidates[0], { id: 'other-c', participantId: 'q', attemptId: 'b', regionId: 'other-region' });
  f.attempts.push(other);
  const r = matchSyntheticMotionEvents(f); assert.equal(r.attempts[0].polarities[0].counts.misses, 1);
  assert.equal(r.attempts[1].polarities[0].counts.extras, 1);
  f.attempts.reverse(); assert.deepEqual(matchSyntheticMotionEvents(f), r);
});

// Independent oracle: choose subsets of each sequence, zip by chronology, enumerate
// all assignments, then rank complete objective tuples. No DP recurrence/matcher reuse.
function subsets(values) {
  const out = [];
  for (let mask = 0; mask < 2 ** values.length; mask++)
    out.push(values.filter((_, i) => (mask & (1 << i)) !== 0));
  return out;
}
function tupleCompare(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}
function exhaustiveOracle(references, candidates) {
  const rs = subsets(references), cs = subsets(candidates), possibilities = [];
  for (const r of rs) for (const c of cs) {
    if (r.length !== c.length) continue;
    const assignment = r.map((ref, i) => [ref, c[i]]);
    if (assignment.some(([ref, cand]) => Math.abs(cand.requestedMs - ref.requestedMs) > 100)) continue;
    const cost = assignment.reduce((sum, [ref, cand]) => sum + Math.abs(cand.requestedMs - ref.requestedMs), 0);
    possibilities.push({ assignment, score: [-assignment.length, cost,
      ...assignment.flatMap(([ref, cand]) => [ref.requestedMs, ref.id, cand.requestedMs, cand.id])] });
  }
  possibilities.sort((a, b) => tupleCompare(a.score, b.score));
  return possibilities[0];
}
test('exhaustive independent oracle: all 3969 sequence pairs of lengths zero through five', t => {
  // 63 subsets: all subsets of six nonuniform times except the length-six set.
  // Differences include 0, 100, 101, tied costs and disconnected matching windows.
  const sequences = subsets([0, 49, 100, 101, 200, 251]).filter(s => s.length <= 5);
  let checked = 0;
  for (const refTimes of sequences) for (const candTimes of sequences) {
    const f = fixture(refTimes, candTimes), a = f.attempts[0];
    const oracle = exhaustiveOracle(a.references, a.candidates), actual = result(f);
    const expected = oracle.assignment.map(([r, c]) => [r.id, c.id, c.requestedMs - r.requestedMs]);
    assert.deepEqual(pairs(actual), expected, JSON.stringify({ refTimes, candTimes }));
    assert.equal(actual.counts.T, -oracle.score[0]);
    assert.equal(actual.pairs.reduce((sum, p) => sum + p.absoluteErrorMs, 0), oracle.score[1]);
    assert.equal(new Set(actual.pairs.map(p => p.referenceId)).size, expected.length);
    assert.equal(new Set(actual.pairs.map(p => p.candidateId)).size, expected.length);
    const usedR = new Set(expected.map(p => p[0])), usedC = new Set(expected.map(p => p[1]));
    assert.deepEqual(actual.missed.map(e => e.id), a.references.filter(e => !usedR.has(e.id)).map(e => e.id));
    assert.deepEqual(actual.extra.map(e => e.id), a.candidates.filter(e => !usedC.has(e.id)).map(e => e.id));
    assert.equal(actual.counts.misses, refTimes.length - expected.length);
    assert.equal(actual.counts.extras, candTimes.length - expected.length);
    assert.equal(actual.recall, refTimes.length ? expected.length / refTimes.length : null);
    assert.equal(actual.precision, candTimes.length ? expected.length / candTimes.length : null);
    assert.equal(actual.timing.maeMs, expected.length ? oracle.score[1] / expected.length : null);
    assert.equal(actual.timing.biasMs, expected.length ? expected.reduce((sum, p) => sum + p[2], 0) / expected.length : null);
    actual.pairs.forEach(p => assert.equal(p.absoluteErrorMs, Math.abs(p.signedErrorMs)));
    a.references.reverse(); a.candidates.reverse();
    assert.deepEqual(result(f), actual); checked++;
  }
  assert.equal(checked, 3969);
  t.diagnostic('3969 exhaustive sequence pairs; 7938 production comparisons including reversed input order.');
});
