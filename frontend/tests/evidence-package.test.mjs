import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalPixels, sha256, validateEvidencePackage } from '../src/validation/evidence-package.ts';
import { parseValidationManifest, summarizeParticipants, computeMetrics } from '../src/validation/knee-comparison.ts';

const source = 'a'.repeat(64), digest = 'b'.repeat(64);
function fixture() {
  const slots = Array.from({ length: 20 }, (_, n) => ({ id: `s${n}`, ordinal: n, requestedTimestampMs: n * 100,
    image: n ? null : { id: 'inference', sourceSha256: source, frameId: 'f0', bitmapSha256: digest, width: 2, height: 1, actualPtsMs: 17 },
    reference: { status: 'missing', angleDegrees: null, imageId: n ? null : 'inference', reason: 'not_annotated', annotations: [], adjudication: null },
    model: { status: 'unavailable', angleDegrees: null, imageId: n ? null : 'inference', reason: 'low_presence' } }));
  const comparison = { schemaVersion: 'knee-validation-manifest-1', evidenceKind: 'synthetic', units: 'degrees',
    evaluationVersion: 'knee-comparison-1', algorithmVersion: 'projected-knee-1', configurationVersion: 'knee-quality-1',
    simulatedPrerequisites: { approvals: false, software: false, referenceReadiness: false },
    participants: [{ id: 'p', partition: 'evaluation', plannedTrialIds: ['t0', 't1', 't2'], attempts: [{ id: 'a', trialId: 't0', status: 'recorded', reason: null,
      capture: { view: 'side_left', device: 'synthetic', protocolVersion: 'synthetic', timestampMethod: 'requested-100ms-nearest-decoded-frame' }, slots }] }] };
  const records = slots.map((s, n) => ({ slotId: s.id, participantId: 'p', attemptId: 'a', state: n ? 'missing' : 'present', reason: n ? 'decode_missing' : null,
    requestedTimestampMs: s.requestedTimestampMs, sourceSha256: source,
    decoded: n ? null : { id: 'decoded', width: 2, height: 1, pixelSha256: digest, format: 'rgba8-v1', orientation: 'upright',
      frameId: 'f0', identityMethod: 'decoder-frame', actualPtsMs: 17, ptsMethod: 'decoder', decoderVersion: 'synthetic-1', encodedRotation: 90 },
    inference: n ? null : { id: 'inference', width: 2, height: 1, pixelSha256: digest, format: 'rgba8-v1', orientation: 'upright' },
    transform: n ? null : 'identity-v1', fileSha256: null }));
  return { schemaVersion: 'synthetic-evidence-1', evidenceKind: 'synthetic', comparison, records };
}
const slot = f => f.comparison.participants[0].attempts[0].slots[0];
async function reason(f, code) { const r = await validateEvidencePackage(f); assert.equal(r.valid, false); assert.equal(r.issues[0].code, code); assert.ok(r.issues[0].path); }

test('valid correspondence keeps requested 0 distinct from actual 17; metadata proves no authenticity', async () => {
  const f = fixture(), before = JSON.stringify(f), r = await validateEvidencePackage(f);
  assert.equal(r.valid, true); assert.equal(r.compatible, true); assert.equal(r.verifiedDigests, 0);
  assert.equal(r.authenticity, 'not-established'); assert.equal(r.scientificValidation, 'not-validated');
  assert.equal(JSON.stringify(f), before);
  const metrics = computeMetrics(summarizeParticipants(parseValidationManifest(f.comparison)));
  assert.equal(metrics.Y, 0); assert.equal(metrics.C, null); // Missing observations remain denominator entries.
});

