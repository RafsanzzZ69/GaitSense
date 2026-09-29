import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMotionCandidates, MOTION_CONFIGURATION } from '../src/offline/motion-candidates.ts';
const session = count => ({ id: 'synthetic', createdAt: 1, durationMs: 10000, sampledFrames: 100,
  poseFrames: count, usableFrameRatio: .8, landmarkCount: 33, view: 'side_left', rawVideoRetained: false,
  modelSha256: 'a'.repeat(64), extractorVersion: 'android-pose-0.1.1',
  timestampMethod: 'requested-100ms-nearest-decoded-frame', consentVersion: 'local-prototype-notice-v1' });
const frame = (timestampMs, value) => ({ timestampMs, landmarks: Array.from({ length: 33 }, (_, index) =>
  ({ index, x: index === 27 || index === 28 ? .5 + value : .5, y: .5, z: 0, visibility: .9, presence: .9 })) });
const wave = () => Array.from({ length: 25 }, (_, n) => frame(n * 100, [-.1, -.07, 0, .07, .1, .07, 0, -.07][n % 8]));
const run = (frames, overrides = {}, setup = { direction: 1, upright: true }) => detectMotionCandidates({ ...session(frames.length), ...overrides }, frames, setup);
const times = (r, kind) => r.candidates.filter(c => c.kind === kind).map(c => c.timestampMs);
test('known extrema timestamps and metadata, deterministic without input mutation', () => {
  const f = wave(), original = JSON.stringify(f), r = run(f);
  assert.deepEqual(times(r, 'maximum'), [400, 1200, 2000]); assert.deepEqual(times(r, 'minimum'), [800, 1600]);
  assert.ok(Math.abs(r.candidates[0].signalPosition - .1) < 1e-12);
  assert.ok(Math.abs(r.candidates[0].prominence - .1) < 1e-12);
  assert.equal(r.candidates[0].minimumConfidence, .9);
  assert.equal(r.timestampProvenance.actualDecodedFrameTimes, false);
  assert.equal(r.scientificValidation, 'not-validated'); assert.deepEqual(run(f), r); assert.equal(JSON.stringify(f), original);
});
test('anatomical side and screen direction are independent', () => {
  assert.deepEqual(times(run(wave(), { view: 'side_right' }), 'maximum'), [400, 1200, 2000]);
  assert.equal(run(wave(), { view: 'side_right' }).candidates[0].side, 'right');
  const reverse = run(wave(), {}, { direction: -1, upright: true });
  assert.deepEqual(times(reverse, 'maximum'), [800, 1600]); assert.deepEqual(times(reverse, 'minimum'), [400, 1200, 2000]);
});
test('irregular intervals retain sampled extrema timing without FPS conversion', () => {
  const timesInput = Array.from({ length: 25 }, (_, n) => Math.floor(n / 8) * 720 + [0, 80, 170, 270, 360, 440, 530, 630][n % 8]);
  const r = run(timesInput.map(t => frame(t, -.1 * Math.cos(2 * Math.PI * t / 720))));
  assert.deepEqual(times(r, 'maximum'), [360, 1080, 1800]); assert.deepEqual(times(r, 'minimum'), [720, 1440]);
  assert.ok(r.reasons.includes('irregular_sampling')); assert.equal(r.observations[1].deltaMs, 80);
});
test('separation is elapsed milliseconds at two different observation densities', () => {
  for (const step of [50, 100]) {
    const f = Array.from({ length: 1400 / step + 1 }, (_, n) => {
      const t = n * step; return frame(t, t === 400 ? .1 : t === 700 ? .08 : t === 1000 ? .09 : 0);
    });
    const r = run(f); assert.deepEqual(times(r, 'maximum'), [400, 1000]);
    assert.ok(r.exclusions.some(e => f[e.observationIndex].timestampMs === 700 && e.reason === 'separation'));
  }
});
test('exact 400ms separation is accepted', () => {
  const f = Array.from({ length: 13 }, (_, n) => frame(n * 100, n === 4 || n === 8 ? .1 : 0));
  assert.deepEqual(times(run(f), 'maximum'), [400, 800]);
});
test('missing sample splits support and preserves gap/count accounting', () => {
  const f = wave().filter(f => f.timestampMs !== 300), r = run(f);
  assert.deepEqual(r.gaps, [{ afterMs: 200, beforeMs: 400 }]);
  assert.ok(!times(r, 'maximum').includes(400)); assert.equal(r.quality.missingCount, 76);
  assert.equal(r.segments.length, 2); assert.equal(r.observations.length, 24);
});
for (const [field, value, reason] of [['presence', .59, 'low_presence'], ['visibility', .59, 'low_visibility'],
  ['x', NaN, 'non_finite_coordinate'], ['z', Infinity, 'non_finite_coordinate'], ['y', 1.01, 'out_of_frame'],
  ['presence', 2, 'invalid_confidence']]) test(`required landmark ${reason}/${field}`, () => {
  const f = wave(); f[3].landmarks[24][field] = value; const r = run(f);
  assert.equal(r.observations[3].value, null); assert.ok(r.observations[3].reasons.includes(reason));
  assert.ok(!times(r, 'maximum').includes(400)); assert.equal(r.segments.length, 2);
});
test('selected ankle only; opposite hip is still required; threshold equality accepted', () => {
  const f = wave(); f.forEach(f => { f.landmarks[28].presence = 0; f.landmarks[27].presence = .6; });
  assert.deepEqual(times(run(f), 'maximum'), [400, 1200, 2000]);
  assert.equal(run(f, { view: 'side_right' }).status, 'unavailable');
});
test('historical repeated timestamps cannot trigger a 30 FPS fallback', () => {
  const f = wave(); f[1].timestampMs = 0; const r = run(f);
  assert.deepEqual(r.reasons, ['duplicate_timestamp']); assert.equal(r.status, 'unavailable'); assert.deepEqual(r.candidates, []);
  f[1].timestampMs = 100; f[2].timestampMs = 50;
  assert.deepEqual(run(f).reasons, ['decreasing_timestamp']);
});
test('unsupported view, missing direction and unconfirmed upright return explicit reasons', () => {
  assert.deepEqual(run(wave(), { view: 'front' }).reasons, ['unsupported_view']);
  assert.deepEqual(run(wave(), {}, { upright: true }).reasons, ['direction_required']);
  assert.deepEqual(run(wave(), {}, { direction: 1, upright: false }).reasons, ['upright_required']);
  assert.deepEqual(run(wave(), { timestampMethod: 'decoded-pts' }).reasons, ['unsupported_timestamp_method']);
});
test('constant, small noisy and plateau signals do not establish evidence', () => {
  for (const values of [Array(25).fill(0), Array.from({ length: 25 }, (_, i) => i % 2 ? .005 : -.005)]) {
    const r = run(values.map((v, i) => frame(i * 100, v))); assert.equal(r.status, 'insufficient_evidence'); assert.equal(r.candidates.length, 0);
  }
  const f = wave(); f[5].landmarks[27].x = f[4].landmarks[27].x;
  const r = run(f); assert.ok(!times(r, 'maximum').includes(400)); assert.ok(r.exclusions.some(e => e.reason === 'ambiguous_plateau'));
});
test('boundaries and isolated extrema remain incomplete evidence', () => {
  const r = run(wave().slice(0, 9)); assert.deepEqual(times(r, 'maximum'), [400]);
  assert.equal(r.status, 'insufficient_evidence'); assert.ok(r.exclusions.some(e => e.reason === 'boundary_support'));
  assert.deepEqual(run([frame(0, 0)]).candidates, []);
});
test('strict invalid structure, counts and timestamps fail closed', () => {
  const f = wave(); assert.deepEqual(run(f, { poseFrames: 1 }).reasons, ['frame_count_mismatch']);
  f[2].timestampMs = NaN; assert.deepEqual(run(f).reasons, ['invalid_timestamp']);
  const sparse = wave(); delete sparse[3]; assert.deepEqual(run(sparse).reasons, ['invalid_frames']);
  assert.deepEqual(detectMotionCandidates(session(1), [], { direction: 1, upright: true }).reasons, ['no_observations']);
});
test('translation cancels through pelvis midpoint and no gap is interpolated', () => {
  const f = wave(), before = run(f); f.forEach(f => f.landmarks.forEach(p => { p.x += .1; }));
  assert.deepEqual(times(run(f), 'maximum'), times(before, 'maximum'));
  assert.equal(MOTION_CONFIGURATION.interpolation, 'none');
});

