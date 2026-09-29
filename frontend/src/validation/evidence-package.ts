import { parseValidationManifest } from './knee-comparison.ts';
import type { ValidationManifest } from './knee-comparison.ts';

export type PixelImage = {
  id: string; width: number; height: number; pixelSha256: string;
  format: 'rgba8-v1'; orientation: 'upright';
};
export type EvidenceRecord = {
  slotId: string; participantId: string; attemptId: string;
  state: 'present' | 'missing' | 'excluded' | 'failed'; reason: string | null;
  requestedTimestampMs: number | null; sourceSha256: string | null;
  decoded: (PixelImage & {
    frameId: string; identityMethod: 'decoder-frame' | 'content-only';
    actualPtsMs: number | null; ptsMethod: 'unknown' | 'decoder';
    decoderVersion: string; encodedRotation: 0 | 90 | 180 | 270;
  }) | null;
  inference: PixelImage | null;
  transform: 'identity-v1' | 'android-resize-768-v1' | null;
  fileSha256: string | null;
};
export type EvidencePackage = {
  schemaVersion: 'synthetic-evidence-1'; evidenceKind: 'synthetic';
  comparison: ValidationManifest; records: EvidenceRecord[];
};
export type EvidenceReason = 'invalid_shape' | 'unsupported_version' | 'invalid_comparison'
  | 'invalid_id' | 'invalid_hash' | 'invalid_geometry' | 'invalid_orientation'
  | 'invalid_time' | 'invalid_time_provenance' | 'invalid_state' | 'unsupported_transform'
  | 'transform_geometry_mismatch' | 'duplicate_slot' | 'missing_slot' | 'unknown_slot'
  | 'ownership_mismatch' | 'identity_conflict' | 'source_mismatch' | 'image_mismatch'
  | 'timestamp_mismatch' | 'missing_evidence' | 'partial_failed_evidence'
  | 'content_identity_pending' | 'invalid_bytes' | 'digest_mismatch' | 'unknown_bytes'
  | 'hash_unavailable';
export type EvidenceIssue = { code: EvidenceReason; path: string };
export type ByteFixture = { imageId: string; kind: 'pixels' | 'file'; bytes: Uint8Array };
export type EvidenceReport = {
  valid: boolean; compatible: boolean; issues: EvidenceIssue[]; blockers: EvidenceIssue[];
  verifiedDigests: number; authenticity: 'not-established'; scientificValidation: 'not-validated';
};
class InvalidEvidence extends Error {
  code: EvidenceReason; path: string;
  constructor(code: EvidenceReason, path: string) { super(`${code}: ${path}`); this.code = code; this.path = path; }
}
function check(ok: unknown, code: EvidenceReason, path: string): asserts ok {
  if (!ok) throw new InvalidEvidence(code, path);
}
function shape(v: unknown, keys: string[], path: string): asserts v is Record<string, unknown> {
  check(v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)), 'invalid_shape', path);
}
const isId = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const isHash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const isTime = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
const dimension = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= 16384;
const imageKeys = ['id', 'width', 'height', 'pixelSha256', 'format', 'orientation'];
function pixelImage(v: unknown, decoded: boolean, path: string) {
  shape(v, [...imageKeys, ...(decoded ? ['frameId', 'identityMethod', 'actualPtsMs', 'ptsMethod', 'decoderVersion', 'encodedRotation'] : [])], path);
  check(isId(v.id), 'invalid_id', path);
  check(isHash(v.pixelSha256), 'invalid_hash', path);
  check(dimension(v.width) && dimension(v.height), 'invalid_geometry', path);
  check(v.format === 'rgba8-v1', 'unsupported_version', path);
  check(v.orientation === 'upright', 'invalid_orientation', path);
  if (decoded) {
    check(isId(v.frameId) && typeof v.decoderVersion === 'string' && v.decoderVersion.trim().length > 0,
      'invalid_id', path);
    check([0, 90, 180, 270].includes(v.encodedRotation as number), 'invalid_orientation', path);
    check(isTime(v.actualPtsMs), 'invalid_time', path);
    check(['decoder-frame', 'content-only'].includes(v.identityMethod as string) &&
      ((v.ptsMethod === 'unknown' && v.actualPtsMs === null) ||
       (v.ptsMethod === 'decoder' && v.actualPtsMs !== null && v.identityMethod === 'decoder-frame')),
    'invalid_time_provenance', path);
  }
}

/** ASCII header GS-RGBA8-v1\nW\nH\n followed by row-major unpremultiplied RGBA8,
 * no padding, upright square pixels. No implicit color/orientation conversion. */
