import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeKneeFlexion, legacyKneeGeometry, KNEE_CONFIGURATION } from '../src/offline/knee-flexion.ts';

const session = (count = 1, overrides = {}) => ({
  id: 'synthetic-knee', createdAt: 1, durationMs: 10000, sampledFrames: 100,
  poseFrames: count, usableFrameRatio: .8, landmarkCount: 33, view: 'side_left',
  rawVideoRetained: false, modelSha256: 'a'.repeat(64), extractorVersion: 'android-pose-0.1.1',
  timestampMethod: 'requested-100ms-nearest-decoded-frame', consentVersion: 'local-prototype-notice-v1',
  diagnostics: 'encoded=1280x720; rotation=90; decoded=720x1280; samples=100', ...overrides,
});
const frame = (timestampMs = 0) => ({ timestampMs, landmarks: Array.from({ length: 33 }, (_, index) =>
  ({ index, x: .5, y: .5, z: 0, visibility: .9, presence: .9 })) });
// Define geometry independently in pixel-isotropic coordinates, then normalize.
function posed(timestampMs = 0, angle = 90, width = 720, height = 1280, side = 'left', scale = 1, offset = 0) {
  const f = frame(timestampMs), knee = [.5 + offset, .5 + offset];
  const radians = (180 - angle) * Math.PI / 180;
  const hip = [knee[0] + .1 * scale * height / width, knee[1]];
  const ankle = [knee[0] + .1 * scale * Math.cos(radians) * height / width,
    knee[1] + .1 * scale * Math.sin(radians)];
  const indices = side === 'left' ? [23, 25, 27] : [24, 26, 28];
  [hip, knee, ankle].forEach(([x, y], i) => Object.assign(f.landmarks[indices[i]], { x, y }));
  return f;
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const analyze = (frames, overrides = {}) => analyzeKneeFlexion(session(frames.length, overrides), frames);

test('known flexion values include straight, right-angle, oblique and folded geometry', () => {
  for (const angle of [0, 30, 60, 90, 120, 180]) {
    const result = analyze([posed(0, angle)]);
    near(result.observations[0].value, angle);
    assert.equal(result.observations[0].status, 'available');
    assert.equal(result.scientificValidation, 'not-validated');
  }
});

test('portrait, landscape and square geometry correct x/y independently', () => {
  for (const [w, h] of [[720, 1280], [1280, 720], [512, 512]]) {
    const result = analyze([posed(0, 60, w, h)], { diagnostics: `decoded=${w}x${h}` });
    near(result.observations[0].value, 60);
    near(result.geometry.aspectRatio, w / h);
  }
});

test('integer native resizing, rather than raw decoded ratio, defines coordinate space', () => {
  const s = session(1, { diagnostics: 'encoded=1281x721; rotation=90; decoded=721x1281' });
  const geometry = legacyKneeGeometry(s);
  assert.equal(geometry.inferenceWidth, 432);
  assert.equal(geometry.inferenceHeight, 768);
  assert.notEqual(geometry.aspectRatio, geometry.decodedAspectRatio);
  const result = analyzeKneeFlexion(s, [posed(0, 60, 432, 768)]);
  near(result.observations[0].value, 60);
});

test('left/right selection uses only the required hip, knee and ankle quality', () => {
  for (const side of ['left', 'right']) {
    const f = posed(0, 60, 720, 1280, side);
    const opposite = side === 'left' ? 24 : 23;
    f.landmarks[opposite].x = NaN;
    f.landmarks[opposite + 2].presence = 0;
    const result = analyze([f], { view: `side_${side}` });
    near(result.observations[0].value, 60);
    assert.equal(result.side, side);
    assert.deepEqual(result.observations[0].landmarkQuality.map(q => q.index),
      side === 'left' ? [23, 25, 27] : [24, 26, 28]);
  }
});

test('translation, limb scaling and proportional image resizing preserve angles', () => {
  for (const scale of [.5, 1, 1.5]) for (const offset of [-.1, 0, .1]) {
    near(analyze([posed(0, 60, 720, 1280, 'left', scale, offset)]).observations[0].value, 60);
  }
  const f = posed(0, 60);
  near(analyze([f], { diagnostics: 'decoded=1440x2560' }).observations[0].value, 60);
});

test('irregular stored times retain differences and provenance without resampling', () => {
  const result = analyze([0, 80, 175].map(t => posed(t)));
  assert.deepEqual(result.observations.map(o => o.deltaFromPreviousMs), [null, 80, 95]);
  assert.deepEqual(result.segments, [{ startMs: 0, endMs: 175, observationIndices: [0, 1, 2] }]);
  assert.ok(result.reasons.includes('irregular_sampling'));
  assert.equal(result.timestampProvenance.actualDecodedFrameTimes, false);
  assert.equal(result.timestampProvenance.method, session().timestampMethod);
});

test('duplicate/decreasing/invalid times fail explicitly without sorting or partial calculation', () => {
  for (const [times, reason] of [[[0, 0], 'duplicate_timestamp'], [[100, 0], 'decreasing_timestamp'],
    [[-1], 'invalid_timestamp'], [[10000], 'invalid_timestamp'], [[NaN], 'invalid_timestamp'],
    [[Infinity], 'invalid_timestamp'], [[.5], 'invalid_timestamp']]) {
    const result = analyze(times.map(t => posed(t)));
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.reasons, [reason]);
    assert.deepEqual(result.observations, []);
  }
});