// Analytic triangular signal: minima k*period, maxima (k+.5)*period.
// Binary-exact amplitude/phase fixtures make half-sample plateaus intentional.
const triangle = (t, period = 800, amplitude = .125) =>
  amplitude * (1 - 4 * Math.abs((t % period) / period - .5));
const sampled = (step, phase = 0, period = 800, amplitude = .125) =>
  Array.from({ length: Math.floor(2400 / step) + 1 }, (_, n) => {
    const t = phase + n * step; return frame(t, triangle(t, period, amplitude));
  });
function verifySensitivity(t, frames, expected, truth, maxError, status, setup) {
  const r = run(frames, {}, setup);
  assert.deepEqual(r.candidates.map(c => c.timestampMs), expected);
  assert.equal(r.status, status);
  // One-to-one matching to fixed analytic extrema; never infer truth from detections.
  const remaining = [...truth]; let maximumError = 0, extra = 0;
  for (const c of r.candidates) {
    const i = remaining.findIndex(v => Math.abs(v - c.timestampMs) <= maxError);
    if (i < 0) extra++;
    else { maximumError = Math.max(maximumError, Math.abs(remaining[i] - c.timestampMs)); remaining.splice(i, 1); }
    assert.ok(c.timestampMs - c.supportStartMs >= 200);
    assert.ok(c.supportEndMs - c.timestampMs >= 200);
  }
  assert.equal(extra, 0); assert.equal(remaining.length, truth.length - expected.length);
  t.diagnostic(JSON.stringify({ maximumErrorMs: expected.length ? maximumError : null,
    missing: remaining.length, extra, status: r.status,
    exclusions: r.exclusions.reduce((a, e) => ({ ...a, [e.reason]: (a[e.reason] ?? 0) + 1 }), {}),
    invalidObservations: r.observations.filter(o => o.value === null).length }));
  return r;
}
const interiorTruth = [400, 800, 1200, 1600, 2000];
for (const [phase, expected, tolerance] of [
  [0, interiorTruth, 0], [25, [425, 825, 1225, 1625, 2025], 25],
  [50, [], 0], [75, [375, 775, 1175, 1575, 1975], 25],
]) test(`sensitivity: sampling phase ${phase}ms`, t => {
  const r = verifySensitivity(t, sampled(100, phase), expected, interiorTruth, tolerance,
    expected.length ? 'partial' : 'insufficient_evidence');
  if (phase === 50) assert.ok(r.exclusions.some(e => e.reason === 'ambiguous_plateau'));
});
for (const [step, expected] of [[80, interiorTruth], [100, interiorTruth], [125, []]])
  test(`sensitivity: sampling interval ${step}ms`, t => {
    const r = verifySensitivity(t, sampled(step), expected, interiorTruth, 0,
      expected.length ? 'partial' : 'insufficient_evidence');
    if (step === 125) assert.equal(r.gaps.length, 19); // 8Hz exceeds frozen 100ms gap rule.
  });