export function canonicalPixels(width: number, height: number, bytes: Uint8Array): Uint8Array {
  check(dimension(width) && dimension(height), 'invalid_geometry', 'pixels');
  check(bytes instanceof Uint8Array && bytes.length === width * height * 4, 'invalid_bytes', 'pixels');
  const header = new TextEncoder().encode(`GS-RGBA8-v1\n${width}\n${height}\n`);
  const result = new Uint8Array(header.length + bytes.length); result.set(header); result.set(bytes, header.length);
  return result;
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  check(bytes instanceof Uint8Array, 'invalid_bytes', 'digest');
  check(globalThis.crypto?.subtle, 'hash_unavailable', 'digest');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** No IO or evaluation. First structural error is returned with a stable code/path.
 * Compatibility blockers preserve unresolved evidence rather than rewriting a manifest. */
export async function validateEvidencePackage(input: unknown, fixtures: ByteFixture[] = []): Promise<EvidenceReport> {
  const report: EvidenceReport = { valid: false, compatible: false, issues: [], blockers: [],
    verifiedDigests: 0, authenticity: 'not-established', scientificValidation: 'not-validated' };
  try {
    shape(input, ['schemaVersion', 'evidenceKind', 'comparison', 'records'], 'package');
    check(input.schemaVersion === 'synthetic-evidence-1' && input.evidenceKind === 'synthetic', 'unsupported_version', 'package');
    let comparison: ValidationManifest;
    try { comparison = parseValidationManifest(input.comparison); }
    catch { throw new InvalidEvidence('invalid_comparison', 'comparison'); }
    check(Array.isArray(input.records), 'invalid_shape', 'records');
    const slots = new Map(comparison.participants.flatMap(p => p.attempts.flatMap(a =>
      a.slots.map(s => [s.id, { p, a, s }] as const))));
    const seen = new Set<string>();
    const owners = new Map<string, string>(), identities = new Map<string, string>();
    const images = new Map<string, { image: PixelImage; fileHash: string | null }>();
    function immutable(key: string, value: unknown, path: string) {
      const signature = JSON.stringify(value);
      check(!identities.has(key) || identities.get(key) === signature, 'identity_conflict', path);
      identities.set(key, signature);
    }
    function owned(key: string, owner: string, path: string) {
      check(!owners.has(key) || owners.get(key) === owner, 'ownership_mismatch', path); owners.set(key, owner);
    }
    for (let n = 0; n < input.records.length; n++) {
      const v: unknown = input.records[n], path = `records[${n}]`;
      shape(v, ['slotId', 'participantId', 'attemptId', 'state', 'reason', 'requestedTimestampMs', 'sourceSha256',
        'decoded', 'inference', 'transform', 'fileSha256'], path);
      check([v.slotId, v.participantId, v.attemptId].every(isId), 'invalid_id', path);
      check(!seen.has(v.slotId as string), 'duplicate_slot', path); seen.add(v.slotId as string);
      const link = slots.get(v.slotId as string); check(link, 'unknown_slot', path);
      check(v.participantId === link.p.id && v.attemptId === link.a.id, 'ownership_mismatch', path);
      check(isTime(v.requestedTimestampMs), 'invalid_time', path);
      check(v.sourceSha256 === null || isHash(v.sourceSha256), 'invalid_hash', path);
      check(v.fileSha256 === null || isHash(v.fileSha256), 'invalid_hash', path);
      check(['present', 'missing', 'excluded', 'failed'].includes(v.state as string) &&
        (v.state === 'present' ? v.reason === null : typeof v.reason === 'string' && v.reason.trim().length > 0), 'invalid_state', path);
      check((link.a.status === 'failed') === (v.state === 'failed'), 'invalid_state', path);
      if (v.decoded !== null) pixelImage(v.decoded, true, `${path}.decoded`);
      if (v.inference !== null) pixelImage(v.inference, false, `${path}.inference`);
      const r = v as unknown as EvidenceRecord;
      check(r.transform === null || ['identity-v1', 'android-resize-768-v1'].includes(r.transform), 'unsupported_transform', path);
      check(r.fileSha256 === null || r.inference !== null, 'invalid_state', path);
      check(r.state !== 'present' || r.inference !== null, 'missing_evidence', path);
      check(r.state !== 'missing' || r.inference === null, 'invalid_state', path);
      if (r.sourceSha256) {
        owned(`source:${r.sourceSha256}`, r.attemptId, path);
        immutable(`attempt-source:${r.attemptId}`, r.sourceSha256, path);
      }
      if (r.decoded) {
        check(r.sourceSha256 !== null && r.requestedTimestampMs !== null, 'missing_evidence', path);
        const d = r.decoded;
        // Ordered tuples make immutable checks independent of input object key order.
        immutable(`frame:${r.sourceSha256}:${d.frameId}`, [d.id, d.width, d.height, d.pixelSha256,
          d.identityMethod, d.actualPtsMs, d.ptsMethod, d.decoderVersion, d.encodedRotation], path);
        if (d.identityMethod === 'content-only') report.blockers.push({ code: 'content_identity_pending', path });
      }
      if (r.inference) {
        check(r.decoded !== null && r.transform !== null, 'missing_evidence', path);
        const d = r.decoded, i = r.inference;
        check(d.id !== i.id, 'identity_conflict', path);
        const scale = r.transform === 'identity-v1' ? 1 : Math.min(1, 768 / Math.max(d.width, d.height));
        check(i.width === Math.trunc(d.width * scale) && i.height === Math.trunc(d.height * scale), 'transform_geometry_mismatch', path);
        if (i.width === d.width && i.height === d.height) check(i.pixelSha256 === d.pixelSha256, 'image_mismatch', path);
        immutable(`mapping:${i.id}`, [r.sourceSha256, d.frameId, d.id, r.transform, r.fileSha256], path);
        immutable(`transformed:${r.sourceSha256}:${d.frameId}:${r.transform}`, [i.id, i.width, i.height, i.pixelSha256], path);
      } else check(r.transform === null, 'invalid_state', path);
      for (const [role, im] of [['decoded', r.decoded], ['inference', r.inference]] as const) if (im) {
        owned(`pixels:${im.pixelSha256}`, r.attemptId, path);
        immutable(`image:${im.id}`, [role, r.attemptId, im.width, im.height, im.pixelSha256,
          role === 'decoded' ? r.sourceSha256 : null, role === 'decoded' ? r.decoded?.frameId : null], path);
        images.set(im.id, { image: im, fileHash: role === 'inference' ? r.fileSha256 : null });
      }
      if (link.a.status === 'failed') {
        if (r.decoded || r.inference || r.requestedTimestampMs !== null) report.blockers.push({ code: 'partial_failed_evidence', path });
        continue; // Partial evidence is preserved but never inserted into failed comparison slots.
      }
      check(r.requestedTimestampMs === link.s.requestedTimestampMs, 'timestamp_mismatch', path);
      if (link.s.image) {
        check(r.inference && r.decoded, 'missing_evidence', path);
        const im = link.s.image;
        check(im.sourceSha256 === r.sourceSha256, 'source_mismatch', path);
        check(im.id === r.inference.id && im.frameId === r.decoded.frameId &&
          im.bitmapSha256 === r.inference.pixelSha256 && im.width === r.inference.width &&
          im.height === r.inference.height && im.actualPtsMs === r.decoded.actualPtsMs, 'image_mismatch', path);
      } else check(r.inference === null, 'image_mismatch', path);
      if (r.state === 'excluded') check(link.s.reference.status === 'excluded', 'invalid_state', path);
    }
    check(seen.size === slots.size, 'missing_slot', 'records');
    check(Array.isArray(fixtures), 'invalid_bytes', 'fixtures');
    const byteIds = new Set<string>();
    for (let n = 0; n < fixtures.length; n++) {
      const f = fixtures[n], path = `fixtures[${n}]`;
      shape(f, ['imageId', 'kind', 'bytes'], path);
      check(isId(f.imageId) && ['pixels', 'file'].includes(f.kind) && f.bytes instanceof Uint8Array, 'invalid_bytes', path);
      check(!byteIds.has(`${f.kind}:${f.imageId}`), 'invalid_bytes', path); byteIds.add(`${f.kind}:${f.imageId}`);
      const entry = images.get(f.imageId); check(entry, 'unknown_bytes', path);
      const expected = f.kind === 'file' ? entry.fileHash : entry.image.pixelSha256;
      check(expected !== null, 'missing_evidence', path);
      check(f.kind !== 'pixels' || f.bytes.length === entry.image.width * entry.image.height * 4,
        'invalid_bytes', `${path}.bytes`);
      const bytes = f.kind === 'file' ? f.bytes : canonicalPixels(entry.image.width, entry.image.height, f.bytes);
      check(await sha256(bytes) === expected, 'digest_mismatch', path); report.verifiedDigests++;
    }
    report.valid = true; report.compatible = report.blockers.length === 0;
  } catch (error) {
    if (!(error instanceof InvalidEvidence)) throw error;
    report.issues.push({ code: error.code, path: error.path });
  }
  return report;
}