test('gaps and bad observations split segments and never fabricate samples', () => {
  const frames = [100, 200, 400, 500, 600].map(t => posed(t));
  frames[3].landmarks[25].visibility = .59;
  const result = analyze(frames);
  assert.equal(result.observations.length, 5);
  assert.deepEqual(result.segments.map(s => s.observationIndices), [[0, 1], [2], [4]]);
  assert.deepEqual(result.gaps, [{ afterMs: 200, beforeMs: 400, elapsedMs: 200 }]);
  assert.deepEqual(result.timeRange, { startMs: 100, endMs: 600 });
  assert.equal(result.quality.missingObservationCount, 95);
  assert.equal(result.quality.contributingObservationCount, 4);
  assert.equal(result.quality.validObservedFraction, .8);
  assert.equal(result.quality.validExpectedFraction, .04);
  assert.equal(result.observations[3].value, null);
});

test('confidence requires both visibility and presence, inclusive at 0.6', () => {
  for (const field of ['visibility', 'presence']) {
    const f = posed(); f.landmarks[25][field] = .6;
    assert.equal(analyze([f]).observations[0].status, 'available');
    f.landmarks[25][field] = .599;
    const result = analyze([f]);
    assert.equal(result.status, 'unavailable');
    assert.ok(result.observations[0].reasons.includes(`low_${field}`));
    assert.equal(result.observations[0].value, null);
  }
});

test('out-of-frame, non-finite and invalid confidence values remain explicit masked observations', () => {
  for (const [field, value, reason] of [['x', -0.01, 'out_of_frame'], ['y', 1.01, 'out_of_frame'],
    ['x', NaN, 'non_finite_coordinate'], ['y', Infinity, 'non_finite_coordinate'], ['z', -Infinity, 'non_finite_coordinate'],
    ['visibility', NaN, 'invalid_confidence'], ['presence', 1.1, 'invalid_confidence'], ['presence', -.1, 'invalid_confidence']]) {
    const f = posed(); f.landmarks[23][field] = value;
    const result = analyze([f]);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.observations[0].value, null);
    assert.ok(result.observations[0].reasons.includes(reason));
    assert.equal(result.observations[0].landmarkQuality[0].valid, false);
    assert.ok(!JSON.stringify(result).includes('NaN'));
  }
});