test('sensitivity: bounded timestamp jitter retains analytic timing within 20ms', t => {
  const f = Array.from({ length: 25 }, (_, n) => {
    const time = n * 90 + [0, 5, 0, -5][n % 4] + 20;
    return frame(time, triangle(time, 720));
  });
  verifySensitivity(t, f, [380, 740, 1100, 1460, 1820], [360, 720, 1080, 1440, 1800], 20, 'partial');
});
test('sensitivity: 90/110ms jitter breaks support rather than changing the gap threshold', t => {
  const f = Array.from({ length: 25 }, (_, n) => {
    const time = Math.floor(n / 2) * 200 + (n % 2 ? 90 : 0); return frame(time, triangle(time));
  });
  const r = verifySensitivity(t, f, [], interiorTruth, 0, 'insufficient_evidence');
  assert.equal(r.gaps.length, 12);
});
for (const mode of ['isolated', 'interval', 'low-confidence']) test(`sensitivity: ${mode} near an extremum`, t => {
  let f = sampled(100);
  if (mode === 'isolated') f = f.filter(f => f.timestampMs !== 400);
  else if (mode === 'interval') f = f.filter(f => f.timestampMs < 300 || f.timestampMs > 900);
  else f.find(f => f.timestampMs === 400).landmarks[24].presence = .1;
  verifySensitivity(t, f, mode === 'interval' ? [1200, 1600, 2000] : [800, 1200, 1600, 2000],
    interiorTruth, 0, 'partial');
});
for (const [period, truth] of [[600, [300, 600, 900, 1200, 1500, 1800, 2100]], [1200, [600, 1200, 1800]]])
  test(`sensitivity: analytic period ${period}ms`, t => {
    verifySensitivity(t, sampled(100, 0, period), truth, truth, 0, 'partial');
  });
test('sensitivity: small amplitude rejected without threshold tuning', t => {
  const r = verifySensitivity(t, sampled(100, 0, 800, .005), [], interiorTruth, 0, 'insufficient_evidence');
  assert.equal(r.exclusions.filter(e => e.reason === 'low_prominence').length, 5);
});
test('sensitivity: direction reversal changes polarity, not candidate timing', t => {
  const r = verifySensitivity(t, sampled(100), interiorTruth, interiorTruth, 0, 'partial', { direction: -1, upright: true });
  assert.deepEqual(times(r, 'maximum'), [800, 1600]);
});
test('sensitivity: truncated support loses analytic extrema explicitly', t => {
  const r = verifySensitivity(t, sampled(100).filter(f => f.timestampMs >= 300 && f.timestampMs <= 1700),
    [800, 1200], [400, 800, 1200, 1600], 0, 'insufficient_evidence');
  assert.ok(r.exclusions.some(e => e.reason === 'boundary_support'));
});
test('sensitivity: all low-confidence input is unavailable, not zero-valued motion', t => {
  const f = sampled(100); f.forEach(f => { f.landmarks[27].visibility = 0; });
  const r = verifySensitivity(t, f, [], interiorTruth, 0, 'unavailable');
  assert.equal(r.quality.validCount, 0); assert.equal(r.quality.validObservedFraction, 0);
});