test('canonical serialization has fixed bytes and standard SHA-256 vector', async () => {
  const pixels = new Uint8Array([1, 2, 3, 255]);
  assert.deepEqual([...canonicalPixels(1, 1, pixels)], [...Buffer.from('GS-RGBA8-v1\n1\n1\n'), 1, 2, 3, 255]);
  assert.equal(await sha256(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('independent Node digest verifies pixels and file separately; tampering fails', async () => {
  const f = fixture(), bytes = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]);
  const expected = createHash('sha256').update(Buffer.from('GS-RGBA8-v1\n2\n1\n')).update(bytes).digest('hex');
  f.records[0].decoded.pixelSha256 = f.records[0].inference.pixelSha256 = slot(f).image.bitmapSha256 = expected;
  const file = new Uint8Array([1, 2, 3]);
  f.records[0].fileSha256 = createHash('sha256').update(file).digest('hex');
  const fixtures = [{ imageId: 'inference', kind: 'pixels', bytes }, { imageId: 'inference', kind: 'file', bytes: file }];
  assert.equal((await validateEvidencePackage(f, fixtures)).verifiedDigests, 2);
  bytes[0] = 1;
  assert.equal((await validateEvidencePackage(f, fixtures)).issues[0].code, 'digest_mismatch');
});

test('resize distinguishes decoded from inference pixels and uses truncated dimensions', async () => {
  const f = fixture(), r = f.records[0];
  Object.assign(r.decoded, { width: 1000, height: 501, pixelSha256: 'c'.repeat(64) });
  Object.assign(r.inference, { width: 768, height: 384 }); Object.assign(slot(f).image, { width: 768, height: 384 });
  r.transform = 'android-resize-768-v1';
  assert.equal((await validateEvidencePackage(f)).valid, true);
  r.inference.height = 385; await reason(f, 'transform_geometry_mismatch');
});

test('unknown actual PTS is explicit; content identity remains pending', async () => {
  const f = fixture(); Object.assign(f.records[0].decoded, { actualPtsMs: null, ptsMethod: 'unknown' }); slot(f).image.actualPtsMs = null;
  assert.equal((await validateEvidencePackage(f)).compatible, true);
  f.records[0].decoded.identityMethod = 'content-only';
  const r = await validateEvidencePackage(f); assert.equal(r.valid, true); assert.equal(r.compatible, false);
  assert.equal(r.blockers[0].code, 'content_identity_pending');
});

for (const [name, mutate, code] of [
  ['missing metadata', f => delete f.records[0].decoded, 'invalid_shape'],
  ['schema', f => f.schemaVersion = 'future', 'unsupported_version'],
  ['real label', f => f.evidenceKind = 'real', 'unsupported_version'],
  ['hash format', f => f.records[0].sourceSha256 = 'xyz', 'invalid_hash'],
  ['dimension', f => f.records[0].decoded.width = 0, 'invalid_geometry'],
  ['orientation', f => f.records[0].decoded.orientation = 'rotated', 'invalid_orientation'],
  ['rotation', f => f.records[0].decoded.encodedRotation = 45, 'invalid_orientation'],
  ['unsupported transform', f => f.records[0].transform = 'crop', 'unsupported_transform'],
  ['same image IDs', f => f.records[0].decoded.id = 'inference', 'identity_conflict'],
  ['unknown time asserted', f => f.records[0].decoded.ptsMethod = 'unknown', 'invalid_time_provenance'],
  ['negative time', f => f.records[0].requestedTimestampMs = -1, 'invalid_time'],
  ['requested join', f => f.records[0].requestedTimestampMs = 17, 'timestamp_mismatch'],
  ['participant owner', f => f.records[0].participantId = 'other', 'ownership_mismatch'],
  ['attempt owner', f => f.records[0].attemptId = 'other', 'ownership_mismatch'],
  ['duplicate slot', f => f.records.push(structuredClone(f.records[0])), 'duplicate_slot'],
  ['missing slot', f => f.records.pop(), 'missing_slot'],
  ['unknown slot', f => f.records[0].slotId = 'unknown', 'unknown_slot'],
  ['missing image', f => f.records[0].inference = null, 'missing_evidence'],
  ['source join', f => f.records[0].sourceSha256 = 'c'.repeat(64), 'source_mismatch'],
  ['model join', f => slot(f).model.imageId = 'wrong', 'invalid_comparison'],
  ['reference join', f => slot(f).reference.imageId = 'wrong', 'invalid_comparison'],
  ['comparison version', f => f.comparison.algorithmVersion = 'future', 'invalid_comparison'],
]) test(name, async () => { const f = fixture(); mutate(f); await reason(f, code); });

test('failed attempts preserve 20 slots; partial evidence blocks conversion', async () => {
  const f = fixture(), a = f.comparison.participants[0].attempts[0]; a.status = 'failed'; a.reason = 'capture_failed';
  for (const s of a.slots) { s.requestedTimestampMs = null; s.image = null; s.reference.imageId = null; s.model.imageId = null; }
  for (const r of f.records) { r.state = 'failed'; r.reason = 'capture_failed'; }
  const partial = await validateEvidencePackage(f); assert.equal(partial.valid, true);
  assert.equal(partial.blockers[0].code, 'partial_failed_evidence');
  for (const r of f.records) { r.requestedTimestampMs = null; r.decoded = r.inference = r.transform = null; }
  assert.equal((await validateEvidencePackage(f)).compatible, true);
  assert.equal(a.slots.length, 20);
});

test('excluded reference remains accounted for without deleting image', async () => {
  const f = fixture(); f.records[0].state = 'excluded'; f.records[0].reason = 'occlusion'; slot(f).reference.status = 'excluded';
  assert.equal((await validateEvidencePackage(f)).valid, true);
});

test('repeated identical image accepted; conflicting immutable decoded metadata rejected', async () => {
  const f = fixture(), a = f.comparison.participants[0].attempts[0];
  a.slots[1] = { ...structuredClone(a.slots[0]), id: 's1', ordinal: 1, requestedTimestampMs: 100 };
  f.records[1] = { ...structuredClone(f.records[0]), slotId: 's1', requestedTimestampMs: 100 };
  assert.equal((await validateEvidencePackage(f)).valid, true);
  f.records[1].decoded.decoderVersion = 'changed'; await reason(f, 'identity_conflict');
});

test('source reuse across attempts including missing evidence rejects', async () => {
  const f = fixture(), p = f.comparison.participants[0], a = structuredClone(p.attempts[0]);
  a.id = 'a2'; a.trialId = 't1';
  a.slots = a.slots.map((s, n) => ({ ...s, id: `other${n}`, image: null,
    reference: { ...s.reference, imageId: null }, model: { ...s.model, imageId: null } })); p.attempts.push(a);
  f.records.push(...a.slots.map(s => ({ ...structuredClone(f.records[1]), slotId: s.id, attemptId: 'a2' })));
  await reason(f, 'ownership_mismatch');
});

test('malformed inputs return structured reasons', async () => {
  for (const f of [null, [], {}, { schemaVersion: 'x' }]) await reason(f, 'invalid_shape');
  const r = await validateEvidencePackage(fixture(), [{ imageId: 'absent', kind: 'pixels', bytes: new Uint8Array() }]);
  assert.equal(r.issues[0].code, 'unknown_bytes');
});

test('dual independent annotation joins are checked by the committed parser', async () => {
  const f = fixture(), s = slot(f);
  s.reference = { status: 'available', angleDegrees: 0, imageId: 'inference', reason: null,
    annotations: ['o1', 'o2'].map(observerId => ({ id: `ann-${observerId}`, observerId, toolVersion: 'synthetic-atan2',
      imageId: 'inference', points: [[0, 0], [.5, 0], [1, 0]], reason: null })), adjudication: null };
  s.model = { status: 'available', angleDegrees: 0, imageId: 'inference', reason: null };
  assert.equal((await validateEvidencePackage(f)).valid, true);
  const m = computeMetrics(summarizeParticipants(parseValidationManifest(f.comparison)));
  assert.equal(m.Y, .05); assert.equal(m.E, .05); assert.equal(m.C, 1); assert.equal(m.mae, 0);
  s.reference.annotations[1].imageId = 'decoded'; await reason(f, 'invalid_comparison');
});

test('one decoded frame cannot map to conflicting inference images with the same transform', async () => {
  const f = fixture(), a = f.comparison.participants[0].attempts[0], r = f.records[0];
  Object.assign(r.decoded, { width: 1000, height: 500, pixelSha256: 'c'.repeat(64) });
  Object.assign(r.inference, { width: 768, height: 384 }); Object.assign(slot(f).image, { width: 768, height: 384 });
  r.transform = 'android-resize-768-v1';
  // Sidecar evidence on a failed attempt is not subjected to comparison image joins.
  a.status = 'failed'; a.reason = 'processing_failed';
  for (const s of a.slots) { s.image = null; s.requestedTimestampMs = null; s.reference.imageId = s.model.imageId = null; }
  for (const entry of f.records) { entry.state = 'failed'; entry.reason = 'processing_failed'; }
  f.records[1] = { ...structuredClone(r), slotId: 's1', requestedTimestampMs: 100 };
  f.records[1].inference.id = 'other-image'; f.records[1].inference.pixelSha256 = 'd'.repeat(64);
  await reason(f, 'identity_conflict');
});

test('cross-participant source ownership includes missing-image records', async () => {
  const f = fixture(), p = structuredClone(f.comparison.participants[0]);
  p.id = 'p2'; p.plannedTrialIds = ['u0', 'u1', 'u2']; p.attempts[0].id = 'a2'; p.attempts[0].trialId = 'u0';
  p.attempts[0].slots.forEach((s, n) => { s.id = `u${n}-slot`; s.image = null; s.reference.imageId = s.model.imageId = null; });
  f.comparison.participants.push(p);
  f.records.push(...p.attempts[0].slots.map(s => ({ ...structuredClone(f.records[1]), slotId: s.id, participantId: 'p2', attemptId: 'a2' })));
  await reason(f, 'ownership_mismatch');
});

test('wrong byte lengths and incorrect file digests cannot be verified', async () => {
  const f = fixture();
  assert.deepEqual((await validateEvidencePackage(f, [{ imageId: 'inference', kind: 'pixels', bytes: new Uint8Array(4) }])).issues[0],
    { code: 'invalid_bytes', path: 'fixtures[0].bytes' });
  f.records[0].fileSha256 = digest;
  assert.equal((await validateEvidencePackage(f, [{ imageId: 'inference', kind: 'file', bytes: new Uint8Array([1]) }])).issues[0].code, 'digest_mismatch');
});