test('missing, malformed, duplicate, ambiguous and unknown-version geometry fails closed', () => {
  const diagnostics = [undefined, '', 'encoded=720x1280; rotation=90', 'decoded=unknown',
    'decoded=0x720', 'decoded=-1x720', 'decoded=720.5x1280', 'decoded=720x1280junk',
    'decoded=720x1280; decoded=720x1280', 'decoded=720x1280; decoded=unknown',
    'decoded=720x1280; Decoded=1280x720', 'decoded =720x1280', 'decoded=9007199254740992x720',
    'decoded=1x1000000'];
  for (const diagnostic of diagnostics) {
    const result = analyze([posed()], { diagnostics: diagnostic });
    assert.equal(result.geometry, null, diagnostic);
    assert.equal(result.status, 'unavailable');
    assert.ok(result.reasons.includes('missing_geometry'), diagnostic);
    assert.equal(result.observations[0].value, null);
  }
  assert.ok(analyze([posed()], { extractorVersion: 'android-pose-9' }).reasons.includes('missing_geometry'));
});

test('degenerate and numerically tiny vectors are unavailable, not zero or NaN', () => {
  for (const index of [23, 27]) {
    const f = posed(); Object.assign(f.landmarks[index], { x: .5, y: .5 });
    const result = analyze([f]);
    assert.equal(result.observations[0].value, null);
    assert.ok(result.reasons.includes('degenerate_geometry'));
  }
  const f = posed(); Object.assign(f.landmarks[23], { x: .5 + 1e-14, y: .5 });
  assert.ok(analyze([f]).reasons.includes('degenerate_geometry'));
});

test('unsupported view and timestamp method are explicit', () => {
  for (const view of ['front', 'side', 'unknown', '']) {
    assert.deepEqual(analyze([posed()], { view }).reasons, ['unsupported_view']);
  }
  assert.deepEqual(analyze([posed()], { timestampMethod: 'actual-pts' }).reasons, ['unsupported_timestamp_method']);
});

test('malformed frames, sparse arrays, missing landmarks and numeric strings fail structural validation', () => {
  const bad = [null, {}, [null], Array(1)];
  const short = posed(); short.landmarks.pop(); bad.push([short]);
  const sparse = posed(); delete sparse.landmarks[2]; bad.push([sparse]);
  const wrongIndex = posed(); wrongIndex.landmarks[25].index = 26; bad.push([wrongIndex]);
  const string = posed(); string.landmarks[25].x = '.5'; bad.push([string]);
  for (const frames of bad) {
    const result = analyzeKneeFlexion(session(), frames);
    assert.deepEqual(result.reasons, ['invalid_frames']);
    assert.equal(result.status, 'unavailable');
  }
});

test('invalid summaries, count mismatches and empty input are explicit', () => {
  for (const overrides of [{ sampledFrames: 99 }, { durationMs: 10000.1 }, { createdAt: -1 },
    { modelSha256: 123 }, { rawVideoRetained: true }, { usableFrameRatio: NaN }]) {
    assert.deepEqual(analyze([posed()], overrides).reasons, ['invalid_session']);
  }
  assert.deepEqual(analyzeKneeFlexion(null, []).reasons, ['invalid_session']);
  assert.deepEqual(analyzeKneeFlexion(session(2), [posed()]).reasons, ['frame_count_mismatch']);
  assert.deepEqual(analyzeKneeFlexion(session(), []).reasons, ['no_observations']);
});

test('complete series yields available status and full coverage; inputs stay unchanged', () => {
  const frames = Array.from({ length: 100 }, (_, n) => posed(n * 100));
  const s = session(100), original = JSON.stringify({ s, frames });
  const result = analyzeKneeFlexion(s, frames);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.quality.validExpectedFraction, 1);
  assert.equal(result.quality.contributingObservationCount, 100);
  assert.equal(result.segments.length, 1);
  assert.deepEqual(result.contributingTimeRange, { startMs: 0, endMs: 9900 });
  assert.equal(result.units, 'degrees');
  assert.equal(result.configuration.version, 'knee-quality-1');
  assert.equal(Object.isFrozen(KNEE_CONFIGURATION), true);
  assert.equal(JSON.stringify({ s, frames }), original);
});
